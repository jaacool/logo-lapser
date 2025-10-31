import React, { useState, useEffect } from 'react';
import type { ProcessedFile, UploadedFile } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, GridIcon, SingleViewIcon, PlayIcon, PauseIcon } from './Icons';
import { DebugToggle } from './DebugToggle';

interface PreviewerProps {
  files: ProcessedFile[];
  originalFiles: UploadedFile[];
  masterFileId: string | null;
  isDebugMode: boolean;
  onSetDebugMode: (value: boolean) => void;
  onBackToSelection: () => void;
}

export const Previewer: React.FC<PreviewerProps> = ({ 
    files, 
    originalFiles,
    masterFileId,
    isDebugMode, 
    onSetDebugMode,
    onBackToSelection
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('grid');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // Reset index if files array changes to avoid out-of-bounds errors
    const masterIndex = files.findIndex(f => f.id === masterFileId);
    setCurrentIndex(masterIndex !== -1 ? masterIndex : 0);
  }, [files, masterFileId]);

  useEffect(() => {
    if (!isPlaying || files.length === 0) {
      return;
    }

    const intervalId = setInterval(() => {
      setCurrentIndex(prevIndex => (prevIndex + 1) % files.length);
    }, 1000 / 8); // 8 fps

    return () => clearInterval(intervalId);
  }, [isPlaying, files.length]);

  const handleNext = () => {
    setIsPlaying(false);
    setCurrentIndex((prevIndex) => (prevIndex + 1) % files.length);
  };

  const handlePrev = () => {
    setIsPlaying(false);
    setCurrentIndex((prevIndex) => (prevIndex - 1 + files.length) % files.length);
  };

  const handleViewModeChange = (mode: 'grid' | 'single') => {
    if (mode === 'grid') {
      setIsPlaying(false);
    }
    setViewMode(mode);
  };

  const handlePlayToggle = () => {
    if (!isPlaying) {
      setViewMode('single');
    }
    setIsPlaying(prev => !prev);
  };
  
  if (files.length === 0) {
    return null;
  }
  
  const currentFile = files[currentIndex];
  const originalFile = originalFiles.find(f => f.id === currentFile.id);
  const isCurrentFileMaster = currentFile?.id === masterFileId;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-center">
      <div className="w-full flex flex-col sm:flex-row justify-between items-center mb-4 gap-4 p-2 bg-gray-800/50 rounded-lg">
        <div className="text-center sm:text-left">
            <h2 className="text-xl font-semibold">Processing Complete</h2>
            <p className="text-sm text-gray-400">Review the final aligned results below.</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap justify-center">
             <button 
                onClick={onBackToSelection}
                className="px-3 py-2 text-sm font-semibold text-white bg-gray-600 rounded-md hover:bg-gray-500 transition-colors flex items-center gap-2"
                title="Go back to change master or other settings"
            >
                <ChevronLeftIcon className="w-5 h-5" />
                <span>Change Selection</span>
            </button>
            <div className="flex items-center bg-gray-700 rounded-md p-1">
              <button onClick={() => handleViewModeChange('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-cyan-500 text-white' : 'text-gray-400 hover:bg-gray-600'}`} aria-label="Grid View">
                  <GridIcon className="w-5 h-5" />
              </button>
              <button onClick={() => handleViewModeChange('single')} className={`p-1.5 rounded ${viewMode === 'single' && !isPlaying ? 'bg-cyan-500 text-white' : 'text-gray-400 hover:bg-gray-600'}`} aria-label="Single View">
                  <SingleViewIcon className="w-5 h-5" />
              </button>
              <button onClick={handlePlayToggle} className={`p-1.5 rounded ${isPlaying ? 'bg-cyan-500 text-white' : 'text-gray-400 hover:bg-gray-600'}`} aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
              </button>
            </div>
            <DebugToggle isChecked={isDebugMode} onChange={onSetDebugMode} />
        </div>
      </div>

       {viewMode === 'single' && (
        <div className="w-full flex flex-col items-center mb-4">
            <div className="relative w-full max-w-xl group">
                 <div className="grid grid-cols-2 gap-8">
                    {/* Original Image */}
                    <div className="flex flex-col items-center">
                        <h3 className="text-lg font-semibold text-gray-400 mb-2">Original</h3>
                        <div className="w-full aspect-[9/16] bg-gray-900 rounded-lg overflow-hidden">
                            {originalFile && (
                                <img 
                                    src={originalFile.previewUrl} 
                                    alt={`Original - ${originalFile.file.name}`}
                                    className="w-full h-full object-contain"
                                />
                            )}
                        </div>
                    </div>
                    {/* Processed Image */}
                    <div className="flex flex-col items-center">
                         <h3 className="text-lg font-semibold text-cyan-400 mb-2">Processed</h3>
                        <div className="w-full aspect-[9/16] bg-gray-900 rounded-lg overflow-hidden">
                            <img 
                                src={(isDebugMode ? currentFile.debugUrl : currentFile.processedUrl) || currentFile.processedUrl} 
                                alt={currentFile.originalName} 
                                className="w-full h-full object-contain"
                            />
                        </div>
                    </div>
                </div>
                {!isPlaying && (
                  <>
                    <button onClick={handlePrev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 disabled:opacity-20" aria-label="Previous image">
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <button onClick={handleNext} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 disabled:opacity-20" aria-label="Next image">
                        <ChevronRightIcon className="w-6 h-6" />
                    </button>
                  </>
                )}
            </div>
            <div className="text-center mt-3 p-2 rounded-md bg-gray-800 w-full max-w-xl">
                <p className="text-sm text-gray-300 truncate font-mono" title={currentFile.originalName}>
                    {`[${currentIndex + 1}/${files.length}] `}{currentFile.originalName}
                </p>
                 {isCurrentFileMaster && (
                     <p className="text-xs font-bold text-cyan-400 mt-1">MASTER IMAGE</p>
                 )}
            </div>
        </div>
      )}

      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 w-full">
            {files.map((file) => {
            const isMaster = file.id === masterFileId;
            const imageUrl = (isDebugMode ? file.debugUrl : file.processedUrl) || file.processedUrl;
            
            return (
                <div
                key={file.id}
                className={`relative rounded-lg overflow-hidden group transition-all duration-200 transform hover:scale-105 aspect-square
                    ${isMaster 
                        ? 'ring-4 ring-cyan-400 shadow-2xl shadow-cyan-500/30' 
                        : 'ring-2 ring-gray-700'}
                `}
                >
                <img src={imageUrl} alt={file.originalName} className="w-full h-full object-contain bg-gray-800" />
                
                {isMaster && (
                    <>
                        <div className="absolute inset-0 bg-cyan-500/30"></div>
                        <div className="absolute bottom-0 left-0 right-0 bg-cyan-400 text-gray-900 text-center text-xs font-bold py-0.5">
                        MASTER
                        </div>
                    </>
                )}

                <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs text-center truncate">{file.originalName}</p>
                </div>
                </div>
            );
            })}
        </div>
      )}
    </div>
  );
};