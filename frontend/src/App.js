import React, { useState } from 'react';
import HomePage from './components/HomePage';
import DanceSession from './components/DanceSession';
import SlowedDance from './components/SlowedDance'; // New
import PostAnalysis from './components/PostAnalysis';
import './styles/App.css';

function App() {
  const [page, setPage] = useState('home');
  const [feedbackLog, setFeedbackLog] = useState([]);

  const handleEndDance = (log) => {
    setFeedbackLog(log);
    setPage('analysis');
  };

  const handleRestart = () => {
    setPage('dance');
  };

  return (
    <div className="App">
      {page === 'home' && <HomePage onStart={() => setPage('dance')} />}
      {page === 'dance' && <DanceSession onEnd={handleEndDance} onPractice={() => setPage('practice')} />}
      {page === 'practice' && <SlowedDance onEnd={handleEndDance} />}
      {page === 'analysis' && <PostAnalysis feedbackLog={feedbackLog} onRestart={handleRestart} />}
    </div>
  );
}

export default App;
