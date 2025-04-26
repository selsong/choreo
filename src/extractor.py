import cv2
import mediapipe as mp
import numpy as np
import json
import os

mp_pose = mp.solutions.pose

video_name = 'hot_to_go.mp4'
video_path = 'ground-truth-videos/' + video_name
output_keypoints_path = 'keypoints/'
temp_frames_path = 'temp_frames/'

os.makedirs(output_keypoints_path, exist_ok=True)
os.makedirs(temp_frames_path, exist_ok=True)

cap = cv2.VideoCapture(video_path)
i = 0
annotated_frames = []
keypoints_list = []

with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            print("Finished reading video.")
            break

        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(image)

        if results.pose_landmarks:
            pose_landmarks = {str(j): [lmk.x, lmk.y, lmk.z] for j, lmk in enumerate(results.pose_landmarks.landmark)}
            keypoints_list.append(pose_landmarks)

        cv2.imwrite(temp_frames_path + f'{i}.png', frame)
        annotated_frames.append(temp_frames_path + f'{i}.png')
        i += 1

cap.release()
cv2.destroyAllWindows()

# Save keypoints
with open(output_keypoints_path + video_name.split('.')[0] + '-keypoints.json', 'w') as fp:
    json.dump(keypoints_list, fp)

print(f"Saved keypoints to {output_keypoints_path}{video_name.split('.')[0]}-keypoints.json")
