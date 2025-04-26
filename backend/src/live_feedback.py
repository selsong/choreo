# import cv2
# import mediapipe as mp
# import numpy as np
# import json
# import time

# # Load saved keypoints (your Hot To Go dance!)
# with open('keypoints/hottogo-keypoints.json', 'r') as f:
#     ground_truth = json.load(f)

# mp_pose = mp.solutions.pose
# pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)

# # Initialize video capture with explicit backend
# cap = cv2.VideoCapture(0, cv2.CAP_AVFOUNDATION)  # Use AVFoundation for macOS

# frame_idx = 0  # To track where we are in the ground-truth dance

# def calculate_pose_distance(ground_landmarks, live_landmarks):
#     distances = []
#     for idx in ground_landmarks.keys():
#         ground_point = np.array(ground_landmarks[idx][:2])  # just (x, y)
#         live_point = np.array(live_landmarks[idx][:2])
#         dist = np.linalg.norm(ground_point - live_point)
#         distances.append(dist)
#     return np.mean(distances)

# while cap.isOpened():
#     success, frame = cap.read()
#     if not success:
#         print("Ignoring empty camera frame.")
#         continue

#     frame = cv2.flip(frame, 1)

#     frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
#     results = pose.process(frame_rgb)

#     feedback_text = "Pose Not Detected"

#     if results.pose_landmarks:
#         # 💥 Draw the keypoints and connections onto the frame!
#         mp.solutions.drawing_utils.draw_landmarks(
#             frame, 
#             results.pose_landmarks, 
#             mp_pose.POSE_CONNECTIONS)
        
#     if results.pose_landmarks and frame_idx < len(ground_truth):
#         live_landmarks = {str(j): [lm.x, lm.y, lm.z] for j, lm in enumerate(results.pose_landmarks.landmark)}
#         ground_landmarks = ground_truth[frame_idx]

#         distance = calculate_pose_distance(ground_landmarks, live_landmarks)

#         if distance < 0.1:
#             feedback_text = "Perfect!"
#         else:
#             feedback_text = "Adjust a bit!"

#         frame_idx += 1
#     else:
#         feedback_text = "No More Frames!" if frame_idx >= len(ground_truth) else "Pose Not Detected"

#     cv2.putText(frame, feedback_text, (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
#     cv2.imshow('Dance Live Feedback', frame)

#     if cv2.waitKey(5) & 0xFF == 27:
#         break

# cap.release()
# cv2.destroyAllWindows()

from flask import Flask, Response, jsonify
import cv2
import mediapipe as mp
import numpy as np
import json
import threading
from flask_cors import CORS


# Create Flask app
app = Flask(__name__)
CORS(app)

# Load saved keypoints
with open('./keypoints/hot_to_go-keypoints.json', 'r') as f:
    ground_truth = json.load(f)

print(f"Loaded ground truth frames: {len(ground_truth)}")

mp_pose = mp.solutions.pose
pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)

# Initialize video capture
cap = cv2.VideoCapture(0, cv2.CAP_AVFOUNDATION)  # or just cv2.VideoCapture(0) on Windows

frame_idx = 0  # To track where we are in the ground-truth dance
latest_feedback = "Pose Not Detected"
lock = threading.Lock()

def calculate_pose_distance(ground_landmarks, live_landmarks):
    distances = []
    for idx in ground_landmarks.keys():
        ground_point = np.array(ground_landmarks[idx][:2])
        live_point = np.array(live_landmarks[idx][:2])
        dist = np.linalg.norm(ground_point - live_point)
        distances.append(dist)
    return np.mean(distances)

processing = False

def generate_frames():
    global frame_idx, latest_feedback
    while True:
        success, frame = cap.read()
        if not success:
            continue

        frame = cv2.flip(frame, 1)  # Mirror the webcam for natural feel

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

            # if results.pose_landmarks and frame_idx < len(ground_truth):
            #     live_landmarks = {str(j): [lm.x, lm.y, lm.z] for j, lm in enumerate(results.pose_landmarks.landmark)}
            #     ground_landmarks = ground_truth[frame_idx]

            #     distance = calculate_pose_distance(ground_landmarks, live_landmarks)

            #     if distance < 0.3: # lowkey need to change this
            #         feedback_text = "Perfect!"
            #     else:
            #         feedback_text = "Adjust a bit!"

            #     frame_idx += 1
            #detect specific limbs that are off
            if results.pose_landmarks and frame_idx < len(ground_truth):
                live_landmarks = {str(j): [lm.x, lm.y, lm.z] for j, lm in enumerate(results.pose_landmarks.landmark)}
                ground_landmarks = ground_truth[frame_idx]

                # Calculate distance for each keypoint
                keypoint_distances = {}
                for idx in ground_landmarks.keys():
                    ground_point = np.array(ground_landmarks[idx][:2])
                    live_point = np.array(live_landmarks[idx][:2])
                    dist = np.linalg.norm(ground_point - live_point)
                    keypoint_distances[int(idx)] = dist

                # Overall average distance
                average_distance = np.mean(list(keypoint_distances.values()))
                match_percent = max(0, 100 - average_distance * 100)

                # Detailed limb feedback
                feedback_issues = []

                def is_off(indexes, threshold=0.7):  # You can tweak threshold
                    return any(keypoint_distances.get(i, 0) > threshold for i in indexes)

                if is_off([12, 14, 16]):  # Right arm
                    feedback_issues.append("Move right arm")
                if is_off([11, 13, 15]):  # Left arm
                    feedback_issues.append("Move left arm")
                if is_off([24, 26, 28]):  # Right leg
                    feedback_issues.append("Move right leg")
                if is_off([23, 25, 27]):  # Left leg
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

            # Draw feedback text on frame
            # cv2.putText(frame, feedback_text, (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        # Encode frame as JPEG
        ret, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()

        # Stream frame
        yield (b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/feedback')
def feedback():
    with lock:
        return jsonify({'feedback': latest_feedback})

@app.route('/start_processing')
def start_processing():
    global processing, frame_idx
    processing = True
    frame_idx = 0  # reset when starting!
    return jsonify({"status": "started"}), 200

@app.route('/stop_processing')
def stop_processing():
    global processing
    processing = False
    return jsonify({"status": "stopped"}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, threaded=True)