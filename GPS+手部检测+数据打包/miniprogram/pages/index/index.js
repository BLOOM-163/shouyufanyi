const app = getApp()
const esp32Ble = require('../../utils/esp32Ble.js')

/**
 * 地图 / 定位说明（按需求注明 SDK 类型）：
 * - 本机经纬度使用「微信小程序官方定位 API」wx.getLocation，坐标类型 gcj02（国测局 / 腾讯地图等同体系）。
 * - 未集成高德地图 Android/iOS SDK、百度地图 SDK 等第三方地图原生 SDK；若需地图组件可另行对接。
 */

Page({
  data: {
    isConnected: false,
    gestureText: '',
    handDetected: false,
    warningMessage: '',
    handedness: '',
    handFps: '',
    gpsData: {
      latitude: 0,
      longitude: 0,
      altitude: 0,
      speed: 0,
      valid: false
    },
    phoneGps: {
      latitude: '',
      longitude: '',
      accuracy: '',
      errMsg: ''
    },
    locationApiNote:
      '微信小程序官方定位 API（GCJ-02），非高德/百度地图原生 SDK',
    bleConnected: false,
    bleStatus: '未连接',
    bleLastRecv: '',
    bleRecvList: [],
    bleSendQueueLen: 0,
    handsCount: 0,
    handsSummary: '',
    updateTime: '',
    timer: null
  },

  bleDeviceId: null,
  bleServiceId: null,
  bleCharId: null,

  onLoad() {
    const that = this
    this._bleConnHandler = (res) => {
      if (!that.bleDeviceId || res.deviceId !== that.bleDeviceId) return
      if (!res.connected) {
        that.bleDeviceId = null
        that.bleServiceId = null
        that.bleCharId = null
        that.setData({
          bleConnected: false,
          bleStatus: '已断开，可重试连接'
        })
      }
    }
    this._bleValueHandler = (res) => {
      if (!that.bleDeviceId || res.deviceId !== that.bleDeviceId) return
      const text = esp32Ble.ab2str(res.value)
      const list = esp32Ble.appendRecvCache(text)
      that.setData({
        bleLastRecv: list.length ? list[0].data : '',
        bleRecvList: list.slice(0, 10)
      })
    }
    wx.onBLEConnectionStateChange(this._bleConnHandler)
    wx.onBLECharacteristicValueChange(this._bleValueHandler)
    this.checkConnection()
    this.startDataUpdate()
    this.updatePhoneLocation(false)
  },

  onUnload() {
    if (this._bleConnHandler) {
      wx.offBLEConnectionStateChange(this._bleConnHandler)
    }
    if (this._bleValueHandler) {
      wx.offBLECharacteristicValueChange(this._bleValueHandler)
    }
    this.stopDataUpdate()
    if (this.bleDeviceId) {
      esp32Ble.disconnect(this.bleDeviceId).catch(() => {})
    }
  },

  onShow() {
    this.checkConnection()
  },

  checkConnection() {
    const that = this
    wx.request({
      url: `${app.globalData.esp32Url}/api/status`,
      method: 'GET',
      timeout: 3000,
      success(res) {
        if (res.statusCode === 200) {
          that.setData({
            isConnected: true
          })
          app.globalData.isConnected = true
        } else {
          that.setData({
            isConnected: false
          })
          app.globalData.isConnected = false
        }
      },
      fail(err) {
        that.setData({
          isConnected: false
        })
        app.globalData.isConnected = false
        console.error('连接检查失败', err)
      }
    })
  },

  refreshData() {
    wx.showLoading({
      title: '刷新中...'
    })
    
    this.checkConnection()
    this.fetchData()
    this.updatePhoneLocation(false)
    
    setTimeout(() => {
      wx.hideLoading()
    }, 1000)
  },

  refreshPhoneLocationTap() {
    this.updatePhoneLocation(true)
  },

  updatePhoneLocation(showModalOnDeny) {
    const that = this
    wx.getSetting({
      success(settingRes) {
        if (settingRes.authSetting['scope.userLocation']) {
          that._doGetLocation()
          return
        }
        wx.authorize({
          scope: 'scope.userLocation',
          success() {
            that._doGetLocation()
          },
          fail() {
            if (showModalOnDeny) {
              wx.showModal({
                title: '需要位置权限',
                content: '请在设置中允许小程序使用位置信息，以获取本机 GPS。',
                showCancel: false
              })
            }
            that.setData({
              phoneGps: {
                latitude: '',
                longitude: '',
                accuracy: '',
                errMsg: '未授权位置权限'
              }
            })
          }
        })
      },
      fail() {
        that._doGetLocation()
      }
    })
  },

  _doGetLocation() {
    const that = this
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      highAccuracyExpireTime: 4000,
      success(res) {
        that.setData({
          phoneGps: {
            latitude: Number(res.latitude).toFixed(6),
            longitude: Number(res.longitude).toFixed(6),
            accuracy:
              res.horizontalAccuracy != null
                ? String(res.horizontalAccuracy)
                : res.accuracy != null
                  ? String(res.accuracy)
                  : '',
            errMsg: ''
          }
        })
      },
      fail(err) {
        that.setData({
          phoneGps: {
            latitude: '',
            longitude: '',
            accuracy: '',
            errMsg: err.errMsg || '定位失败'
          }
        })
      }
    })
  },

  connectBle() {
    const that = this
    wx.showLoading({ title: '连接蓝牙…' })
    esp32Ble
      .connectEsp32()
      .then((conn) => {
        that.bleDeviceId = conn.deviceId
        that.bleServiceId = conn.serviceId
        that.bleCharId = conn.characteristicId
        that.setData({
          bleConnected: true,
          bleStatus: '已连接 ' + esp32Ble.DEVICE_NAME
        })
        esp32Ble
          .flushSendQueue(that.bleDeviceId, that.bleServiceId, that.bleCharId)
          .then(() => {
            that.setData({ bleSendQueueLen: esp32Ble.getSendQueueLength() })
          })
          .catch(() => {
            that.setData({ bleSendQueueLen: esp32Ble.getSendQueueLength() })
          })
        wx.showToast({ title: '蓝牙已连接', icon: 'success' })
      })
      .catch((e) => {
        const msg =
          (e && (e.errMsg || e.message)) ? (e.errMsg || e.message) : '连接失败'
        that.setData({
          bleConnected: false,
          bleStatus: '连接失败'
        })
        wx.showToast({
          title: msg,
          icon: 'none',
          duration: 2500
        })
      })
      .then(() => {
        wx.hideLoading()
      })
  },

  disconnectBle() {
    const id = this.bleDeviceId
    this.bleDeviceId = null
    this.bleServiceId = null
    this.bleCharId = null
    esp32Ble
      .disconnect(id)
      .then(() => {
        this.setData({
          bleConnected: false,
          bleStatus: '已断开'
        })
      })
      .catch(() => {
        this.setData({
          bleConnected: false,
          bleStatus: '已断开'
        })
      })
  },

  _syncBleQueueUi() {
    this.setData({
      bleSendQueueLen: esp32Ble.getSendQueueLength()
    })
  },

  /**
   * 蓝牙发送：入队缓存 + 已连接时尽力Drain（大包已 MTU 分片）。
   */
  _queueBlePayload(serverData) {
    const payload = {
      ts: Date.now(),
      hand: serverData.hand || {},
      hands: serverData.hands || []
    }
    const line = JSON.stringify(payload) + '\n'
    esp32Ble.enqueueSend(line)
    this._syncBleQueueUi()
    if (this.bleDeviceId && this.bleServiceId && this.bleCharId) {
      esp32Ble
        .flushSendQueue(this.bleDeviceId, this.bleServiceId, this.bleCharId)
        .then(() => this._syncBleQueueUi())
        .catch(() => this._syncBleQueueUi())
    }
  },

  fetchData() {
    const that = this
    wx.request({
      url: `${app.globalData.esp32Url}/api/data`,
      method: 'GET',
      timeout: 3000,
      success(res) {
        if (res.statusCode === 200 && res.data) {
          const data = res.data
          
          const handData = data.hand || {}
          const gpsInfo = data.gps || {}
          const handsArr = data.hands || []
          const handsSummary = handsArr.length
            ? handsArr.map((h) => h.handedness || '?').join(' + ')
            : '无'

          that.setData({
            gestureText: handData.gestureText || '',
            handDetected: handData.handDetected || false,
            warningMessage: handData.warningMessage || '',
            handedness: handData.handedness || '',
            handFps:
              handData.fps !== undefined && handData.fps !== null
                ? String(handData.fps)
                : '',
            handsCount: handsArr.length,
            handsSummary,
            gpsData: {
              latitude: gpsInfo.latitude ? gpsInfo.latitude.toFixed(6) : 0,
              longitude: gpsInfo.longitude ? gpsInfo.longitude.toFixed(6) : 0,
              altitude: gpsInfo.altitude ? gpsInfo.altitude.toFixed(1) : 0,
              speed: gpsInfo.speed ? gpsInfo.speed.toFixed(1) : 0,
              valid: gpsInfo.valid || false
            },
            updateTime: that.formatTime(new Date())
          })
          
          app.globalData.currentData = data

          that._queueBlePayload(data)
          
          if (handData.gestureText) {
            app.addHistory({
              gesture: handData.gestureText,
              gps: gpsInfo,
              time: that.formatTime(new Date())
            })
          }
        }
      },
      fail(err) {
        console.error('获取数据失败', err)
        wx.showToast({
          title: '获取数据失败',
          icon: 'none'
        })
      }
    })
  },

  startDataUpdate() {
    this.fetchData()
    this.updatePhoneLocation(false)
    this.data.timer = setInterval(() => {
      this.fetchData()
      this.updatePhoneLocation(false)
    }, 2000)
  },

  stopDataUpdate() {
    if (this.data.timer) {
      clearInterval(this.data.timer)
      this.setData({
        timer: null
      })
    }
  },

  viewHistory() {
    wx.navigateTo({
      url: '/pages/result/result'
    })
  },

  openSettings() {
    wx.showModal({
      title: '设置',
      content: '当前设备地址: ' + app.globalData.esp32Url,
      editable: true,
      placeholderText: '请输入设备IP地址',
      success(res) {
        if (res.confirm && res.content) {
          app.saveSettings({
            esp32Url: res.content
          })
          wx.showToast({
            title: '设置已保存',
            icon: 'success'
          })
        }
      }
    })
  },

  formatTime(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }
})