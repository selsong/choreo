import React, { useState, useEffect } from 'react';
import Confetti from 'react-confetti';
import { useWindowSize } from '@react-hook/window-size';

const PostAnalysis = ({ feedbackLog, onRestart }) => {
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedFrames, setSavedFrames] = useState([]);
  const [width, height] = useWindowSize();  // 📏 moved to top

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSuccessModal(true);
    }, 500);

    const fetchFramesWithDelay = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1 second
      fetchSavedFrames();
    };

    fetchFramesWithDelay();

    return () => clearTimeout(timer);
  }, []);

  const fetchSavedFrames = async () => {
    try {
      const res = await fetch('http://localhost:5001/list_saved_frames');
      const data = await res.json();
      if (data.frames) {
        setSavedFrames(data.frames);
      }
    } catch (error) {
      console.error("Error fetching saved frames:", error);
    }
  };

  const goodCount = feedbackLog.filter(item => item.feedback.includes("Perfect")).length;
  const totalCount = feedbackLog.length;

  const goodPercentage = totalCount > 0 ? Math.round((goodCount / totalCount) * 100) : 0;
  const badPercentage = 100 - goodPercentage;

  const timelineSegments = feedbackLog.map((entry, index) => ({
    key: index,
    color: entry.feedback.includes("Perfect") ? "green" : (entry.feedback.includes("Pose Not Detected") ? "gray" : "orange"),
  }));

  return (
    <div className="post-analysis" style={{ textAlign: "center", padding: "20px" }}>
      <h2>📈 Post-Dance Analysis</h2>
      <p>Great job! Here's your feedback:</p>

      <ul style={{ fontSize: "18px", listStyleType: "none", padding: 0 }}>
        <li><strong>Good Poses:</strong> {goodPercentage}% ✅</li>
        <li><strong>Needs Improvement:</strong> {badPercentage}% ⚠️</li>
      </ul>

      {/* Timeline */}
      <div style={{ display: 'flex', margin: '20px auto', width: '80%', height: '20px', backgroundColor: '#eee', borderRadius: '10px', overflow: 'hidden' }}>
        {timelineSegments.map(segment => (
          <div
            key={segment.key}
            style={{
              backgroundColor: segment.color,
              flex: 1,
              borderRight: "1px solid white"
            }}
          />
        ))}
      </div>

      {/* Detailed feedback */}
      <h3>📝 Detailed Feedback with Screenshots:</h3>
      <ul style={{ textAlign: "left", margin: "0 auto", width: "80%" }}>
        {feedbackLog.map((entry, index) => (
          <li key={index} style={{ marginBottom: "20px" }}>
            <strong>{entry.time}s:</strong> {entry.feedback}
            <br />
            {savedFrames[index] && (
              <img
                src={`http://localhost:5001${savedFrames[index]}`}
                alt={`Frame at ${entry.time}s`}
                style={{
                  width: "200px",
                  marginTop: "10px",
                  borderRadius: "8px",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.2)"
                }}
              />
            )}
          </li>
        ))}
      </ul>

      {/* Restart Button */}
      <button onClick={onRestart} className="end-dance-button" style={{ marginTop: '30px', padding: '10px 20px', fontSize: '18px' }}>
        Try Again
      </button>

      {/* 🎉 Confetti + Modal */}
      {showSuccessModal && (
        <>
          <Confetti width={width} height={height} />
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: "white",
              padding: "40px",
              borderRadius: "12px",
              textAlign: "center",
              boxShadow: "0px 4px 12px rgba(0,0,0,0.2)"
            }}>
              <h2>🎉 Session Complete!</h2>
              <p style={{ fontSize: "18px", margin: "20px 0" }}>
                Amazing work! Ready to improve even more?
              </p>
              <button onClick={() => setShowSuccessModal(false)} style={{
                padding: "10px 20px",
                fontSize: "16px",
                borderRadius: "8px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                cursor: "pointer"
              }}>
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PostAnalysis;
