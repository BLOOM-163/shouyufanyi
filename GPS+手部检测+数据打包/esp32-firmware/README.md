# ESP32固件说明

## 硬件连接

### GPS模块连接
- RX: GPIO 16
- TX: GPIO 17
- VCC: 3.3V
- GND: GND

## 功能说明

### GPS模块
- 实时获取GPS定位数据
- 解析NMEA数据
- 提供经纬度、海拔、速度等信息
- 数据有效性校验

### 数据通信
- WiFi连接
- HTTP服务器
- RESTful API接口
- JSON数据格式

### API接口

#### GET /
返回系统状态页面

#### GET /api/data
获取当前GPS和手部检测数据

#### POST /api/data
接收手部检测数据

#### GET /api/status
获取系统状态信息

## 编译上传

1. 安装PlatformIO
2. 打开项目目录
3. 运行 `pio run` 编译
4. 运行 `pio run --target upload` 上传

## 配置

修改 `main.cpp` 中的WiFi配置：
```cpp
#define WIFI_SSID "YourWiFiSSID"
#define WIFI_PASSWORD "YourWiFiPassword"
```