# WiFi 通信测试说明

## 为什么这里原来没有代码

`WIFI通信测试` 目录下的文件原本都是空文件，像是先建了结构但还没提交实现，所以你看到 `ble_test.cpp` 打开后没有任何内容。

另外，文件名里用了 `ble_*`，但结合仓库里的 README，这一块更像是 **ESP32 通过 WiFi 做 HTTP 通信测试**。这次我保留了原文件名，避免你还要改工程引用。

## 现在补上的内容

- `ble_config.h`
  - WiFi 测试配置和函数声明
- `ble_core.cpp`
  - ESP32 侧联网、定时心跳上报、串口命令和状态打印
- `ble_test.cpp`
  - Arduino/ESP32 主程序入口
- `test_server.js`
  - 本地 Node.js 测试服务端，用来接收 ESP32 的心跳 JSON
- `test_client.cpp`
  - 简单 HTTP GET 客户端，可从电脑测服务端或 ESP32 端接口

## 使用方法

### 1. 先改 ESP32 配置

编辑 `ble_core.cpp` 里的这几个默认值：

```cpp
"YOUR_WIFI_SSID"
"YOUR_WIFI_PASSWORD"
"192.168.1.100"
3000
```

分别对应：

- WiFi 名称
- WiFi 密码
- 你的电脑或测试服务器 IP
- Node 测试服务端口

## 2. 启动本地测试服务

```bash
cd WIFI通信测试
node test_server.js
```

如果需要换端口：

```bash
PORT=3001 node test_server.js
```

## 3. 刷入 ESP32 测试程序

把 `ble_test.cpp`、`ble_core.cpp`、`ble_config.h` 放进你的 ESP32 Arduino/PlatformIO 工程后编译上传。

串口波特率使用：

```text
115200
```

串口命令：

- `h` 查看帮助
- `s` 查看当前状态
- `p` 立即发送一次心跳
- `r` 强制重连 WiFi

## 4. 用电脑测试 HTTP 接口

编译客户端：

```bash
cd WIFI通信测试
g++ test_client.cpp -std=c++17 -o test_client
```

请求本地测试服务：

```bash
./test_client 127.0.0.1 3000 /ping
```

如果你的 ESP32 自己也开了 HTTP 接口，也可以这样测：

```bash
./test_client ESP32_IP 80 /api/status
```

## 联调成功时你会看到什么

### Node 服务端

会打印类似：

```json
{
  "device": "esp32-wifi-test",
  "uptime_ms": 5234,
  "wifi": {
    "connected": true,
    "ssid": "your-wifi",
    "ip": "192.168.1.88",
    "rssi": -49
  },
  "stats": {
    "connectAttempts": 1,
    "successfulPosts": 2,
    "failedPosts": 0
  }
}
```

### ESP32 串口

会周期性看到：

```text
[WiFiTest] Connected. IP: 192.168.1.88
[WiFiTest] POST http://192.168.1.100:3000/api/report -> 200
```

## 还需要你注意

- 如果你实际想做的是 **BLE 蓝牙通信测试**，那这套代码方向就不对了，需要改成 `BluetoothSerial` 或 NimBLE 方案。
- 如果你想，我下一步也可以继续帮你把这套代码整理成 PlatformIO 完整工程，或者直接改成你项目里真正用的接口格式。
