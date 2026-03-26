import cv2
import mediapipe as mp
import numpy as np
import time
import json
import requests
from typing import Tuple, Optional, Dict

class HandDetector:
    def __init__(self, 
                 min_detection_confidence: float = 0.7,
                 min_tracking_confidence: float = 0.5,
                 max_num_hands: int = 2):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=max_num_hands,
            min_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence
        )
        self.mp_draw = mp.solutions.drawing_utils
        
        self.hand_detected = False
        self.last_detection_time = 0
        self.warning_message = ""
        self.no_hand_threshold = 1.0
        
    def detect_hands(self, frame: np.ndarray) -> Tuple[np.ndarray, Dict]:
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.hands.process(frame_rgb)
        
        hand_data = {
            'hands': [],
            'hand_detected': False,
            'gesture': ''
        }
        
        if results.multi_hand_landmarks:
            self.hand_detected = True
            self.last_detection_time = time.time()
            self.warning_message = ""
            
            for idx, hand_landmarks in enumerate(results.multi_hand_landmarks):
                hand_info = self._extract_hand_info(hand_landmarks, frame.shape)
                hand_data['hands'].append(hand_info)
                
                self.mp_draw.draw_landmarks(
                    frame, hand_landmarks, self.mp_hands.HAND_CONNECTIONS
                )
            
            hand_data['hand_detected'] = True
            hand_data['gesture'] = self._recognize_gesture(hand_data['hands'])
        else:
            self._check_hand_out_of_frame()
            hand_data['hand_detected'] = False
            hand_data['warning_message'] = self.warning_message
        
        return frame, hand_data
    
    def _extract_hand_info(self, landmarks, frame_shape) -> Dict:
        height, width = frame_shape[:2]
        
        landmarks_list = []
        for lm in landmarks.landmark:
            landmarks_list.append({
                'x': lm.x,
                'y': lm.y,
                'z': lm.z
            })
        
        return {
            'landmarks': landmarks_list,
            'bbox': self._get_bounding_box(landmarks_list, width, height)
        }
    
    def _get_bounding_box(self, landmarks, width, height) -> Dict:
        x_coords = [lm['x'] for lm in landmarks]
        y_coords = [lm['y'] for lm in landmarks]
        
        x_min = int(min(x_coords) * width)
        x_max = int(max(x_coords) * width)
        y_min = int(min(y_coords) * height)
        y_max = int(max(y_coords) * height)
        
        return {
            'x': x_min,
            'y': y_min,
            'width': x_max - x_min,
            'height': y_max - y_min
        }
    
    def _recognize_gesture(self, hands: list) -> str:
        if not hands:
            return ""
        
        hand = hands[0]
        landmarks = hand['landmarks']
        
        if self._is_open_palm(landmarks):
            return "张开手掌"
        elif self._is_fist(landmarks):
            return "握拳"
        elif self._is_pointing(landmarks):
            return "指向"
        elif self._is_thumbs_up(landmarks):
            return "点赞"
        elif self._is_victory(landmarks):
            return "胜利"
        else:
            return "未知手势"
    
    def _is_open_palm(self, landmarks) -> bool:
        tips = [8, 12, 16, 20]
        bases = [5, 9, 13, 17]
        
        for tip, base in zip(tips, bases):
            if landmarks[tip]['y'] > landmarks[base]['y']:
                return False
        return True
    
    def _is_fist(self, landmarks) -> bool:
        tips = [8, 12, 16, 20]
        bases = [5, 9, 13, 17]
        
        for tip, base in zip(tips, bases):
            if landmarks[tip]['y'] < landmarks[base]['y']:
                return False
        return True
    
    def _is_pointing(self, landmarks) -> bool:
        index_tip = landmarks[8]['y']
        index_base = landmarks[5]['y']
        
        middle_tip = landmarks[12]['y']
        middle_base = landmarks[9]['y']
        
        return (index_tip < index_base) and (middle_tip > middle_base)
    
    def _is_thumbs_up(self, landmarks) -> bool:
        thumb_tip = landmarks[4]['y']
        thumb_base = landmarks[2]['y']
        
        return thumb_tip < thumb_base
    
    def _is_victory(self, landmarks) -> bool:
        index_tip = landmarks[8]['y']
        index_base = landmarks[5]['y']
        
        middle_tip = landmarks[12]['y']
        middle_base = landmarks[9]['y']
        
        ring_tip = landmarks[16]['y']
        ring_base = landmarks[13]['y']
        
        return (index_tip < index_base) and (middle_tip < middle_base) and (ring_tip > ring_base)
    
    def _check_hand_out_of_frame(self):
        current_time = time.time()
        if current_time - self.last_detection_time > self.no_hand_threshold:
            self.hand_detected = False
            self.warning_message = "请将手移至摄像头前"
        else:
            self.warning_message = ""
    
    def get_warning_message(self) -> str:
        return self.warning_message
    
    def is_hand_detected(self) -> bool:
        return self.hand_detected