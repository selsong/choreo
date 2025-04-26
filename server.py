from flask import Flask, Response, jsonify
import cv2
import mediapipe as mp
import numpy as np
import json
import time

app = Flask(__name__)

# Load ground truth keypoints
with open('keypoints/hottogo-keypoints.json', 'r') as f:
    ground_truth = json.load(f)

mp_pose = mp.solutions.pose
pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)

def calculate_pose_distance(ground_landmarks, live_landmarks):
    distances = []
    for idx in ground_landmarks.keys():
        ground_point = np.array(ground_landmarks[idx][:2])  # just (x, y)
        live_point = np.array(live_landmarks[idx][:2])
        dist = np.linalg.norm(ground_point - live_point)
        distances.append(dist)
    return np.mean(distances)

def generate_frames():
    cap = cv2.VideoCapture(0)
    frame_idx = 0

    while True:
        success, frame = cap.read()
        if not success:
            break

        # Process frame with MediaPipe
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(frame_rgb)

        feedback = "Pose Not Detected"
        if results.pose_landmarks and frame_idx < len(ground_truth):
            live_landmarks = {str(j): [lm.x, lm.y, lm.z] for j, lm in enumerate(results.pose_landmarks.landmark)}
            ground_landmarks = ground_truth[frame_idx]
            
            distance = calculate_pose_distance(ground_landmarks, live_landmarks)
            
            if distance < 0.1:
                feedback = "Perfect!"
            else:
                feedback = "Adjust a bit!"
            
            frame_idx += 1
        else:
            feedback = "No More Frames!" if frame_idx >= len(ground_truth) else "Pose Not Detected"

        # Draw feedback on frame
        cv2.putText(frame, feedback, (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        # Convert frame to JPEG
        ret, buffer = cv2.imencode('.jpg', frame)
        frame = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    app.run(debug=True, port=5000) 