import React, { useRef, useEffect, useState } from 'react';

const DanceSession = ({ onEnd }) => {
  const videoRef = useRef(null);
  const webcamRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // Load the ground truth video
    if (videoRef.current) {
      videoRef.current.src = '/videos/hot_to_go.mov';
    }

    // Initialize webcam
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          if (webcamRef.current) {
            webcamRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.error("Error accessing webcam:", err);
        });
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
    <div className="dance-session">
      <h1>Choreo</h1>
      <div className="video-container">
        <div className="video-wrapper">
          <h2>Reference Video</h2>
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
          <h2>Webcam</h2>
          <video
            ref={webcamRef}
            autoPlay
            playsInline
            width="640"
            height="480"
            style={{ transform: 'scaleX(-1)' }}
          />
        </div>
      </div>
      <button onClick={onEnd} className="end-dance-button">End Dance</button>
    </div>
  );
};

export default DanceSession;
