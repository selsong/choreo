import React, { useRef } from 'react';
import Webcam from 'react-webcam';

const DanceSession = ({ onEnd }) => {
  const webcamRef = useRef(null);

  return (
    <div className="dance-session">
      <h2>🎶 Dancing Session</h2>
      <Webcam
        ref={webcamRef}
        mirrored
        audio={false}
        screenshotFormat="image/jpeg"
        style={{ width: 640, height: 480 }}
      />
      <div>
        <button onClick={onEnd}>End Dance</button>
      </div>
    </div>
  );
};

export default DanceSession;
