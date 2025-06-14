from flask import Flask, Response, jsonify, send_from_directory, request, send_file
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
import hashlib
from pathlib import Path
from supabase import create_client, Client
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

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

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
    global ground_truth
    try:
        data = request.get_json()
        tiktok_link = data.get('tiktokLink')
        
        if not tiktok_link:
            return jsonify({'error': 'No TikTok link provided'}), 400

        # Generate consistent ID from TikTok URL
        video_id = hashlib.sha256(tiktok_link.encode()).hexdigest()[:16]

        # Check if video already exists in database
        existing_video = supabase.table('videos').select('*').eq('id', video_id).execute()
        
        if existing_video.data and len(existing_video.data) > 0:
            # Video already exists, try to use existing data
            video_data = existing_video.data[0]
            expected_keypoint_path = f'{video_id}-keypoints.json'  # Remove 'keypoints/' prefix
            
            try:
                # Get existing keypoints
                keypoints_result = supabase.storage.from_('keypoints').download(expected_keypoint_path)
                if hasattr(keypoints_result, 'error') and keypoints_result.error:
                    error_msg = f"Keypoint path mismatch - Expected: {expected_keypoint_path}, Found in DB: {video_data['keypoint_path']}"
                    print(error_msg)
                    return jsonify({'error': error_msg}), 500
                    
                # Create temporary file to load keypoints
                temp_dir = f'temp_{video_id}'
                os.makedirs(temp_dir, exist_ok=True)
                temp_keypoints_path = os.path.join(temp_dir, 'keypoints.json')
                
                with open(temp_keypoints_path, 'wb') as f:
                    f.write(keypoints_result)
                    
                with open(temp_keypoints_path, 'r') as f:
                    keypoints = json.load(f)
                    
                # Update global variables
                ground_truth = keypoints
                
                # Clean up
                shutil.rmtree(temp_dir)
                
                return jsonify({
                    'video_id': video_id,
                    'message': 'Using existing video data'
                })
            except Exception as e:
                error_msg = f"Error loading keypoints - ID: {video_id}, Expected path: {expected_keypoint_path}, DB path: {video_data['keypoint_path']}, Error: {str(e)}"
                print(error_msg)
                return jsonify({'error': error_msg}), 500

        # If video doesn't exist, process it
        # Create temporary directory for processing
        temp_dir = f'temp_{video_id}'
        os.makedirs(temp_dir, exist_ok=True)
        
        # Download video using yt-dlp with optimized settings
        temp_video_path = os.path.join(temp_dir, 'video.mp4')
        ydl_opts = {
            'format': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[ext=mp4]/best',  # More flexible format selection
            'outtmpl': temp_video_path,
            'quiet': True,
            'merge_output_format': 'mp4'
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([tiktok_link])
        
        # Extract keypoints from video
        keypoints = extract_keypoints(temp_video_path)
        
        # Save keypoints to JSON file
        temp_keypoints_path = os.path.join(temp_dir, 'keypoints.json')
        with open(temp_keypoints_path, 'w') as f:
            json.dump(keypoints, f)
        
        # Upload video to Supabase storage
        with open(temp_video_path, 'rb') as f:
            video_data = f.read()
            result = supabase.storage.from_('videos').upload(
                f'{video_id}/video.mp4',
                video_data,
                file_options={'content-type': 'video/mp4'}
            )
            if hasattr(result, 'error') and result.error:
                raise Exception(f"Failed to upload video: {result.error}")

        # Upload keypoints to Supabase storage
        keypoint_path = f'{video_id}-keypoints.json'  # Remove 'keypoints/' prefix
        with open(temp_keypoints_path, 'rb') as f:
            keypoints_data = f.read()
            result = supabase.storage.from_('keypoints').upload(
                keypoint_path,
                keypoints_data,
                file_options={'content-type': 'application/json'}
            )
            if hasattr(result, 'error') and result.error:
                raise Exception(f"Failed to upload keypoints: {result.error}")

        # Store video metadata in Supabase
        video_data = {
            'id': video_id,
            'url': tiktok_link,
            'video_path': f'videos/{video_id}/video.mp4',
            'keypoint_path': keypoint_path  # Store just the filename, not the full path
        }
        
        result = supabase.table('videos').insert(video_data).execute()
        if hasattr(result, 'error') and result.error:
            raise Exception(f"Failed to store video metadata: {result.error}")

        # Update global variables
        ground_truth = keypoints

        # Clean up temporary directory
        shutil.rmtree(temp_dir)

        return jsonify({
            'video_id': video_id,
            'message': 'Video processed successfully'
        })

    except Exception as e:
        print(f"Error processing TikTok video: {str(e)}")
        # Clean up temp directory if it exists
        if 'temp_dir' in locals() and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
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
    try:
        # Get the video from Supabase storage
        result = supabase.storage.from_('videos').download(f'{video_id}/video.mp4')
        if hasattr(result, 'error') and result.error:
            return jsonify({'error': 'Video not found'}), 404
            
        # Create a temporary file to serve
        temp_path = f'temp_{video_id}_{filename}'
        with open(temp_path, 'wb') as f:
            f.write(result)
            
        response = send_file(temp_path, mimetype='video/mp4')
        
        # Clean up the temporary file after sending
        @response.call_on_close
        def cleanup():
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
        return response
        
    except Exception as e:
        print(f"Error serving video: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/keypoints/<filename>')
def serve_keypoints(filename):
    try:
        # Get the keypoints from Supabase storage
        result = supabase.storage.from_('keypoints').download(filename)
        if hasattr(result, 'error') and result.error:
            return jsonify({'error': 'Keypoints not found'}), 404
            
        # Create a temporary file to serve
        temp_path = f'temp_{filename}'
        with open(temp_path, 'wb') as f:
            f.write(result)
            
        # Load and serve the JSON
        with open(temp_path, 'r') as f:
            keypoints_data = json.load(f)
            
        # Clean up the temporary file
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
        return jsonify(keypoints_data)
        
    except Exception as e:
        print(f"Error serving keypoints: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, threaded=True)