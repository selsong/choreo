from flask import Flask, Response, jsonify
import cv2
import mediapipe as mp
import numpy as np
import json
import threading
from flask_cors import CORS
import time


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
    """
    Generates a sequence of frames from the webcam, with live feedback text superimposed
    on the video. The feedback text is based on the similarity between the user's pose and the
    ground truth dance. The function runs in its own thread, and the frames are yielded as a
    sequence of JPEG images.

    If the user is not detected (i.e. no pose is detected), the feedback text is "Pose Not Detected".
    If the user's pose is similar to the ground truth dance, the feedback text is "Perfect! Match: X%".
    If the user's pose is not similar to the ground truth dance, the feedback text is "Move [right arm/left arm/right leg/left leg]".

    The function also checks if the video has ended, and if so, sets the feedback text to "Video Ended! Congrats, you're done!".
    """
    global frame_idx, latest_feedback, start_time
    fps = 30
    total_frames = len(ground_truth)

    while True:
        success, frame = cap.read()
        if not success:
            continue

        frame = cv2.flip(frame, 1)

        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(frame_rgb)

        feedback_text = "Waiting to Start..."

        if results.pose_landmarks:
            mp.solutions.drawing_utils.draw_landmarks(
                frame,
                results.pose_landmarks,
                mp_pose.POSE_CONNECTIONS
            )

        if processing and start_time:
            elapsed_time = time.time() - start_time
            frame_idx = int(elapsed_time * fps)

            if frame_idx >= total_frames:
                feedback_text = "Video Ended! Congrats, you're done!";
            elif results.pose_landmarks and frame_idx < total_frames:
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

                def is_off(indexes, threshold=0.6):
                    return any(keypoint_distances.get(i, 0) > threshold for i in indexes)

                if is_off([12, 14, 16]):
                    feedback_issues.append("Move right arm")
                if is_off([11, 13, 15]):
                    feedback_issues.append("Move left arm")
                if is_off([24, 26, 28]):
                    feedback_issues.append("Move right leg")
                if is_off([23, 25, 27]):
                    feedback_issues.append("Move left leg")

                if not feedback_issues and average_distance < 0.4:
                    feedback_text = f"Perfect! Match: {match_percent:.1f}%"
                elif len(feedback_issues) >= 3 or match_percent < 20:
                    feedback_text = "Make sure your whole body is in frame!"
                else:
                    feedback_text = f"{', '.join(feedback_issues)} (Match: {match_percent:.1f}%)"

        with lock:
            latest_feedback = feedback_text

        ret, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
# def generate_frames():
#     global frame_idx, latest_feedback, start_time
#     fps = 30
#     total_frames = len(ground_truth)

#     while True:
#         success, frame = cap.read()
#         if not success:
#             continue

#         frame = cv2.flip(frame, 1)  # Mirror the webcam for natural feel

#         if processing and start_time:

#             elapsed_time = time.time() - start_time
#             frame_idx = int(elapsed_time * fps)

#             frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
#             results = pose.process(frame_rgb)

#             feedback_text = "Pose Not Detected"

#             if results.pose_landmarks:
#                 mp.solutions.drawing_utils.draw_landmarks(
#                     frame,
#                     results.pose_landmarks,
#                     mp_pose.POSE_CONNECTIONS
#                 )

#             # if results.pose_landmarks and frame_idx < len(ground_truth):
#             #     live_landmarks = {str(j): [lm.x, lm.y, lm.z] for j, lm in enumerate(results.pose_landmarks.landmark)}
#             #     ground_landmarks = ground_truth[frame_idx]

#             #     distance = calculate_pose_distance(ground_landmarks, live_landmarks)

#             #     if distance < 0.3: # lowkey need to change this
#             #         feedback_text = "Perfect!"
#             #     else:
#             #         feedback_text = "Adjust a bit!"

#             #     frame_idx += 1
#             #detect specific limbs that are off
#             if results.pose_landmarks and frame_idx < len(ground_truth):
#                 live_landmarks = {str(j): [lm.x, lm.y, lm.z] for j, lm in enumerate(results.pose_landmarks.landmark)}
#                 ground_landmarks = ground_truth[frame_idx]

#                 # Calculate distance for each keypoint
#                 keypoint_distances = {}
#                 for idx in ground_landmarks.keys():
#                     ground_point = np.array(ground_landmarks[idx][:2])
#                     live_point = np.array(live_landmarks[idx][:2])
#                     dist = np.linalg.norm(ground_point - live_point)
#                     keypoint_distances[int(idx)] = dist

#                 # Overall average distance
#                 average_distance = np.mean(list(keypoint_distances.values()))
#                 match_percent = max(0, 100 - average_distance * 100)

#                 # Detailed limb feedback
#                 feedback_issues = []

#                 def is_off(indexes, threshold=0.7):  # You can tweak threshold
#                     return any(keypoint_distances.get(i, 0) > threshold for i in indexes)

#                 if is_off([12, 14, 16]):  # Right arm
#                     feedback_issues.append("Move right arm")
#                 if is_off([11, 13, 15]):  # Left arm
#                     feedback_issues.append("Move left arm")
#                 if is_off([24, 26, 28]):  # Right leg
#                     feedback_issues.append("Move right leg")
#                 if is_off([23, 25, 27]):  # Left leg
#                     feedback_issues.append("Move left leg")

#                 if not feedback_issues and average_distance < 0.5:
#                     feedback_text = f"Perfect! Match: {match_percent:.1f}%"
#                 else:
#                     feedback_text = f"{', '.join(feedback_issues)} (Match: {match_percent:.1f}%)"

#                 # frame_idx += 1

#             else:
#                 feedback_text = "Video Ended! Congrats, you're done!" if frame_idx >= len(ground_truth) else "Pose Not Detected"

#             with lock:
#                 latest_feedback = feedback_text

#             # Draw feedback text on frame
#             # cv2.putText(frame, feedback_text, (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

#         # Encode frame as JPEG
#         ret, buffer = cv2.imencode('.jpg', frame)
#         frame_bytes = buffer.tobytes()

#         # Stream frame
#         yield (b'--frame\r\n'
#             b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/feedback')
def feedback():
    with lock:
        return jsonify({'feedback': latest_feedback})

start_time = None

@app.route('/start_processing')
def start_processing():
    global processing, frame_idx, start_time, latest_feedback
    processing = True
    frame_idx = 0  # reset when starting!
    start_time = time.time()
    # latest_feedback = "Waiting to Start..."
    return jsonify({"status": "started"}), 200

@app.route('/stop_processing')
def stop_processing():
    global processing
    processing = False
    return jsonify({"status": "stopped"}), 200

@app.route('/reset_feedback')
def reset_feedback():
    global latest_feedback, frame_idx, processing
    processing = False
    frame_idx = 0
    latest_feedback = "Waiting to Start..."
    return jsonify({"status": "reset"}), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, threaded=True)