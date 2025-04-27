from flask import Flask, Response, jsonify, send_from_directory
import os
import cv2
import mediapipe as mp
import numpy as np
import json
import threading
import time
from flask_cors import CORS
import shutil  # add this import at the top if not there

# Create Flask app
app = Flask(__name__)
CORS(app)

# Ensure saved_frames/ exists
os.makedirs('saved_frames', exist_ok=True)

# Load saved keypoints
with open('./keypoints/hot_to_go-keypoints.json', 'r') as f:
    ground_truth = json.load(f)

print(f"Loaded ground truth frames: {len(ground_truth)}")

mp_pose = mp.solutions.pose
pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)

# Initialize video capture
cap = cv2.VideoCapture(0, cv2.CAP_AVFOUNDATION)

frame_idx = 0
latest_feedback = "Pose Not Detected"
lock = threading.Lock()
processing = False

last_saved_time = 0  # Track frame save timing

def calculate_pose_distance(ground_landmarks, live_landmarks):
    distances = []
    for idx in ground_landmarks.keys():
        ground_point = np.array(ground_landmarks[idx][:2])
        live_point = np.array(live_landmarks[idx][:2])
        dist = np.linalg.norm(ground_point - live_point)
        distances.append(dist)
    return np.mean(distances)

def generate_frames():
    global frame_idx, latest_feedback, last_saved_time
    while True:
        success, frame = cap.read()
        if not success:
            continue

        frame = cv2.flip(frame, 1)

        if processing:
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(frame_rgb)

            feedback_text = "Pose Not Detected"

            if results.pose_landmarks:
                mp.solutions.drawing_utils.draw_landmarks(
                    frame,
                    results.pose_landmarks,
                    mp_pose.POSE_CONNECTIONS
                )

            if results.pose_landmarks and frame_idx < len(ground_truth):
                live_landmarks = {str(j): [lm.x, lm.y, lm.z] for j, lm in enumerate(results.pose_landmarks.landmark)}
                ground_landmarks = ground_truth[frame_idx]

                keypoint_distances = {}
                for idx in ground_landmarks.keys():
                    ground_point = np.array(ground_landmarks[idx][:2])
                    live_point = np.array(live_landmarks[idx][:2])
                    dist = np.linalg.norm(ground_point - live_point)
                    keypoint_distances[int(idx)] = dist

                average_distance = np.mean(list(keypoint_distances.values()))
                match_percent = max(0, 100 - average_distance * 100)

                feedback_issues = []

                def is_off(indexes, threshold=0.7):
                    return any(keypoint_distances.get(i, 0) > threshold for i in indexes)

                if is_off([12, 14, 16]):
                    feedback_issues.append("Move right arm")
                if is_off([11, 13, 15]):
                    feedback_issues.append("Move left arm")
                if is_off([24, 26, 28]):
                    feedback_issues.append("Move right leg")
                if is_off([23, 25, 27]):
                    feedback_issues.append("Move left leg")

                if not feedback_issues and average_distance < 0.5:
                    feedback_text = f"Perfect! Match: {match_percent:.1f}%"
                else:
                    feedback_text = f"{', '.join(feedback_issues)} (Match: {match_percent:.1f}%)"

                frame_idx += 1
            else:
                feedback_text = "Video Ended! Congrats, you're done!" if frame_idx >= len(ground_truth) else "Pose Not Detected"

            with lock:
                latest_feedback = feedback_text

            # 🛠 Save frames ONLY during processing
            now = time.time()
            if now - last_saved_time >= 1.0:
                last_saved_time = now
                filename = f"saved_frames/frame_{int(now)}.jpg"
                cv2.imwrite(filename, frame)
                print(f"Saved frame: {filename}")

        # Stream the frame (always stream, even if not saving)
        ret, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/feedback')
def feedback():
    with lock:
        return jsonify({'feedback': latest_feedback})

@app.route('/start_processing')
def start_processing():
    global processing, frame_idx
    processing = True
    frame_idx = 0
    return jsonify({"status": "started"}), 200

@app.route('/stop_processing')
def stop_processing():
    global processing
    processing = False
    return jsonify({"status": "stopped"}), 200

# 🆕 LIST SAVED FRAMES API
@app.route('/list_saved_frames')
def list_saved_frames():
    try:
        frames = sorted(os.listdir('saved_frames'))
        frame_urls = [f"/saved_frames/{frame}" for frame in frames if frame.endswith('.jpg')]
        return jsonify({'frames': frame_urls}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 🆕 SERVE SAVED FRAMES
@app.route('/saved_frames/<path:filename>')
def serve_saved_frame(filename):
    folder = os.path.abspath('saved_frames')
    return send_from_directory(folder, filename)

# 🆕 CLEAR SAVED FRAMES
@app.route('/clear_saved_frames')
def clear_saved_frames():
    folder = 'saved_frames'
    try:
        if os.path.exists(folder):
            shutil.rmtree(folder)  # delete whole folder
        os.makedirs(folder)        # recreate fresh empty folder
        print("✅ saved_frames cleared successfully!")
        return jsonify({"status": "cleared"}), 200
    except Exception as e:
        print(f'Failed to clear saved_frames. Reason: {e}')
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, threaded=True)
