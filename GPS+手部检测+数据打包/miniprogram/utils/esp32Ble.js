/**
 * 低功耗蓝牙：固定外设 ESP32-S3-CAM
 * 服务 UUID / 特征 UUID 为常见 BLE UART（Nordic UART Service）兼容配置。
 */

const DEVICE_NAME = 'ESP32-S3-CAM'
const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb'
const CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb'

function normalizeUuid(uuid) {
  return String(uuid || '').replace(/-/g, '').toUpperCase()
}

const TARGET_SERVICE = normalizeUuid(SERVICE_UUID)
const TARGET_CHAR = normalizeUuid(CHAR_UUID)

function openAdapter() {
  return new Promise((resolve, reject) => {
    wx.openBluetoothAdapter({
      success: resolve,
      fail: reject
    })
  })
}

function stopDiscoverySafe() {
  wx.stopBluetoothDevicesDiscovery({ complete: () => {} })
}

function findDevice() {
  return new Promise((resolve, reject) => {
    let finished = false
    let discoveryListener = null
    const timeoutMs = 20000
    const timeout = setTimeout(() => {
      if (finished) return
      finished = true
      stopDiscoverySafe()
      if (discoveryListener) {
        wx.offBluetoothDeviceFound(discoveryListener)
      }
      discoveryListener = null
      reject(new Error('扫描超时，未找到设备 ' + DEVICE_NAME))
    }, timeoutMs)

    discoveryListener = (res) => {
      if (finished) return
      const devices = res.devices || []
      for (let i = 0; i < devices.length; i++) {
        const d = devices[i]
        const name = d.name || ''
        const localName = d.localName || ''
        if (name === DEVICE_NAME || localName === DEVICE_NAME) {
          finished = true
          clearTimeout(timeout)
          stopDiscoverySafe()
          wx.offBluetoothDeviceFound(discoveryListener)
          discoveryListener = null
          resolve(d)
          return
        }
      }
    }

    wx.onBluetoothDeviceFound(discoveryListener)
    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: false,
      success: () => {},
      fail: (err) => {
        if (finished) return
        finished = true
        clearTimeout(timeout)
        wx.offBluetoothDeviceFound(discoveryListener)
        discoveryListener = null
        reject(err)
      }
    })
  })
}

function connect(deviceId) {
  return new Promise((resolve, reject) => {
    wx.createBLEConnection({
      deviceId,
      timeout: 15000,
      success: () => resolve(),
      fail: reject
    })
  })
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function getServiceAndCharacteristic(deviceId) {
  return new Promise((resolve, reject) => {
    wx.getBLEDeviceServices({
      deviceId,
      success: async (sres) => {
        const services = sres.services || []
        const svc = services.find((s) => normalizeUuid(s.uuid) === TARGET_SERVICE)
        if (!svc) {
          reject(new Error('未找到服务 UUID：' + SERVICE_UUID))
          return
        }
        await sleep(100)
        wx.getBLEDeviceCharacteristics({
          deviceId,
          serviceId: svc.uuid,
          success: (cres) => {
            const chars = cres.characteristics || []
            const ch = chars.find((c) => normalizeUuid(c.uuid) === TARGET_CHAR)
            if (!ch) {
              reject(new Error('未找到特征 UUID：' + CHAR_UUID))
              return
            }
            resolve({
              serviceId: svc.uuid,
              characteristicId: ch.uuid,
              characteristic: ch
            })
          },
          fail: reject
        })
      },
      fail: reject
    })
  })
}

function enableNotify(deviceId, serviceId, characteristicId) {
  return new Promise((resolve, reject) => {
    wx.notifyBLECharacteristicValueChange({
      deviceId,
      serviceId,
      characteristicId,
      state: true,
      success: resolve,
      fail: reject
    })
  })
}

function ab2str(buffer) {
  const u8 = new Uint8Array(buffer)
  let out = ''
  for (let i = 0; i < u8.length; i++) {
    out += String.fromCharCode(u8[i])
  }
  return out
}

function stringToArrayBuffer(text) {
  const s = String(text)
  const arr = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) {
    arr[i] = s.charCodeAt(i) & 0xff
  }
  return arr.buffer
}

