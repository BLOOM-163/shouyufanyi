class ErrorHandler {
  static handle(error, context = '') {
    console.error(`${context} 错误:`, error)
    
    let message = '操作失败'
    
    if (error.errMsg) {
      if (error.errMsg.includes('timeout')) {
        message = '请求超时，请检查网络连接'
      } else if (error.errMsg.includes('fail')) {
        message = '网络请求失败，请检查设备连接'
      } else if (error.errMsg.includes('abort')) {
        message = '请求被取消'
      }
    } else if (error.message) {
      message = error.message
    }
    
    return message
  }

  static showToast(message, icon = 'none') {
    wx.showToast({
      title: message,
      icon,
      duration: 2000
    })
  }

  static showModal(title, content, showCancel = true) {
    return new Promise((resolve) => {
      wx.showModal({
        title,
        content,
        showCancel,
        success: (res) => {
          resolve(res.confirm)
        },
        fail: () => {
          resolve(false)
        }
      })
    })
  }

  static showLoading(title = '加载中...') {
    wx.showLoading({
      title,
      mask: true
    })
  }

  static hideLoading() {
    wx.hideLoading()
  }

  static async withTryCatch(asyncFn, context = '') {
    try {
      this.showLoading()
      const result = await asyncFn()
      this.hideLoading()
      return { success: true, data: result }
    } catch (error) {
      this.hideLoading()
      const message = this.handle(error, context)
      this.showToast(message)
      return { success: false, error: message }
    }
  }
}

module.exports = ErrorHandler