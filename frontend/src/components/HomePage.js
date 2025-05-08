import { useEffect, useState } from 'react';

export default function HomePage({ onStart }) {
  const [showSlogan, setShowSlogan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tiktokLink, setTiktokLink] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setShowSlogan(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const scrollToUpload = () => {
    const uploadSection = document.getElementById('upload');
    if (uploadSection) {
      uploadSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const validateTiktokLink = (link) => {
    // Basic TikTok link validation
    const tiktokRegex = /^https?:\/\/((?:vm|vt|www)\.)?tiktok\.com\/.*\/video\/\d+/;
    return tiktokRegex.test(link);
  };

  const handleTiktokSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateTiktokLink(tiktokLink)) {
      setError('Please enter a valid TikTok video link');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:5001/process_tiktok', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tiktokLink }),
      });

      if (!response.ok) {
        throw new Error('Failed to process TikTok video');
      }

      const data = await response.json();
      console.log('Video processed:', data);
      onStart(data.video_id); // Pass video ID to parent
    } catch (err) {
      setError('Failed to process video. Please try again.');
      console.error('Error processing video:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Hero Section */}
      <div className="min-h-screen w-full bg-gradient-to-br from-blue-300 via-blue-400 to-blue-500 flex flex-col items-center justify-center relative overflow-hidden">
        
        {/* Logo Image */}
        <img
          src="/choreo.png"
          alt="Choreo Logo"
          className="w-4/5 md:w-2/3 max-w-4xl animate-fadeIn mb-4"
        />

        {/* Slogan */}
        {showSlogan && (
          <p className="text-white text-xl md:text-2xl font-light animate-fadeUp">
            DANCE LIKE <span className="font-semibold">NOBODY'S</span> WATCHING
          </p>
        )}

        {/* Down Arrow */}
        <div 
          className="absolute bottom-10 animate-bounce cursor-pointer"
          onClick={scrollToUpload}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="white" className="w-10 h-10">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

      {/* Upload Section */}
      <div id="upload" className="min-h-screen w-full flex flex-col items-center justify-center bg-white p-10">
        <div className="text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold text-blue-500">Welcome to Choreo!</h2>
          <p className="text-gray-600 text-lg">Paste a TikTok dance video link to get started</p>

          <div className="bg-blue-50 border-2 border-blue-300 p-6 rounded-xl shadow-md flex flex-col items-center space-y-4 max-w-2xl mx-auto">
            {!loading ? (
              <form onSubmit={handleTiktokSubmit} className="w-full space-y-4">
                <div className="flex flex-col space-y-2">
                  <label className="text-blue-500 font-semibold text-lg">
                    TikTok Video Link
                  </label>
                  <input 
                    type="text" 
                    value={tiktokLink}
                    onChange={(e) => setTiktokLink(e.target.value)}
                    placeholder="https://www.tiktok.com/@username/video/1234567890"
                    className="p-3 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  {error && (
                    <p className="text-red-500 text-sm mt-1">{error}</p>
                  )}
                </div>
                <button 
                  type="submit"
                  className="w-full bg-blue-500 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Start Dancing
                </button>
              </form>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <div className="loader"></div>
                <p className="text-blue-500 font-semibold text-lg">Processing your video...</p>
                <p className="text-gray-500 text-sm">This may take a few moments</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fadeIn {
          animation: fadeIn 1.5s ease forwards;
        }

        .animate-fadeUp {
          animation: fadeUp 1.5s ease forwards;
        }

        .loader {
          border: 5px solid #cbd5e1;
          border-top: 5px solid #3b82f6;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
