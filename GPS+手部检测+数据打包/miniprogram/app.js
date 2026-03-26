App({
  globalData: {
    esp32Url: 'http://192.168.1.100',
    isConnected: false,
    currentData: null,
    history: []
  },

  onLaunch() {
    this.loadSettings();
    this.checkConnection();
  },

  loadSettings() {
    try {
      const settings = wx.getStorageSync('settings');
      if (settings) {
        this.globalData.esp32Url = settings.esp32Url || this.globalData.esp32Url;
      }
    } catch (e) {
      console.error('加载设置失败', e);
    }
  },

  saveSettings(settings) {
    try {
      wx.setStorageSync('settings', settings);
      this.globalData.esp32Url = settings.esp32Url || this.globalData.esp32Url;
    } catch (e) {
      console.error('保存设置失败', e);
    }
  },

  checkConnection() {
    const that = this;
    wx.request({
      url: `${this.globalData.esp32Url}/api/status`,
      method: 'GET',
      success(res) {
        that.globalData.isConnected = true;
        console.log('设备连接成功');
      },
      fail(err) {
        that.globalData.isConnected = false;
        console.error('设备连接失败', err);
      }
    });
  },

  addHistory(data) {
    this.globalData.history.unshift(data);
    if (this.globalData.history.length > 50) {
      this.globalData.history.pop();
    }
    
    try {
      wx.setStorageSync('history', this.globalData.history);
    } catch (e) {
      console.error('保存历史记录失败', e);
    }
  },

  loadHistory() {
    try {
      const history = wx.getStorageSync('history');
      if (history) {
        this.globalData.history = history;
      }
    } catch (e) {
      console.error('加载历史记录失败', e);
    }
  }
})