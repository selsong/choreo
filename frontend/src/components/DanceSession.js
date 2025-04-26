import React, { useRef, useEffect, useState } from 'react';
import '../styles/DanceSession.css';

const DanceSession = ({ onEnd }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [feedback, setFeedback] = useState("Loading...");
  const [groundTruth, setGroundTruth] = useState([]);

  // Load keypoints JSON
  useEffect(() => {
    fetch('./keypoints/hot_to_go-keypoints.json') // Copy keypoints to frontend/public/keypoints/
      .then(res => res.json())
      .then(data => setGroundTruth(data))
      .catch(err => console.error("Error loading keypoints:", err));
  }, []);

  // Force video to play after it loads
  useEffect(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      const handleLoaded = () => {
        video.play();
      };
      video.addEventListener('loadeddata', handleLoaded);
      return () => video.removeEventListener('loadeddata', handleLoaded);
    }
  }, []);

  // Draw video + keypoints onto canvas
  useEffect(() => {
    let animationFrameId;
    const canvas = document.getElementById('referenceCanvas');
    const ctx = canvas.getContext('2d');

    const draw = () => {
      if (videoRef.current && groundTruth.length > 0 && !videoRef.current.paused && !videoRef.current.ended) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

        const currentTime = videoRef.current.currentTime;
        const videoDuration = videoRef.current.duration;
        const totalFrames = groundTruth.length;
        const frameIdx = Math.floor((currentTime / videoDuration) * totalFrames);

        if (frameIdx >= 0 && frameIdx < totalFrames) {
          const keypoints = groundTruth[frameIdx];
          ctx.fillStyle = 'white';
          for (const idx in keypoints) {
            const [x, y] = keypoints[idx];
            ctx.beginPath();
            ctx.arc(x * canvas.width, y * canvas.height, 5, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
      }
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationFrameId);
  }, [groundTruth]);

  // Fetch feedback from server
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('http://localhost:5001/feedback')
        .then(res => res.json())
        .then(data => {
          if (data.feedback !== feedback) {
            setFeedback(data.feedback);
          }
        })
        .catch(err => console.error("Error fetching feedback:", err));
    }, 1000);

    return () => clearInterval(interval);
  }, [feedback]);

  const getFeedbackColor = (feedback) => {
    if (feedback.includes("Perfect")) return "green";
    else if (feedback.includes("Pose Not Detected")) return "gray";
    else return "orange";
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        fetch('http://localhost:5001/stop_processing');
      } else {
        videoRef.current.play();
        fetch('http://localhost:5001/start_processing');
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="dance-session aura-background">
      <h1>choreo</h1>
      <div className="video-container">

        {/* Reference Video + Canvas */}
        <div className="video-wrapper">
          <h2>Reference Video with Keypoints</h2>
          <video
            ref={videoRef}
            src="/videos/hot_to_go.mp4"
            style={{
              width: 'auto',
              height: 'auto',
              display: 'none',
              objectFit: 'contain'
            }}
            crossOrigin="anonymous"
          />
          <canvas
            id="referenceCanvas"
            width="500"
            height="700"
          />
          <button onClick={togglePlay} style={{ marginTop: '10px' }}>
            {isPlaying ? 'Pause' : 'Play'}
          </button>
        </div>

        {/* Live Webcam Stream */}
        <div className="video-wrapper">
          <h2>Live Feedback</h2>
          <img
            src="http://localhost:5001/video_feed"
            alt="Dancing Live Stream"
            width="640"
            height="480"
          />
          <div style={{ marginTop: '20px' }}>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: getFeedbackColor(feedback)
            }}>
              {feedback}
            </div>
          </div>
        </div>

      </div>
      <button onClick={onEnd} className="end-dance-button">End Dance</button>
    </div>
  );
};

export default DanceSession;
