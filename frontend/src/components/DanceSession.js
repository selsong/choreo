// import React, { useRef, useEffect, useState } from 'react';

// const DanceSession = ({ onEnd }) => {
//   const videoRef = useRef(null);
//   const webcamRef = useRef(null);
//   const [isPlaying, setIsPlaying] = useState(false);

//   useEffect(() => {
//     // Load the ground truth video
//     if (videoRef.current) {
//       videoRef.current.src = '/videos/hot_to_go.mov';
//     }

//     // Initialize webcam
//     if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
//       navigator.mediaDevices.getUserMedia({ video: true })
//         .then(stream => {
//           if (webcamRef.current) {
//             webcamRef.current.srcObject = stream;
//           }
//         })
//         .catch(err => {
//           console.error("Error accessing webcam:", err);
//         });
//     }
//   }, []);

//   const togglePlay = () => {
//     if (videoRef.current) {
//       if (isPlaying) {
//         videoRef.current.pause();
//       } else {
//         videoRef.current.play();
//       }
//       setIsPlaying(!isPlaying);
//     }
//   };

//   return (
//     <div className="dance-session">
//       <h1>Choreo</h1>
//       <div className="video-container">
//         <div className="video-wrapper">
//           <h2>Reference Video</h2>
//           <video
//             ref={videoRef}
//             controls
//             width="640"
//             height="480"
//           />
//           <button onClick={togglePlay}>
//             {isPlaying ? 'Pause' : 'Play'}
//           </button>
//         </div>
//         <div className="video-wrapper">
//           <h2>Webcam</h2>
//           <video
//             ref={webcamRef}
//             autoPlay
//             playsInline
//             width="640"
//             height="480"
//             style={{ transform: 'scaleX(-1)' }}
//           />
//         </div>
//       </div>
//       <button onClick={onEnd} className="end-dance-button">End Dance</button>
//     </div>
//   );
// };

// export default DanceSession;

import React, { useRef, useEffect, useState } from 'react';

const DanceSession = ({ onEnd }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [feedback, setFeedback] = useState("Loading...");

  useEffect(() => {
    const interval = setInterval(() => {
      fetch('http://localhost:5001/feedback')
        .then(res => res.json())
        .then(data => {
          // Only update if different
          if (data.feedback !== feedback) {
            setFeedback(data.feedback);
          }
        })
        .catch(err => console.error("Error fetching feedback:", err));
    }, 1000); // slower 2 seconds for better calmness
  
    return () => clearInterval(interval);
  }, [feedback]); // 👈 IMPORTANT: depend on `feedback`
  

    // Decide color based on feedback content
    const getFeedbackColor = (feedback) => {
      if (feedback.includes("Perfect")) {
        return "green";
      } else if (feedback.includes("Pose Not Detected")) {
        return "gray";
      } else {
        return "orange";
      }
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
          {/* Stream video from Flask */}
          <img
            src="http://localhost:5001/video_feed"
            alt="Dancing Live Stream"
            width="640"
            height="480"
          />
          {/* Feedback */}
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