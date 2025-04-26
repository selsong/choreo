import React, { useState } from 'react';
import HomePage from './components/HomePage';
import DanceSession from './components/DanceSession';
import PostAnalysis from './components/PostAnalysis';
import './styles/App.css';

function App() {
  const [page, setPage] = useState('home');

  return (
    <div className="App">
      {page === 'home' && <HomePage onStart={() => setPage('dance')} />}
      {page === 'dance' && <DanceSession onEnd={() => setPage('analysis')} />}
      {page === 'analysis' && <PostAnalysis onRestart={() => setPage('dance')} />}
    </div>
  );
}

export default App;
