# 手语翻译微信小程序项目

## 项目概述

这是一个基于ESP32、OpenCV和微信小程序的手语翻译系统，实现手语识别、GPS定位和实时数据传输功能。

## 系统架构

```
├── esp32-firmware/          # ESP32固件
│   ├── src/                 # 源代码
│   │   ├── main.cpp        # 主程序
│   │   ├── gps_module.cpp  # GPS模块
│   │   └── data_packet.cpp # 数据打包
│   ├── include/            # 头文件
│   │   ├── gps_module.h
│   │   └── data_packet.h
│   ├── lib/               # 库文件
│   ├── platformio.ini     # PlatformIO配置
│   └── README.md          # ESP32说明
│
├── hand-detection/         # 手部检测模块
│   ├── src/
│   │   ├── main.py        # 主程序
│   │   └── hand_detector.py # 手部检测器
│   ├── models/            # 模型文件
│   ├── requirements.txt   # Python依赖
│   └── README.md          # 手部检测说明
│
└── miniprogram/           # 微信小程序
    ├── pages/             # 页面
    │   ├── index/         # 首页
    │   └── result/        # 结果页
    ├── utils/             # 工具类
    │   ├── api.js         # API接口
    │   ├── errorHandler.js # 错误处理
    │   └── storage.js     # 存储工具
    ├── components/        # 组件
    ├── app.js             # 小程序逻辑
    ├── app.json           # 小程序配置
    ├── app.wxss           # 全局样式
    ├── project.config.json # 项目配置
    └── sitemap.json       # 站点地图
```

## 核心功能

### 1. ESP32固件
- **GPS定位**: 实时获取GPS数据（经纬度、海拔、速度）
- **WiFi通信**: 建立HTTP服务器，提供RESTful API
- **数据打包**: JSON格式数据打包与校验
- **异常处理**: 设备连接中断、数据获取失败等异常处理

### 2. 手部检测模块
- **手部识别**: 基于MediaPipe实现手部关键点检测
- **手势识别**: 支持张开手掌、握拳、指向、点赞、胜利等手势
- **实时性**: 处理延迟不超过200ms，帧率30 FPS
- **画面外提示**: 当手部移出画面时生成"请将手移至摄像头前"提示

### 3. 微信小程序
- **数据展示**: 实时显示手语识别结果和GPS定位信息
- **历史记录**: 保存和查看历史识别记录
- **设置管理**: 设备连接配置
- **异常处理**: 网络超时、连接失败等异常处理

## 技术栈

### ESP32固件
- Arduino Framework
- TinyGPSPlus (GPS解析)
- ArduinoJson (JSON处理)
- WiFi (ESP32 WiFi库)

### 手部检测
- Python 3.8+
- OpenCV 4.8+
- MediaPipe 0.10+
- NumPy
- Requests

### 微信小程序
- WXML (页面结构)
- WXSS (页面样式)
- JavaScript (逻辑处理)
- 微信小程序API

## 安装与部署

### ESP32固件

1. 安装PlatformIO
2. 配置WiFi连接（修改 `esp32-firmware/src/main.cpp`）
3. 编译并上传固件
```bash
cd esp32-firmware
pio run
pio run --target upload
```

### 手部检测模块

1. 安装Python依赖
```bash
cd hand-detection
pip install -r requirements.txt
```

2. 配置ESP32地址（修改 `hand-detection/src/main.py`）
3. 运行程序
```bash
python src/main.py
```

### 微信小程序

1. 使用微信开发者工具打开 `miniprogram` 目录
2. 配置AppID（修改 `miniprogram/project.config.json`）
3. 配置ESP32地址（在应用设置中）
4. 编译并预览

## API接口

### ESP32 API

#### GET /api/status
获取系统状态

**响应示例**:
```json
{
  "wifi_connected": true,
  "gps_valid": true,
  "gps_lat": 39.9042,
  "gps_lon": 116.4074,
  "uptime": 3600
}
```

#### GET /api/data
获取GPS和手部检测数据

**响应示例**:
```json
{
  "gps": {
    "latitude": 39.9042,
    "longitude": 116.4074,
    "altitude": 50.0,
    "speed": 0.0,
    "valid": true,
    "timestamp": 1679012345678
  },
  "hand": {
    "gestureText": "张开手掌",
    "handDetected": true,
    "warningMessage": "",
    "timestamp": 1679012345678
  },
  "checksum": "abc123..."
}
```

#### POST /api/data
接收手部检测数据

**请求示例**:
```json
{
  "hand": {
    "gestureText": "张开手掌",
    "handDetected": true,
    "warningMessage": "",
    "timestamp": 1679012345678
  }
}
```

## 性能指标

- **手部检测延迟**: ≤ 200ms
- **GPS定位精度**: ≤ 10米
- **数据传输频率**: 2秒/次
- **系统响应时间**: ≤ 1秒

## 硬件要求

### ESP32
- ESP32开发板
- GPS模块（如NEO-6M）
- USB数据线

### 手部检测
- 摄像头（USB或内置）
- 计算机（支持OpenCV）

### 微信小程序
- 微信开发者工具
- 测试设备（手机）

## 注意事项

1. **网络配置**: 确保ESP32和手部检测设备在同一局域网
2. **GPS信号**: GPS模块需要在室外或窗边使用
3. **摄像头权限**: 手部检测程序需要摄像头访问权限
4. **小程序权限**: 微信小程序需要网络访问权限

## 故障排除

### ESP32连接失败
- 检查WiFi配置是否正确
- 确认ESP32和设备在同一网络
- 检查防火墙设置

### GPS无信号
- 移至室外或窗边
- 检查GPS模块连接
- 等待GPS初始化（约30秒）

### 手部检测失败
- 检查摄像头是否正常工作
- 确保光线充足
- 调整摄像头角度

### 小程序无法连接
- 检查ESP32地址配置
- 确认网络连接正常
- 查看控制台错误信息

## 开发规范

### 代码风格
- 遵循各语言的最佳实践
- 使用有意义的变量名
- 添加必要的注释

### 数据格式
- 统一使用JSON格式
- 包含时间戳字段
- 数据校验机制

### 错误处理
- 捕获所有异常
- 提供友好的错误提示
- 记录错误日志

## 许可证

MIT License

## 联系方式

如有问题或建议，请联系项目维护者。