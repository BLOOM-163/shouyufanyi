class StorageUtil {
  static set(key, value) {
    try {
      wx.setStorageSync(key, value)
      return true
    } catch (error) {
      console.error('存储数据失败', error)
      return false
    }
  }

  static get(key, defaultValue = null) {
    try {
      return wx.getStorageSync(key) || defaultValue
    } catch (error) {
      console.error('读取数据失败', error)
      return defaultValue
    }
  }

  static remove(key) {
    try {
      wx.removeStorageSync(key)
      return true
    } catch (error) {
      console.error('删除数据失败', error)
      return false
    }
  }

  static clear() {
    try {
      wx.clearStorageSync()
      return true
    } catch (error) {
      console.error('清空存储失败', error)
      return false
    }
  }

  static setInfo(key, value) {
    try {
      wx.setStorage({
        key,
        data: value
      })
      return true
    } catch (error) {
      console.error('异步存储数据失败', error)
      return false
    }
  }

  static getInfo(key) {
    return new Promise((resolve) => {
      try {
        wx.getStorage({
          key,
          success: (res) => {
            resolve(res.data)
          },
          fail: () => {
            resolve(null)
          }
        })
      } catch (error) {
        console.error('异步读取数据失败', error)
        resolve(null)
      }
    })
  }

  static removeInfo(key) {
    return new Promise((resolve) => {
      try {
        wx.removeStorage({
          key,
          success: () => {
            resolve(true)
          },
          fail: () => {
            resolve(false)
          }
        })
      } catch (error) {
        console.error('异步删除数据失败', error)
        resolve(false)
      }
    })
  }
}

module.exports = StorageUtil