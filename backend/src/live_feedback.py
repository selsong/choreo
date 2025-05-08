from flask import Flask, Response, jsonify, send_from_directory, request
import os
import shutil
import cv2
import mediapipe as mp
import numpy as np
import json
import threading
import time
from flask_cors import CORS
import google.generativeai as genai
from dotenv import load_dotenv
import yt_dlp
import uuid
import subprocess
from pathlib import Path
load_dotenv()  # Load .env variables

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
genai.configure(api_key=GEMINI_API_KEY)

# Create Flask app
app = Flask(__name__)
CORS(app)

# Ensure directories exist
os.makedirs('saved_frames', exist_ok=True)
os.makedirs('videos', exist_ok=True)
os.makedirs('keypoints', exist_ok=True)

# Global variables
ground_truth = None
video_path = None

# Load saved keypoints
with open('./keypoints/hot_to_go-keypoints.json', 'r') as f:
    ground_truth = json.load(f)
# with open('./keypoints/super_shy-keypoints.json', 'r') as f:
#     ground_truth = json.load(f)

print(f"Loaded ground truth frames: {len(ground_truth)}")

mp_pose = mp.solutions.pose
pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)

# Initialize video capture
cap = cv2.VideoCapture(0, cv2.CAP_AVFOUNDATION)

frame_idx = 0
latest_feedback = "Pose Not Detected"
lock = threading.Lock()
processing = False
last_saved_time = 0
start_time = None

def generate_frames():
    global frame_idx, latest_feedback, last_saved_time, start_time
    # fps = 30
    total_frames = len(ground_truth)

    while True:
        success, frame = cap.read()
        if not success:
            continue

        frame = cv2.flip(frame, 1)
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(frame_rgb)

        if results.pose_landmarks:
            mp.solutions.drawing_utils.draw_landmarks(
                frame,
                results.pose_landmarks,
                mp_pose.POSE_CONNECTIONS
            )

        feedback_text = "Waiting to Start..."

        if processing and start_time:
            elapsed_time = time.time() - start_time
            frame_idx = int(elapsed_time * fps)

            if frame_idx >= total_frames:
                feedback_text = "Video Ended! Congrats, you're done!"

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

                def is_off(indexes, threshold=0.5):  # made threshold stricter: from 0.7 → 0.5
                    return any(keypoint_distances.get(i, 0) > threshold for i in indexes)

                if is_off([12, 14, 16]):
                    feedback_issues.append("Move right arm")
                if is_off([11, 13, 15]):
                    feedback_issues.append("Move left arm")
                if is_off([24, 26, 28]):
                    feedback_issues.append("Move right leg")
                if is_off([23, 25, 27]):
                    feedback_issues.append("Move left leg")

                if not feedback_issues and average_distance < 0.35:  # made average stricter too: from 0.4 → 0.25
                    feedback_text = f"Perfect! Match: {match_percent:.1f}%"
                elif match_percent < 20 or len(feedback_issues) >= 3:
                    feedback_text = "Make sure your whole body is in frame!"
                elif match_percent < 50:  # NEW: "Not Good" if match is between 20 and 50
                    feedback_text = "Not good, keep practicing!"
                else:
                    feedback_text = f"{', '.join(feedback_issues)} (Match: {match_percent:.1f}%)"

                # 🛠 Save frame once per second
                now = time.time()
                if now - last_saved_time >= 1.0:
                    last_saved_time = now
                    filename = f"saved_frames/frame_{int(now)}.jpg"
                    cv2.imwrite(filename, frame)
                    print(f"Saved frame: {filename}")

        with lock:
            latest_feedback = feedback_text

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

fps = 30
@app.route('/start_processing')
def start_processing():
    global processing, frame_idx, start_time, latest_feedback, fps
    processing = True
    frame_idx = 0
    start_time = time.time()

    # Check if slowing down (based on query param ?mode=slow)
    mode = request.args.get('mode', 'normal')
    if mode == 'slow':
        fps = 15  # Slow mode: 15fps
        print("⚡ Slow mode activated: 15 fps")
    else:
        fps = 30  # Normal mode
        print("⚡ Normal mode activated: 30 fps")

    latest_feedback = "Waiting to Start..."
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

@app.route('/list_saved_frames')
def list_saved_frames():
    try:
        frames = sorted(os.listdir('saved_frames'))
        frame_urls = [f"/saved_frames/{frame}" for frame in frames if frame.endswith('.jpg')]
        return jsonify({'frames': frame_urls}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/saved_frames/<path:filename>')
def serve_saved_frame(filename):
    folder = os.path.abspath('saved_frames')
    return send_from_directory(folder, filename)

@app.route('/clear_saved_frames', methods=['POST'])
def clear_saved_frames():
    folder = 'saved_frames'
    try:

        if os.path.exists(folder):
            shutil.rmtree(folder)
        os.makedirs(folder)
        print("saved_frames manually cleared!")
        return jsonify({"status": "cleared"}), 200
    except Exception as e:
        print(f'Error manually clearing saved_frames: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/humanize_feedback', methods=['POST'])
def humanize_feedback():
    user_prompt = request.json.get('prompt')

    try:
        model = genai.GenerativeModel('gemini-1.5-flash')  # or 'gemini-2.0' depending what you want
        response = model.generate_content(user_prompt)

        if response and hasattr(response, 'text'):
            return jsonify({"humanizedFeedback": response.text})
        else:
            return jsonify({"error": "Invalid response from Gemini."}), 500

    except Exception as e:
        print(f"Error contacting Gemini API: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/process_tiktok', methods=['POST'])
def process_tiktok():
    try:
        tiktok_link = request.json.get('tiktokLink')
        if not tiktok_link:
            return jsonify({'error': 'No TikTok link provided'}), 400

        # Generate unique ID for this video
        video_id = str(uuid.uuid4())
        video_dir = Path('videos') / video_id
        video_dir.mkdir(exist_ok=True)
        
        # Download video using yt-dlp
        ydl_opts = {
            'format': 'best[ext=mp4]',
            'outtmpl': str(video_dir / 'video.mp4'),
            'quiet': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([tiktok_link])
        
        video_path = str(video_dir / 'video.mp4')
        
        # Extract keypoints
        keypoints = extract_keypoints(video_path)
        
        # Save keypoints
        keypoints_path = Path('keypoints') / f'{video_id}-keypoints.json'
        with open(keypoints_path, 'w') as f:
            json.dump(keypoints, f)
        
        # Update global variables
        global ground_truth
        ground_truth = keypoints
        
        return jsonify({
            'status': 'success',
            'video_id': video_id,
            'message': 'Video processed successfully'
        }), 200
        
    except Exception as e:
        print(f"Error processing TikTok video: {e}")
        return jsonify({'error': str(e)}), 500

def extract_keypoints(video_path):
    keypoints_list = []
    cap = cv2.VideoCapture(video_path)
    
    with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                break
                
            image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(image)
            
            if results.pose_landmarks:
                pose_landmarks = {str(j): [lmk.x, lmk.y, lmk.z] 
                                for j, lmk in enumerate(results.pose_landmarks.landmark)}
                keypoints_list.append(pose_landmarks)
            else:
                # Add empty landmarks if pose not detected
                keypoints_list.append({})
    
    cap.release()
    return keypoints_list

@app.route('/videos/<video_id>/<filename>')
def serve_video(video_id, filename):
    folder = os.path.abspath(f'videos/{video_id}')
    return send_from_directory(folder, filename)

@app.route('/keypoints/<filename>')
def serve_keypoints(filename):
    folder = os.path.abspath('keypoints')
    return send_from_directory(folder, filename)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, threaded=True)