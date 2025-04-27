import React, { useState } from 'react';
import HomePage from './components/HomePage';
import DanceSession from './components/DanceSession';
import PostAnalysis from './components/PostAnalysis';
import './styles/App.css';

function App() {
  const [page, setPage] = useState('home');
  const [feedbackLog, setFeedbackLog] = useState([]); // 🆕 store feedback log

  // Handler when DanceSession ends
  const handleEndDance = (log) => {
    setFeedbackLog(log); // save feedback log
    setPage('analysis'); // go to analysis page
  };

  // Handler when restarting
  const handleRestart = () => {
    setPage('dance');
  };

  return (
    <div className="App">
      {page === 'home' && <HomePage onStart={() => setPage('dance')} />}
      {page === 'dance' && <DanceSession onEnd={handleEndDance} />}
      {page === 'analysis' && <PostAnalysis feedbackLog={feedbackLog} onRestart={handleRestart} />}
    </div>
  );
}

export default App;
