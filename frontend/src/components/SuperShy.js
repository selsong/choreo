// Fixed SuperShy.js (based on your DanceSession.js but fully corrected)

import React, { useRef, useEffect, useState } from 'react';
import '../styles/DanceSession.css';

const SuperShy = ({ onEnd, onPractice }) => {
  const videoRef = useRef(null);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [feedback, setFeedback] = useState("Loading...");
  const [groundTruth, setGroundTruth] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [showStartOverlay, setShowStartOverlay] = useState(true);
  const [feedbackLog, setFeedbackLog] = useState([]);
  const [startTime, setStartTime] = useState(null);

  useEffect(() => {
    let animationFrameId;
    const video = videoRef.current;
    const canvas = document.getElementById('referenceCanvas');
    const ctx = canvas?.getContext('2d');
  
    const draw = () => {
      if (video && video.readyState >= 2 && groundTruth.length > 0 && ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
        const currentTime = video.currentTime;
        const fps = 30;
        const frameIdx = Math.floor(currentTime * fps);
  
        if (frameIdx >= 0 && frameIdx < groundTruth.length) {
          const keypoints = groundTruth[frameIdx];
  
          for (const [, [x, y]] of Object.entries(keypoints)) {
            ctx.beginPath();
            ctx.arc(x * canvas.width, y * canvas.height, 5, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
      }
      animationFrameId = requestAnimationFrame(draw);
    };
  
    if (video) {
      video.addEventListener('play', () => {
        draw(); // Only draw after video starts playing
      });
    }
  
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (video) video.removeEventListener('play', draw);
    };
  }, [groundTruth]);

  useEffect(() => {
    fetch('/keypoints/super_shy-keypoints.json')
      .then(res => res.json())
      .then(data => setGroundTruth(data))
      .catch(err => console.error("Error loading keypoints:", err));
  }, []);

  useEffect(() => {
    let animationFrameId;
    const canvas = document.getElementById('referenceCanvas');

    const draw = () => {
      if (canvas && videoRef.current && groundTruth.length > 0) {
        const ctx = canvas.getContext('2d');
        if (ctx && videoRef.current.readyState >= 2) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

          const currentTime = videoRef.current.currentTime;
          const fps = 30;
          const frameIdx = Math.floor(currentTime * fps);

          if (frameIdx >= 0 && frameIdx < groundTruth.length) {
            const keypoints = groundTruth[frameIdx];
            if (keypoints) {
              for (const [, [x, y]] of Object.entries(keypoints)) {
                ctx.beginPath();
                ctx.arc(x * canvas.width, y * canvas.height, 5, 0, 2 * Math.PI);
                ctx.fill();
              }
            }
          }
        }
      }
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationFrameId);
  }, [groundTruth]);

  useEffect(() => {
    if (!startTime) setStartTime(Date.now());
    const interval = setInterval(() => {
      fetch('http://localhost:5001/feedback')
        .then(res => res.json())
        .then(data => {
          if (data.feedback !== feedback) {
            setFeedback(data.feedback);
            const elapsed = (Date.now() - startTime) / 1000;
            setFeedbackLog(prev => [...prev, {
              time: Math.round(elapsed),
              feedback: data.feedback
            }]);
          }
        })
        .catch(err => console.error("Error fetching feedback:", err));
    }, 1000);
    return () => clearInterval(interval);
  }, [feedback, startTime]);

  const getFeedbackColorClass = (feedback) => {
    if (feedback.includes("Perfect")) return "feedback-perfect";
    else if (feedback.includes("Pose Not Detected")) return "feedback-neutral";
    else return "feedback-warning";
  };

  const startOrRestartDance = async () => {
    await fetch('http://localhost:5001/clear_saved_frames', { method: 'POST' });
    if (videoRef.current) {
      setCountdown(3);
      let countdownTimer = setInterval(() => {
        setCountdown(prev => {
          if (prev === 1) {
            setTimeout(() => {
              setCountdown("GO");
              setTimeout(() => {
                actuallyStartDance();
                setCountdown(null);
              }, 800);
            }, 1000);
            clearInterval(countdownTimer);
            return 1;
          } else {
            return prev - 1;
          }
        });
      }, 1000);
    }
  };

  const actuallyStartDance = async () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      await fetch('http://localhost:5001/stop_processing');
      await new Promise(resolve => setTimeout(resolve, 300));
      await fetch('http://localhost:5001/start_processing');
      videoRef.current.play();
      setHasPlayedOnce(true);
      setStartTime(Date.now());
    }
  };

  const handleEndDance = async () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    await fetch('http://localhost:5001/stop_processing');
    await fetch('http://localhost:5001/reset_feedback');
    onEnd(feedbackLog);
  };

  return (
    <div className="dance-sess">
      <h1>choreo</h1>

      {showStartOverlay && (
        <div className="start-overlay">
          <button className="start-button" onClick={() => {
            setShowStartOverlay(false);
            startOrRestartDance();
          }}>Start</button>
        </div>
      )}

      {countdown !== null && (
        <div className="countdown-overlay">
          <div key={countdown} className="countdown-number">{countdown}</div>
        </div>
      )}

      <div className="video-container">
        <div className="video-wrapper">
          <h2>Reference Dance Video</h2>
          <video
            ref={videoRef}
            src="/videos/super_shy.mp4"
            width="1024"
            height="768"
            style={{ width: 0, height: 0, opacity: 0, position: 'absolute', pointerEvents: 'none' }}
            crossOrigin="anonymous"
          />
          <canvas id="referenceCanvas" width="640" height="480" />
        </div>

        <div className="video-wrapper">
          <h2>Your Live Moves</h2>
          <img src="http://localhost:5001/video_feed" alt="Dancing Live Stream" width="1024" height="600" />
          <div key={feedback} className={`feedback-text ${getFeedbackColorClass(feedback)}`}>{feedback}</div>
        </div>
      </div>

      <div className="button-row">
        <button onClick={startOrRestartDance} className="restart-button">{hasPlayedOnce ? 'Restart' : 'Play'}</button>
        <button onClick={handleEndDance} className="end-dance-button">End Dance</button>
        <button 
          onClick={async () => {
            await fetch('http://localhost:5001/reset_feedback');
            onPractice();
          }}
          className="practice-button"
        >Practice in 0.5x</button>
      </div>
    </div>
  );
};

export default SuperShy;