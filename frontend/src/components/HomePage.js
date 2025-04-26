import React from 'react';

const HomePage = ({ onStart }) => {
  return (
    <div className="home">
      <h1>🕺 Welcome to Choreo!</h1>
      <button onClick={onStart}>Start Dancing</button>
    </div>
  );
};

export default HomePage;
