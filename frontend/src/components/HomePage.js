import React from 'react';
import '../styles/HomePage.css';

const HomePage = ({ onStart }) => {
  return (
    <div className="home aura-background">
      <h1>🕺 Welcome to Choreo!</h1>
      <button onClick={onStart}>Start Dancing</button>
    </div>
  );
};

export default HomePage;
