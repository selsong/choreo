// Updated DanceSession.js

import React, { useRef, useEffect, useState } from 'react';
import '../styles/DanceSession.css';

const DanceSession = ({ onEnd, onPractice, videoId }) => {
  const videoRef = useRef(null);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [feedback, setFeedback] = useState("Loading...");
  const [groundTruth, setGroundTruth] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [showStartOverlay, setShowStartOverlay] = useState(true);
  const [feedbackLog, setFeedbackLog] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.addEventListener('loadeddata', () => {
        const canvas = document.getElementById('referenceCanvas');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx && videoRef.current) {
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          }
        }
      });
    }
  }, []);

  useEffect(() => {
    if (videoId) {
      console.log('Fetching keypoints for video:', videoId);
      fetch(`http://localhost:5001/keypoints/${videoId}-keypoints.json`)
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          console.log('Loaded keypoints:', data.length);
          setGroundTruth(data);
          setError(null);
        })
        .catch(err => {
          console.error("Error loading keypoints:", err);
          setError('Error loading keypoints. Please try uploading the video again.');
        });
    }
  }, [videoId]);

  useEffect(() => {
    let animationFrameId;
    const canvas = document.getElementById('referenceCanvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx && videoRef.current) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      }
    }

    const draw = () => {
      if (videoRef.current && groundTruth.length > 0) {
        const canvas = document.getElementById('referenceCanvas');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
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
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
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
        .catch(err => {
          console.error("Error fetching feedback:", err);
          setFeedback("Waiting for backend connection...");
        });
    }, 1000);

    return () => clearInterval(interval);
  }, [feedback, startTime]);

  const getFeedbackColorClass = (feedback) => {
    if (feedback.includes("Perfect")) return "feedback-perfect";
    else if (feedback.includes("Pose Not Detected")) return "feedback-neutral";
    else return "feedback-warning";
  };

  const startOrRestartDance = async () => {
    if (!videoId) {
      setError('No video loaded. Please upload a video first.');
      return;
    }

    try {
      const response = await fetch('http://localhost:5001/clear_saved_frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ really_clear: true })
      });

      if (!response.ok) {
        throw new Error('Failed to clear saved frames');
      }

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
    } catch (err) {
      console.error('Error starting dance:', err);
      setError('Error connecting to backend. Please make sure the server is running.');
    }
  };

  const actuallyStartDance = async () => {
    if (videoRef.current) {
      try {
        console.log('Starting dance session');
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        
        const stopResponse = await fetch('http://localhost:5001/stop_processing');
        if (!stopResponse.ok) throw new Error('Failed to stop processing');
        
        await new Promise((resolve) => setTimeout(resolve, 300));
        
        const startResponse = await fetch('http://localhost:5001/start_processing');
        if (!startResponse.ok) throw new Error('Failed to start processing');
        
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Video playback started');
              setHasPlayedOnce(true);
              setStartTime(Date.now());
            })
            .catch(error => {
              console.error('Error playing video:', error);
              setError('Error playing video: ' + error.message);
            });
        }
      } catch (err) {
        console.error('Error in actuallyStartDance:', err);
        setError('Error connecting to backend. Please make sure the server is running.');
      }
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

      {error && (
        <div className="error-message" style={{ color: 'red', margin: '20px' }}>
          {error}
        </div>
      )}

      {showStartOverlay && (
        <div className="start-overlay">
          <button className="start-button" onClick={() => {
            setShowStartOverlay(false);
            startOrRestartDance();
          }}>
            Start
          </button>
        </div>
      )}

      {countdown !== null && (
        <div className="countdown-overlay">
          <div key={countdown} className="countdown-number">
            {countdown}
          </div>
        </div>
      )}

      <div className="video-container">
        <div className="video-wrapper">
          <h2>Reference Dance Video</h2>
          <video
            ref={videoRef}
            src={`http://localhost:5001/videos/${videoId}/video.mp4`}
            width="380"
            height="640"
            style={{ display: 'block' }}
            crossOrigin="anonymous"
            preload="auto"
            controls
          />
        </div>

        <div className="video-wrapper">
          <h2>Your Live Moves</h2>
          <img
            src="http://localhost:5001/video_feed"
            alt="Dancing Live Stream"
            width="380"
            height="640"
          />
          <div key={feedback} className={`feedback-text ${getFeedbackColorClass(feedback)}`}>
            {feedback}
          </div>
        </div>
      </div>

      <div className="button-row">
        <button onClick={startOrRestartDance} className="restart-button">
          {hasPlayedOnce ? 'Restart' : 'Play'}
        </button>

        <button onClick={handleEndDance} className="end-dance-button">
          End Dance
        </button>

        <button 
          onClick={async () => {
            await fetch('http://localhost:5001/reset_feedback');
            onPractice();
          }}
          className="practice-button"
        >
          Practice in 0.5x
        </button>
      </div>
    </div>
  );
};

export default DanceSession;