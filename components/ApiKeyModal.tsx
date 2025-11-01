import React from 'react';

interface ApiKeyModalProps {
  onClose: () => void;
  onKeySelected: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onClose, onKeySelected }) => {
  const handleSelectKey = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      try {
        await window.aistudio.openSelectKey();
        // Key selection was opened, now we can proceed.
        onKeySelected();
      } catch (error) {
        console.error("Error opening API key selection:", error);
        onClose(); // Close modal even on error
      }
    } else {
      alert("API key selection is not available in this environment.");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-800 rounded-lg max-w-2xl mx-auto shadow-2xl shadow-cyan-500/20 ring-1 ring-gray-700">
        <h2 className="text-2xl font-bold text-cyan-400 mb-4">Gemini API Key Required</h2>
        <p className="text-gray-300 mb-6">
          To generate creative AI variations of your logo, this application needs to use the Gemini API.
          Please select your API key to proceed.
        </p>
        <p className="text-xs text-gray-500 mb-6">
          Usage of the Gemini API may incur costs. Please review the 
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-cyan-400 underline hover:text-cyan-300 ml-1"
          >
            billing information
          </a>.
        </p>
        <div className="flex gap-4">
           <button
            onClick={onClose}
            className="px-6 py-3 font-semibold text-white bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSelectKey}
            className="px-6 py-3 font-bold text-gray-900 bg-cyan-400 rounded-lg shadow-lg hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500 transition-transform transform hover:scale-105"
          >
            Select API Key
          </button>
        </div>
      </div>
    </div>
  );
};
