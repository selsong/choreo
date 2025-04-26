import React from 'react';

const PostAnalysis = ({ onRestart }) => {
  return (
    <div className="post-analysis">
      <h2>📈 Post-Dance Analysis</h2>
      <p>Great job! Here's your feedback:</p>
      <ul>
        <li>Posture: Good!</li>
        <li>Balance: Needs a bit of work.</li>
      </ul>
      <button onClick={onRestart}>Try Again</button>
    </div>
  );
};

export default PostAnalysis;
