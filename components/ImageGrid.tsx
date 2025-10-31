import React from 'react';
import type { UploadedFile } from '../types';
import { CheckCircleIcon, PerspectiveIcon } from './Icons';

interface ImageGridProps {
  files: UploadedFile[];
  masterFileId: string | null;
  onSelectMaster: (id: string) => void;
  onTogglePerspective: (id: string) => void;
}

export const ImageGrid: React.FC<ImageGridProps> = ({ files, masterFileId, onSelectMaster, onTogglePerspective }) => {
  
  const handlePerspectiveClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent master selection when clicking the icon
    onTogglePerspective(id);
  }
  
  return (
    <div className="w-full">
      <p className="text-center text-lg text-gray-300 mb-2">1. Select the master image to align others against.</p>
      <p className="text-center text-sm text-gray-400 mb-4">2. Click the <PerspectiveIcon className="w-4 h-4 inline-block -mt-1"/> icon on images needing perspective correction.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {files.map((file) => {
          const isMaster = file.id === masterFileId;
          const needsPerspective = file.needsPerspectiveCorrection;

          return (
            <div
              key={file.id}
              onClick={() => onSelectMaster(file.id)}
              className={`relative rounded-lg overflow-hidden cursor-pointer group transition-all duration-200 transform hover:scale-105 aspect-square
                ${isMaster ? 'ring-4 ring-cyan-400 shadow-2xl shadow-cyan-500/30' : 'ring-2 ring-gray-700 hover:ring-cyan-500'}
                ${needsPerspective && !isMaster ? 'ring-offset-2 ring-offset-gray-900 ring-2 ring-blue-500' : ''}`}
            >
              <img src={file.previewUrl} alt={file.file.name} className="w-full h-full object-contain bg-gray-800" />
              
              <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <p className="text-white text-xs text-center p-1 truncate">{file.file.name}</p>
              </div>

              {isMaster && (
                <>
                  <div className="absolute inset-0 bg-cyan-500 bg-opacity-30"></div>
                  <div className="absolute top-2 right-2 bg-cyan-400 text-gray-900 rounded-full p-1">
                    <CheckCircleIcon className="w-6 h-6" />
                  </div>
                   <div className="absolute bottom-0 left-0 right-0 bg-cyan-400 text-gray-900 text-center text-xs font-bold py-0.5">
                    MASTER
                  </div>
                </>
              )}

              {!isMaster && (
                 <button
                    onClick={(e) => handlePerspectiveClick(e, file.id)}
                    className={`absolute bottom-1 right-1 p-1.5 rounded-full transition-colors duration-200
                      ${needsPerspective ? 'bg-blue-500 text-white' : 'bg-black/50 text-gray-300 hover:bg-blue-600 hover:text-white'}`}
                    title="Toggle Perspective Correction"
                  >
                    <PerspectiveIcon className="w-5 h-5" />
                  </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};