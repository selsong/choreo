import cv2
import mediapipe as mp
import numpy as np
import json
import time

# Load saved keypoints (your Hot To Go dance!)
with open('keypoints/hottogo-keypoints.json', 'r') as f:
    ground_truth = json.load(f)

mp_pose = mp.solutions.pose
pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)

# Initialize video capture with explicit backend
cap = cv2.VideoCapture(0, cv2.CAP_AVFOUNDATION)  # Use AVFoundation for macOS

frame_idx = 0  # To track where we are in the ground-truth dance

def calculate_pose_distance(ground_landmarks, live_landmarks):
    distances = []
    for idx in ground_landmarks.keys():
        ground_point = np.array(ground_landmarks[idx][:2])  # just (x, y)
        live_point = np.array(live_landmarks[idx][:2])
        dist = np.linalg.norm(ground_point - live_point)
        distances.append(dist)
    return np.mean(distances)

while cap.isOpened():
    success, frame = cap.read()
    if not success:
        print("Ignoring empty camera frame.")
        continue

    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = pose.process(frame_rgb)

    feedback_text = "Pose Not Detected"

    if results.pose_landmarks:
        # 💥 Draw the keypoints and connections onto the frame!
        mp.solutions.drawing_utils.draw_landmarks(
            frame, 
            results.pose_landmarks, 
            mp_pose.POSE_CONNECTIONS)
        
    if results.pose_landmarks and frame_idx < len(ground_truth):
        live_landmarks = {str(j): [lm.x, lm.y, lm.z] for j, lm in enumerate(results.pose_landmarks.landmark)}
        ground_landmarks = ground_truth[frame_idx]

        distance = calculate_pose_distance(ground_landmarks, live_landmarks)

        if distance < 0.1:
            feedback_text = "Perfect!"
        else:
            feedback_text = "Adjust a bit!"

        frame_idx += 1
    else:
        feedback_text = "No More Frames!" if frame_idx >= len(ground_truth) else "Pose Not Detected"

    cv2.putText(frame, feedback_text, (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    cv2.imshow('DanceBuddy Live Feedback', frame)

    if cv2.waitKey(5) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()
