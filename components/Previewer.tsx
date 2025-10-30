import React, { useState } from 'react';
import type { ProcessedFile } from '../types';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';

interface PreviewerProps {
  files: ProcessedFile[];
  isDebugMode: boolean;
}

export const Previewer: React.FC<PreviewerProps> = ({ files, isDebugMode }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToPrevious = () => {
    const isFirstSlide = currentIndex === 0;
    const newIndex = isFirstSlide ? files.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
  };

  const goToNext = () => {
    const isLastSlide = currentIndex === files.length - 1;
    const newIndex = isLastSlide ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
  };

  if (files.length === 0) {
    return null;
  }
  
  const currentFile = files[currentIndex];
  const imageUrl = isDebugMode ? currentFile.debugUrl : currentFile.processedUrl;

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className={`relative bg-gray-800 rounded-lg overflow-hidden shadow-lg ${isDebugMode ? 'aspect-auto' : 'aspect-[9/16]'}`}>
        <img
          src={imageUrl}
          alt={currentFile.originalName}
          className="w-full h-full object-contain"
        />
        <button
          onClick={goToPrevious}
          aria-label="Previous Image"
          className="absolute top-1/2 left-2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/75 transition-colors"
        >
          <ChevronLeftIcon className="h-6 w-6" />
        </button>
        <button
          onClick={goToNext}
          aria-label="Next Image"
          className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/75 transition-colors"
        >
          <ChevronRightIcon className="h-6 w-6" />
        </button>
      </div>
      <div className="text-center mt-4">
        <p className="text-gray-300">
          Image {currentIndex + 1} of {files.length}
        </p>
        <p className="text-gray-500 text-sm truncate">{currentFile.originalName}</p>
      </div>
    </div>
  );
};