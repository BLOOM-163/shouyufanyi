# 手部检测模块

## 功能说明

基于OpenCV和MediaPipe实现的手部检测与手势识别系统。

### 核心功能

1. **手部检测**
   - 实时检测画面中的手部
   - 支持双手同时检测
   - 提供手部关键点坐标

2. **手势识别**
   - 张开手掌
   - 握拳
   - 指向
   - 点赞
   - 胜利手势

3. **画面外提示**
   - 当手部移出摄像头画面时，自动生成提示
   - 提示文字："请将手移至摄像头前"

4. **数据通信**
   - 与ESP32进行HTTP通信
   - 发送手部检测数据
   - 接收GPS定位数据

## 安装依赖

```bash
pip install -r requirements.txt
```

## 运行

```bash
python src/main.py
```

## 配置

修改 `src/main.py` 中的配置参数：

```python
system = HandDetectionSystem(
    camera_index=0,              # 摄像头索引
    esp32_url="http://192.168.1.100",  # ESP32地址
    fps_target=30                # 目标帧率
)
```

## 性能要求

- 处理延迟：不超过200ms
- 帧率：30 FPS
- 检测精度：置信度 >= 0.7

## API接口

### 发送数据到ESP32

POST `/api/data`

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

### 从ESP32获取GPS数据

GET `/api/data`

返回GPS和手部检测的完整数据。