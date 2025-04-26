import React, { useRef, useEffect, useState } from 'react';
import './App.css';

function App() {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // Load the ground truth video
    if (videoRef.current) {
      videoRef.current.src = '/ground-truth-videos/hottogo.mov';
    }
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="App">
      <h1>Dance Comparison</h1>
      <div className="video-container">
        <div className="video-wrapper">
          <h2>Ground Truth</h2>
          <video
            ref={videoRef}
            controls
            width="640"
            height="480"
          />
          <button onClick={togglePlay}>
            {isPlaying ? 'Pause' : 'Play'}
          </button>
        </div>
        <div className="video-wrapper">
          <h2>Your Webcam with Feedback</h2>
          <img
            src="http://localhost:5000/video_feed"
            alt="Webcam feed"
            width="640"
            height="480"
          />
        </div>
      </div>
    </div>
  );
}

export default App; 