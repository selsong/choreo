import React, { useRef, useEffect, useState } from 'react';

const DanceSession = ({ onEnd }) => {
  const videoRef = useRef(null);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [feedback, setFeedback] = useState("Loading...");
  const [groundTruth, setGroundTruth] = useState([]);

  // Load keypoints JSON
  useEffect(() => {
    fetch('/keypoints/hot_to_go-keypoints.json') // Copy keypoints to frontend/public/keypoints/
      .then(res => res.json())
      .then(data => setGroundTruth(data))
      .catch(err => console.error("Error loading keypoints:", err));
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
        const fps = 30; // set manually to your video's frame rate
        const frameIdx = Math.floor(currentTime * fps);
    
        if (frameIdx >= 0 && frameIdx < groundTruth.length) {
          const keypoints = groundTruth[frameIdx];
          ctx.fillStyle = 'red';
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

  const startOrRestartDance = async () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0; // ⏪ Reset video
  
      // First stop backend processing
      await fetch('http://localhost:5001/stop_processing');
  
      //tiny wait to make sure it stops cleanly
      await new Promise((resolve) => setTimeout(resolve, 300));
  
      // Then start fresh backend processing
      await fetch('http://localhost:5001/start_processing');
  
      videoRef.current.play(); // Play video again
      setHasPlayedOnce(true);
    }
  };

  return (
    <div className="dance-session">
      <h1>Choreo</h1>
      <div className="video-container">

        {/* Reference Video + Canvas */}
        <div className="video-wrapper">
          <h2>Reference Video with Keypoints</h2>
          <video
            ref={videoRef}
            src="/videos/hot_to_go.mp4"
            width="640"
            height="480"
            style={{ display: 'none' }}
            crossOrigin="anonymous"
          />
          <canvas
            id="referenceCanvas"
            width="640"
            height="480"
          />
          <button onClick={startOrRestartDance} style={{ marginTop: '10px' }}>
            {hasPlayedOnce ? 'Restart' : 'Play'}
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
