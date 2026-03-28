import cv2
import time
import json
import requests
import threading
from hand_detector import HandDetector
from typing import Dict, Optional

class HandDetectionSystem:
    def __init__(self, 
                 camera_index: int = 0,
                 esp32_url: str = "http://192.168.1.100",
                 fps_target: int = 30):
        self.camera_index = camera_index
        self.esp32_url = esp32_url
        self.fps_target = fps_target
        self.frame_time = 1.0 / fps_target
        
        self.detector = HandDetector(
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5,
            max_num_hands=2
        )
        
        self.cap = None
        self.running = False
        self.current_data = {}
        self.last_send_time = 0
        self.send_interval = 0.5
        self._fps_smooth = 0.0
        
    def initialize_camera(self) -> bool:
        try:
            self.cap = cv2.VideoCapture(self.camera_index)
            if not self.cap.isOpened():
                print("无法打开摄像头")
                return False
            
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.cap.set(cv2.CAP_PROP_FPS, self.fps_target)
            
            print(f"摄像头已初始化: {self.camera_index}")
            return True
        except Exception as e:
            print(f"摄像头初始化失败: {e}")
            return False
    
    def send_data_to_esp32(self, data: Dict):
        try:
            url = f"{self.esp32_url}/api/data"
            headers = {'Content-Type': 'application/json'}
            
            response = requests.post(url, json=data, headers=headers, timeout=1.0)
            
            if response.status_code == 200:
                print("数据发送成功")
            else:
                print(f"数据发送失败: {response.status_code}")
                
        except requests.exceptions.Timeout:
            print("ESP32连接超时")
        except requests.exceptions.ConnectionError:
            print("无法连接到ESP32")
        except Exception as e:
            print(f"发送数据时出错: {e}")
    
    def get_gps_data_from_esp32(self) -> Optional[Dict]:
        try:
            url = f"{self.esp32_url}/api/data"
            response = requests.get(url, timeout=1.0)
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"获取GPS数据失败: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"获取GPS数据时出错: {e}")
            return None
    
    def process_frame(self, frame):
        start_time = time.time()
        
        frame, hand_data = self.detector.detect_hands(frame)
        
        elapsed_proc = time.time() - start_time
        inst_fps = 1.0 / elapsed_proc if elapsed_proc > 1e-6 else 0.0
        if self._fps_smooth <= 0.0:
            self._fps_smooth = inst_fps
        else:
            self._fps_smooth = self._fps_smooth * 0.85 + inst_fps * 0.15

        hands = hand_data.get('hands') or []
        primary = hands[0] if hands else None
        landmarks_out = list(primary.get('landmarks', [])) if primary else []
        handedness_out = primary.get('handedness', '') if primary else ''

        hands_payload = []
        for h in hands:
            bb = h.get('bbox') or {}
            lm = h.get('landmarks') or []
            hands_payload.append({
                'handedness': h.get('handedness', ''),
                'landmarks': [{'x': p['x'], 'y': p['y'], 'z': p['z']} for p in lm],
                'bbox': {
                    'x': bb.get('x', 0),
                    'y': bb.get('y', 0),
                    'width': bb.get('width', 0),
                    'height': bb.get('height', 0),
                },
            })

        self.current_data = {
            'hand': {
                'gestureText': hand_data.get('gesture', ''),
                'handDetected': hand_data.get('hand_detected', False),
                'warningMessage': self.detector.get_warning_message(),
                'timestamp': int(time.time() * 1000),
                'handedness': handedness_out,
                'landmarks': landmarks_out,
                'fps': round(self._fps_smooth, 2),
            },
            'hands': hands_payload,
        }
        
        current_time = time.time()
        if current_time - self.last_send_time >= self.send_interval:
            self.last_send_time = current_time
            self.send_data_to_esp32(self.current_data)
        
        elapsed = time.time() - start_time
        if elapsed < self.frame_time:
            time.sleep(self.frame_time - elapsed)
        
        return frame, hand_data
    
    def run(self):
        if not self.initialize_camera():
            return
        
        self.running = True
        print("手部检测系统启动")
        
        try:
            while self.running:
                ret, frame = self.cap.read()
                if not ret:
                    print("无法读取摄像头画面")
                    break
                
                frame, hand_data = self.process_frame(frame)
                
                cv2.imshow('Hand Detection', frame)
                
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
                    
        except KeyboardInterrupt:
            print("\n用户中断")
        except Exception as e:
            print(f"运行时错误: {e}")
        finally:
            self.cleanup()
    
    def cleanup(self):
        self.running = False
        if self.cap:
            self.cap.release()
        cv2.destroyAllWindows()
        print("系统已关闭")
    
    def get_current_data(self) -> Dict:
        return self.current_data

def main():
    system = HandDetectionSystem(
        camera_index=0,
        esp32_url="http://192.168.1.100",
        fps_target=30
    )
    
    system.run()

if __name__ == "__main__":
    main()