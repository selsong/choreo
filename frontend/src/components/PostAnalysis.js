import React, { useState, useEffect } from 'react';
import Confetti from 'react-confetti';
import { useWindowSize } from '@react-hook/window-size';

const PostAnalysis = ({ feedbackLog, onRestart }) => {
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedFrames, setSavedFrames] = useState([]);
  const [width, height] = useWindowSize();  
  const [humanizedFeedbackLog, setHumanizedFeedbackLog] = useState("");


  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSuccessModal(true);
    }, 500);

    const fetchFramesWithDelay = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1 second
      fetchSavedFrames();
      //add gemini
      const feedbackTexts = feedbackLog.map(entry => entry.feedback);
      const humanized = await humanizeFeedback(feedbackTexts);
      setHumanizedFeedbackLog(humanized);
      
    };

    fetchFramesWithDelay();

    return () => clearTimeout(timer);
  }, [feedbackLog]); 

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

  const humanizeFeedback = async (feedbackTexts) => {
    try {
      const prompt = `
      You are a dance coach.
      
      Given these feedback comments about the HOT TO GO! Chappell Roan Dance:
      ${feedbackTexts.join("\n")}
      
      Write a short 2–3 sentence summary to help someone learn the dance:
      - Talk about musicality and flow (e.g., behind the beat, stiff, smooth).
      - Use analogies to famous dances, music, or trends. 
      - Encourage and motivate, even for corrections.
      - Add 2 bullet points about common mistakes made as well as analogies of how to improve so it is easier to recall. Format it so that each bullet goes on a separate line. Don't add bold or ***. 
      
      Be warm, modern, and concise.
      `;
      
      const res = await fetch('http://localhost:5001/humanize_feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt })
      });
  
      const data = await res.json();
      return data.humanizedFeedback || "";  // <- if somehow undefined
    } catch (error) {
      console.error('Error humanizing feedback:', error);
      return "";  
    }
  };
  

  return (
    <div className="post-analysis dance-sess">
      <h2>Post-Dance Analysis</h2>
      <p>Great job! Here's your feedback:</p>

      <ul>
        <li><strong>Good Poses:</strong> {goodPercentage}% </li>
        <li><strong>Needs Improvement:</strong> {badPercentage}% </li>
      </ul>

      {humanizedFeedbackLog.trim() !== "" && (() => {
  const parts = humanizedFeedbackLog.split('*').map(s => s.trim()).filter(s => s.length > 0);
  const intro = parts[0];
  const bullets = parts.slice(1);

  return (
    <div className="personalized-summary">
      <h3>Personalized Summary:</h3>
      <p style={{ fontSize: "18px", marginBottom: "20px" }}>{intro}</p>
      <ul style={{ fontSize: "18px", textAlign: "left", listStyleType: "disc", margin: "0 auto", width: "80%" }}>
        {bullets.map((bullet, index) => (
          <li key={index} style={{ marginBottom: "10px" }}>
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );
})()}


      {/* Timeline */}
      <div className="timeline-bar">
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
      <h3>Review my Moves</h3>
      <ul className="move-review-list">
        {feedbackLog.map((entry, index) => (
          <li key={index} style={{ marginBottom: "20px" }}>
          {/* {(humanizedFeedbackLog.length > 0 ? humanizedFeedbackLog : feedbackLog).map((entry, index) => (
  <li key={index} style={{ marginBottom: "20px" }}> */}
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
