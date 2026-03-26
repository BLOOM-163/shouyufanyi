const app = getApp()

Page({
  data: {
    isConnected: false,
    gestureText: '',
    handDetected: false,
    warningMessage: '',
    gpsData: {
      latitude: 0,
      longitude: 0,
      altitude: 0,
      speed: 0,
      valid: false
    },
    updateTime: '',
    timer: null
  },

  onLoad() {
    this.checkConnection()
    this.startDataUpdate()
  },

  onUnload() {
    this.stopDataUpdate()
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
    
    setTimeout(() => {
      wx.hideLoading()
    }, 1000)
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
          
          that.setData({
            gestureText: handData.gestureText || '',
            handDetected: handData.handDetected || false,
            warningMessage: handData.warningMessage || '',
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
    this.data.timer = setInterval(() => {
      this.fetchData()
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