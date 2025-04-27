import { useEffect, useState } from 'react';

export default function HomePage({ onStart }) {
  const [showSlogan, setShowSlogan] = useState(false);

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

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      console.log("File selected:", file.name);
      // 🔵 instead of navigate, call onStart
      onStart();
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
            DANCE LIKE <span className="font-semibold">NOBODY's</span> WATCHING
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
          <h2 className="text-4xl md:text-5xl font-bold text-blue-500">Welcome, Fiona!</h2>
          <p className="text-gray-600 text-lg">Upload your dance video to get started</p>

          <div className="bg-blue-50 border-2 border-blue-300 p-6 rounded-xl shadow-md flex flex-col items-center space-y-4">
            <label className="text-blue-500 font-semibold text-lg">
              Upload Your Dance Video
            </label>
            <input 
              type="file" 
              onChange={handleFileUpload}
              className="p-3 border-2 border-blue-300 rounded-lg cursor-pointer bg-white"
            />
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
      `}</style>
    </>
  );
}
