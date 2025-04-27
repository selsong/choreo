import React, { useRef, useEffect, useState } from 'react';

const DanceSession = ({ onEnd }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [feedback, setFeedback] = useState("Loading...");
  const [feedbackLog, setFeedbackLog] = useState([]);
  const [startTime, setStartTime] = useState(null);

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

            setFeedbackLog(prev => [
              ...prev,
              {
                time: Math.round(elapsed),
                feedback: data.feedback
              }
            ]);
          }
        })
        .catch(err => console.error("Error fetching feedback:", err));
    }, 1000);

    return () => clearInterval(interval);
  }, [feedback, startTime]);

  const getFeedbackColor = (feedback) => {
    if (feedback.includes("Perfect")) {
      return "green";
    } else if (feedback.includes("Pose Not Detected")) {
      return "gray";
    } else {
      return "orange";
    }
  };

  // 🛠 Modified only this function to clear frames
  const togglePlay = async () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        fetch('http://localhost:5001/stop_processing');
      } else {
        videoRef.current.play();
        await fetch('http://localhost:5001/clear_saved_frames'); // 🆕 clear old frames
        fetch('http://localhost:5001/start_processing');
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleEndDance = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    fetch('http://localhost:5001/stop_processing');
    onEnd(feedbackLog);
  };

  return (
    <div className="dance-session">
      <h1>Choreo</h1>
      <div className="video-container">
        <div className="video-wrapper">
          <h2>Reference Video</h2>
          <video
            ref={videoRef}
            src="/videos/hot_to_go.mp4"
            controls
            width="640"
            height="480"
          />
          <button onClick={togglePlay} style={{ marginTop: '10px' }}>
            {isPlaying ? 'Pause' : 'Play'}
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

      <button onClick={handleEndDance} className="end-dance-button" style={{ marginTop: '20px' }}>
        End Dance
      </button>
    </div>
  );
};

export default DanceSession;
