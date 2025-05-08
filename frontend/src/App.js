import React, { useState } from 'react';
import HomePage from './components/HomePage';
import DanceSession from './components/DanceSession';
// import SlowedDance from './components/SlowedDance'; // New
import PostAnalysis from './components/PostAnalysis';
import SuperShy from './components/SuperShy';
import './styles/App.css';

function App() {
  const [page, setPage] = useState('home');
  const [feedbackLog, setFeedbackLog] = useState([]);
  const [videoId, setVideoId] = useState(null);

  const handleEndDance = (log) => {
    setFeedbackLog(log);
    setPage('analysis');
  };

  const handleRestart = () => {
    setPage('dance');
  };

  const handleVideoProcessed = (id) => {
    console.log('Video processed with ID:', id);
    setVideoId(id);
    setPage('dance');
  };

  return (
    <div className="App">
      {page === 'home' ? (
        <HomePage onVideoProcessed={handleVideoProcessed} />
      ) : (
        <DanceSession 
          onEnd={handleEndDance} 
          onPractice={() => setPage('home')}
          videoId={videoId}
        />
      )}
      {page === 'analysis' && <PostAnalysis feedbackLog={feedbackLog} onRestart={handleRestart} />}
    </div>
  );
}

export default App;