/**
 * 扫描并连接 ESP32-S3-CAM，开启特征通知。
 */
async function connectEsp32() {
  await openAdapter()
  const device = await findDevice()
  await connect(device.deviceId)
  await sleep(200)
  const ids = await getServiceAndCharacteristic(device.deviceId)
  await enableNotify(device.deviceId, ids.serviceId, ids.characteristicId)
  return {
    deviceId: device.deviceId,
    serviceId: ids.serviceId,
    characteristicId: ids.characteristicId
  }
}

function disconnect(deviceId) {
  if (!deviceId) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    wx.closeBLEConnection({
      deviceId,
      complete: () => resolve()
    })
  })
}

/** BLE 单次写入常见 ATT MTU 限制，分片发送大数据包 */
const WRITE_CHUNK_SIZE = 20

const MAX_SEND_QUEUE = 64
const MAX_RECV_CACHE = 24
/** 单列队条目中 JSON 最大字符数（双手关键点较长，需放宽上限） */
const MAX_LINE_CHARS = 16384

const sendQueue = []
let recvCache = []

function writeRaw(deviceId, serviceId, characteristicId, arrayBuffer) {
  return new Promise((resolve, reject) => {
    wx.writeBLECharacteristicValue({
      deviceId,
      serviceId,
      characteristicId,
      value: arrayBuffer,
      success: resolve,
      fail: reject
    })
  })
}

/**
 * 按 MTU 分片写入完整字符串（JSON 多为 ASCII）。
 */
function writeText(deviceId, serviceId, characteristicId, text) {
  const u8 = new Uint8Array(stringToArrayBuffer(text))
  const run = async () => {
    for (let offset = 0; offset < u8.length; offset += WRITE_CHUNK_SIZE) {
      const end = Math.min(offset + WRITE_CHUNK_SIZE, u8.length)
      const chunk = u8.slice(offset, end)
      await writeRaw(deviceId, serviceId, characteristicId, chunk.buffer)
      if (end < u8.length) {
        await sleep(8)
      }
    }
  }
  return run()
}

function enqueueSend(line) {
  const raw = String(line)
  const data =
    raw.length > MAX_LINE_CHARS ? raw.slice(0, MAX_LINE_CHARS) : raw
  sendQueue.push({ t: Date.now(), data })
  while (sendQueue.length > MAX_SEND_QUEUE) {
    sendQueue.shift()
  }
}

function getSendQueueLength() {
  return sendQueue.length
}

function flushSendQueue(deviceId, serviceId, characteristicId) {
  if (!deviceId || !serviceId || !characteristicId) {
    return Promise.resolve()
  }
  const drain = async () => {
    while (sendQueue.length > 0) {
      const item = sendQueue[0]
      try {
        await writeText(deviceId, serviceId, characteristicId, item.data)
        sendQueue.shift()
      } catch (e) {
        console.warn('BLE 发送队列阻塞，稍后重试', e)
        break
      }
    }
  }
  return drain()
}

function appendRecvCache(text) {
  const raw = String(text)
  const data = raw.length > 200 ? raw.slice(0, 200) : raw
  recvCache.unshift({ t: Date.now(), data })
  if (recvCache.length > MAX_RECV_CACHE) {
    recvCache = recvCache.slice(0, MAX_RECV_CACHE)
  }
  return recvCache.slice()
}

function getRecvCache() {
  return recvCache.slice()
}

function clearBleCaches() {
  sendQueue.length = 0
  recvCache = []
}

module.exports = {
  DEVICE_NAME,
  SERVICE_UUID,
  CHAR_UUID,
  WRITE_CHUNK_SIZE,
  connectEsp32,
  disconnect,
  writeText,
  enqueueSend,
  flushSendQueue,
  getSendQueueLength,
  appendRecvCache,
  getRecvCache,
  clearBleCaches,
  ab2str,
  openAdapter,
  stopDiscoverySafe
}
