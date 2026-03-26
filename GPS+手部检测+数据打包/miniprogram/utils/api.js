const app = getApp()

class ApiService {
  constructor() {
    this.baseUrl = app.globalData.esp32Url
    this.timeout = 3000
    this.retryTimes = 3
    this.retryDelay = 1000
  }

  setBaseUrl(url) {
    this.baseUrl = url
  }

  getBaseUrl() {
    return this.baseUrl
  }

  async request(options) {
    const { url, method = 'GET', data = null, timeout = this.timeout } = options
    
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${this.baseUrl}${url}`,
        method,
        data,
        timeout,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data)
          } else {
            reject(new Error(`请求失败: ${res.statusCode}`))
          }
        },
        fail: (err) => {
          reject(err)
        }
      })
    })
  }

  async requestWithRetry(options) {
    let lastError = null
    
    for (let i = 0; i < this.retryTimes; i++) {
      try {
        const result = await this.request(options)
        return result
      } catch (error) {
        lastError = error
        if (i < this.retryTimes - 1) {
          await this.delay(this.retryDelay)
        }
      }
    }
    
    throw lastError
  }

  async getStatus() {
    try {
      return await this.requestWithRetry({
        url: '/api/status',
        method: 'GET'
      })
    } catch (error) {
      console.error('获取状态失败', error)
      throw error
    }
  }

  async getData() {
    try {
      return await this.requestWithRetry({
        url: '/api/data',
        method: 'GET'
      })
    } catch (error) {
      console.error('获取数据失败', error)
      throw error
    }
  }

  async postData(data) {
    try {
      return await this.requestWithRetry({
        url: '/api/data',
        method: 'POST',
        data
      })
    } catch (error) {
      console.error('发送数据失败', error)
      throw error
    }
  }

  async checkConnection() {
    try {
      await this.getStatus()
      return true
    } catch (error) {
      return false
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

module.exports = new ApiService()