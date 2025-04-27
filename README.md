# choreo
dance like nobody's watching

Upload any video, extract keypoints, and get live feedback as you practice!

## Features
- Upload a dance video
- Extract pose keypoints automatically
- Live feedback based on how well your poses match the reference
- Visualize your live pose landmarks
- Summary from your Gemini teacher

## Technologies
- React
- Python
- OpenCV
- Mediapipe
- Tensorflow
- Google Gemini API
- Flask

## How to Run Locally

### 1. Set up the Backend (Flask server)
```bash
cd backend
pip install -r requirements.txt
python src/live_feedback.py
```

Make sure you have a .env file inside backend/ with your Gemini API key

### 2. Set up the Frontend
```bash
cd ..
cd frontend
pip install -r requirements.txt
npm i
npm start
```

## How It Works
1. Extract keypoints from any dance video using `extractor.py`
2. Practice live with your webcam using `live_feedback.py`
3. Get real-time encouragement and improve your moves!


## Team
- Fiona Peng
- Selina Song
- Alyssa Leung
- Cindy Ding
