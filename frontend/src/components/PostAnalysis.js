import React, { useState, useEffect } from 'react';
import Confetti from 'react-confetti';
import { useWindowSize } from '@react-hook/window-size';

// ——— STYLE OBJECTS ———
const ui = {
  page: {
    background: '#f7f9fc',
    fontFamily: `'Segoe UI', Roboto, Helvetica, sans-serif`,
    color: '#333',
    padding: '30px 20px',
    lineHeight: 1.6,
    minHeight: '100vh',
  },
  card: {
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    padding: '20px',
    margin: '20px auto',
    maxWidth: '1000px',
  },
  button: {
    background: 'linear-gradient(135deg,#f2504f,#ff8a00)',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '16px',
    padding: '12px 24px',
    cursor: 'pointer',
    transition: 'transform .2s ease',
    marginTop: '30px',
  },
  buttonHover: { transform: 'scale(1.05)' },
};

const PostAnalysis = ({ feedbackLog, onRestart }) => {
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedFrames, setSavedFrames] = useState([]);
  const [referenceFrames, setReferenceFrames] = useState([]);
  const [width, height] = useWindowSize();
  const [humanizedFeedbackLog, setHumanizedFeedbackLog] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSuccessModal(true);
    }, 500);

    const fetchFramesWithDelay = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      fetchSavedFrames();
      fetchReferenceFrames();
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

  const fetchReferenceFrames = async () => {
    try {
      const totalFrames = 1000;
      const interval = 30;
      const frames = Array.from({ length: Math.floor(totalFrames / interval) }, (_, i) =>
        `/reference_frames/${i * interval}.png`
      );
      setReferenceFrames(frames);
    } catch (error) {
      console.error("Error fetching reference frames:", error);
    }
  };

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      const data = await res.json();
      return data.humanizedFeedback || "";
    } catch (error) {
      console.error('Error humanizing feedback:', error);
      return "";
    }
  };

  const goodCount = feedbackLog.filter(item => item.feedback.includes("Perfect")).length;
  const totalCount = feedbackLog.length;
  const goodPercentage = totalCount > 0 ? Math.round((goodCount / totalCount) * 100) : 0;
  const badPercentage = 100 - goodPercentage;

  return (
    <div style={ui.page}>
      <div style={ui.card}>
        <h2>Post-Dance Analysis</h2>
        <p>Great job! Here's your feedback:</p>

        <div className="pose-summary">
          <p><strong>Good Poses:</strong> {goodPercentage}%</p>
          <p><strong>Needs Improvement:</strong> {badPercentage}%</p>
        </div>

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

        {/* Progress bar */}
        <div style={{
          display: 'flex',
          margin: '20px auto',
          width: '90%',
          height: '10px',
          backgroundColor: '#eee',
          borderRadius: '10px',
          overflow: 'hidden',
        }}>
          {feedbackLog.map((entry, index) => (
            <div
              key={index}
              style={{
                backgroundColor: entry.feedback.includes("Perfect") ? "green" : (entry.feedback.includes("Pose Not Detected") ? "gray" : "orange"),
                flex: 1,
                borderRight: "1px solid white",
              }}
            />
          ))}
        </div>

        {/* Dance Timeline */}
        <h3>Detailed Dance Timeline:</h3>
        <div
          id="timeline-scroll-container"
          style={{
            overflowX: 'auto',
            display: 'flex',
            scrollSnapType: 'x mandatory',
            padding: '20px 0',
            backgroundColor: '#fafafa',
            borderRadius: '10px',
          }}
        >
          {feedbackLog.map((entry, index) => (
            <div
              key={index}
              className="timeline-frame"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                width: '140px',
                margin: '0 5px',
                flexShrink: 0,
                scrollSnapAlign: 'center',
              }}
            >
              {savedFrames[index] && (
                <img
                  src={`http://localhost:5001${savedFrames[index]}`}
                  alt={`User frame at ${entry.time}s`}
                  style={{
                    width: '100%',
                    height: '100px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                    marginBottom: '5px',
                    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
                  }}
                />
              )}

              {referenceFrames[index] && (
                <img
                  src={referenceFrames[index]}
                  alt={`Reference frame ${index}`}
                  style={{
                    width: '100%',
                    height: '100px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                    marginTop: '5px',
                    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
                  }}
                />
              )}

              <div style={{
                fontSize: '12px',
                color: entry.feedback.includes("Perfect") ? "green" : (entry.feedback.includes("Pose Not Detected") ? "gray" : "orange"),
                marginTop: '6px',
                textAlign: 'center',
                maxWidth: '120px',
              }}>
                {entry.feedback.length > 30 ? entry.feedback.slice(0, 30) + '...' : entry.feedback}
              </div>

              <div style={{
                fontSize: '12px',
                color: '#777',
                marginTop: '4px',
              }}>
                {entry.time}s
              </div>
            </div>
          ))}
        </div>

        {/* Restart button */}
        <button
          onClick={onRestart}
          style={ui.button}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, ui.buttonHover)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, ui.button)}
        >
          Try Again
        </button>
      </div>

      {/* Confetti and Success Modal */}
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
            zIndex: 1000,
          }}>
            <div style={{
              backgroundColor: "white",
              padding: "40px",
              borderRadius: "12px",
              textAlign: "center",
              boxShadow: "0px 4px 12px rgba(0,0,0,0.2)",
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
                cursor: "pointer",
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