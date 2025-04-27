import React, { useRef, useEffect, useState } from 'react';
import '../styles/DanceSession.css';

const DanceSession = ({ onEnd }) => {
  const videoRef = useRef(null);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [feedback, setFeedback] = useState("Loading...");
  const [groundTruth, setGroundTruth] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [showStartOverlay, setShowStartOverlay] = useState(true);
  const [feedbackLog, setFeedbackLog] = useState([]);
  const [startTime, setStartTime] = useState(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.addEventListener('loadeddata', () => {
        const canvas = document.getElementById('referenceCanvas');
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      });
    }
  }, []);

  useEffect(() => {
    fetch('/keypoints/hot_to_go-keypoints.json')
      .then(res => res.json())
      .then(data => setGroundTruth(data))
      .catch(err => console.error("Error loading keypoints:", err));
  }, []);

  useEffect(() => {
    let animationFrameId;
    const canvas = document.getElementById('referenceCanvas');
    const ctx = canvas.getContext('2d');

    const draw = () => {
      if (videoRef.current && groundTruth.length > 0) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const currentTime = videoRef.current.currentTime;
        const fps = 30;
        const frameIdx = Math.floor(currentTime * fps);

        if (frameIdx >= 0 && frameIdx < groundTruth.length) {
          const keypoints = groundTruth[frameIdx];
          ctx.fillStyle = 'white';
          for (const [x, y] of keypoints) {
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

  useEffect(() => {
    if (!startTime) {
      setStartTime(Date.now());
    }

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

  const getFeedbackColor = (feedback) => {
    if (feedback.includes("Perfect")) return "green";
    else if (feedback.includes("Pose Not Detected")) return "gray";
    else return "orange";
  };

  const startOrRestartDance = async () => {
    if (videoRef.current) {
      setCountdown(3);
      let countdownTimer = setInterval(() => {
        setCountdown(prev => {
          if (prev === 1) {
            clearInterval(countdownTimer);
            actuallyStartDance();
            return null;
          } else {
            return prev - 1;
          }
        });
      }, 1000);
    }
  };

  const actuallyStartDance = async () => {
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
    await fetch('http://localhost:5001/stop_processing');
    await new Promise((resolve) => setTimeout(resolve, 300));
    await fetch('http://localhost:5001/start_processing');
    videoRef.current.play();
    setHasPlayedOnce(true);
  };

  const handleEndDance = async () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    await fetch('http://localhost:5001/stop_processing');
    onEnd(feedbackLog); // Pass feedback log
  };

  return (
    <div className="dance-sess aura-background">
      <h1>choreo</h1>

      {showStartOverlay && (
        <div className="start-overlay">
          <button 
            className="start-button" 
            onClick={() => {
              setShowStartOverlay(false);
              startOrRestartDance();
            }}
          >
            Start
          </button>
        </div>
      )}

      {countdown !== null && (
        <div className="countdown-overlay">
          <h1>{countdown}</h1>
        </div>
      )}

      <div className="video-container">
        <div className="video-wrapper">
          <h2>Reference Video with Keypoints</h2>
          <video
            ref={videoRef}
            src="/videos/hot_to_go.mp4"
            width="640"
            height="480"
            style={{
              width: 0,
              height: 0,
              opacity: 0,
              position: 'absolute',
              pointerEvents: 'none',
            }}
            crossOrigin="anonymous"
          />
          <canvas id="referenceCanvas" width="500" height="700" />
          <button onClick={startOrRestartDance} style={{ marginTop: '10px' }}>
            {hasPlayedOnce ? 'Restart' : 'Play'}
          </button>
        </div>

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

      <button 
        onClick={handleEndDance}
        className="end-dance-button"
        style={{ marginTop: '20px' }}
      >
        End Dance
      </button>
    </div>
  );
};

export default DanceSession;
