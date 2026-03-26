const app = getApp()

Page({
  data: {
    historyList: []
  },

  onLoad() {
    this.loadHistory()
  },

  onShow() {
    this.loadHistory()
  },

  loadHistory() {
    app.loadHistory()
    this.setData({
      historyList: app.globalData.history
    })
  },

  clearHistory() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有历史记录吗？',
      success(res) {
        if (res.confirm) {
          app.globalData.history = []
          try {
            wx.removeStorageSync('history')
          } catch (e) {
            console.error('清空历史记录失败', e)
          }
          
          wx.showToast({
            title: '已清空',
            icon: 'success'
          })
          
          wx.navigateBack()
        }
      }
    })
  },

  goBack() {
    wx.navigateBack()
  }
})