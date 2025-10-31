import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { FileDropzone } from './components/FileDropzone';
import { ImageGrid } from './components/ImageGrid';
import { Previewer } from './components/Previewer';
import { processImageLocally, refineWithGoldenTemplate } from './services/imageProcessorService';
import { fileToImageElement, dataUrlToImageElement } from './utils/fileUtils';
import type { UploadedFile, ProcessedFile } from './types';
import { LogoIcon } from './components/Icons';
import { Spinner } from './components/Spinner';
import { DebugToggle } from './components/DebugToggle';
import { GreedyModeToggle } from './components/GreedyModeToggle';
import { RefinementToggle } from './components/RefinementToggle';
import { EnsembleCorrectionToggle } from './components/EnsembleCorrectionToggle';
import { PerspectiveCorrectionToggle } from './components/PerspectiveCorrectionToggle';

declare var JSZip: any;

export default function App() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [masterFileId, setMasterFileId] = useState<string | null>(null);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [cvReady, setCvReady] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isGreedyMode, setIsGreedyMode] = useState(false);
  const [isRefinementEnabled, setIsRefinementEnabled] = useState(true);
  const [isEnsembleCorrectionEnabled, setIsEnsembleCorrectionEnabled] = useState(true);
  
  useEffect(() => {
    // Check if OpenCV is loaded
    const checkCv = () => {
      if (window.cv && window.cv.getBuildInformation) {
        console.log("OpenCV is ready.");
        setCvReady(true);
      } else {
        setTimeout(checkCv, 100);
      }
    };
    checkCv();
  }, []);


  const handleFilesDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    const newFiles: UploadedFile[] = await Promise.all(
      acceptedFiles
        .filter(file => ['image/png', 'image/jpeg'].includes(file.type))
        .map(async (file) => {
          const imageElement = await fileToImageElement(file);
          return {
            id: `${file.name}-${file.lastModified}`,
            file,
            previewUrl: imageElement.src,
            imageElement: imageElement,
            needsPerspectiveCorrection: false,
          };
        })
    );
    setUploadedFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleTogglePerspective = useCallback((fileId: string) => {
    setUploadedFiles(prevFiles => 
      prevFiles.map(file => 
        file.id === fileId 
          ? { ...file, needsPerspectiveCorrection: !file.needsPerspectiveCorrection } 
          // If a file is marked for perspective correction, it cannot be the master.
          : file.id === masterFileId && file.id === fileId ? { ...file, needsPerspectiveCorrection: false } : file
      )
    );
  }, [masterFileId]);

  const allNonMasterFilesNeedPerspective = useMemo(() => {
    const nonMasterFiles = uploadedFiles.filter(f => f.id !== masterFileId);
    if (nonMasterFiles.length === 0) {
        return false;
    }
    return nonMasterFiles.every(f => f.needsPerspectiveCorrection);
  }, [uploadedFiles, masterFileId]);

  const handleToggleAllPerspective = useCallback((newValue: boolean) => {
      setUploadedFiles(prevFiles =>
          prevFiles.map(file =>
              file.id !== masterFileId
                  ? { ...file, needsPerspectiveCorrection: newValue }
                  : file
          )
      );
  }, [masterFileId]);


  const handleProcessImages = useCallback(async () => {
    if (!masterFileId || uploadedFiles.length < 1) {
      setError("Please select a master image and upload at least one other image.");
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setProcessedFiles([]);
    setProcessingProgress(0);

    const masterFile = uploadedFiles.find(f => f.id === masterFileId);
    if (!masterFile) {
      setError("Master file not found.");
      setIsProcessing(false);
      return;
    }
    
    // Ensure master file itself is not marked for perspective correction
    const standardFiles = uploadedFiles.filter(f => !f.needsPerspectiveCorrection);
    const perspectiveFiles = uploadedFiles.filter(f => f.needsPerspectiveCorrection && f.id !== masterFileId);
    const totalFiles = standardFiles.length + perspectiveFiles.length;
    let filesProcessedCount = 0;
    
    // --- STAGE 1: Process standard files ---
    setProcessingStatus('Stage 1/3: Aligning standard images...');
    let stage1Results: ProcessedFile[] = [];
    for (const targetFile of standardFiles) {
        try {
            const { processedUrl, debugUrl } = await processImageLocally(
                masterFile.imageElement,
                targetFile.imageElement,
                isGreedyMode,
                isRefinementEnabled,
                false, // No perspective correction for standard files
                targetFile.id === masterFileId
            );
            stage1Results.push({
                id: targetFile.id,
                originalName: targetFile.file.name,
                processedUrl,
                debugUrl,
            });
            filesProcessedCount++;
            setProcessingProgress((filesProcessedCount / totalFiles) * 100);
            setProcessedFiles([...stage1Results]); // Show incremental progress
        } catch (err) {
            console.error("Error processing standard file:", targetFile.file.name, err);
            setError(`Failed during standard alignment of ${targetFile.file.name}.`);
            setIsProcessing(false);
            return;
        }
    }

    // --- STAGE 2: Ensemble Correction on standard files ---
    let finalStandardResults = stage1Results;
    if (isEnsembleCorrectionEnabled && standardFiles.length > 1) {
        setProcessingStatus('Stage 2/3: Applying ensemble correction...');
        const masterResult = stage1Results.find(f => f.id === masterFileId);
        if (masterResult) {
            const goldenTemplateElement = await dataUrlToImageElement(masterResult.processedUrl);
            const refinedResults: ProcessedFile[] = [masterResult];
            const otherFiles = stage1Results.filter(f => f.id !== masterFileId);

            for (const fileToRefine of otherFiles) {
                const refinedUrl = await refineWithGoldenTemplate(fileToRefine.processedUrl, goldenTemplateElement);
                refinedResults.push({ ...fileToRefine, processedUrl: refinedUrl });
            }
            finalStandardResults = refinedResults;
            setProcessedFiles(finalStandardResults);
        }
    }

    // --- STAGE 3: Process perspective files against the corrected master ---
    let finalResults = [...finalStandardResults];
    if (perspectiveFiles.length > 0) {
        setProcessingStatus('Stage 3/3: Correcting perspective images...');
        const processedMasterResult = finalStandardResults.find(f => f.id === masterFileId);
        if (!processedMasterResult) {
             setError("Could not find processed master to align perspective images.");
             setIsProcessing(false);
             return;
        }

        const processedMasterElement = await dataUrlToImageElement(processedMasterResult.processedUrl);

        for (const targetFile of perspectiveFiles) {
            try {
                // First pass: correct the perspective
                const { processedUrl, debugUrl } = await processImageLocally(
                    processedMasterElement, // Use the CLEAN, processed master
                    targetFile.imageElement,
                    isGreedyMode,
                    isRefinementEnabled,
                    true, // Enable perspective correction
                    false
                );
                
                // Second pass: refine the now perspective-corrected image for a perfect fit
                const refinedUrl = await refineWithGoldenTemplate(processedUrl, processedMasterElement);

                finalResults.push({
                    id: targetFile.id,
                    originalName: targetFile.file.name,
                    processedUrl: refinedUrl, // Use the final refined URL
                    debugUrl,
                });
                filesProcessedCount++;
                setProcessingProgress((filesProcessedCount / totalFiles) * 100);
                setProcessedFiles([...finalResults]);
            } catch (err) {
                console.error("Error processing perspective file:", targetFile.file.name, err);
                setError(`Failed during perspective correction of ${targetFile.file.name}.`);
                // Continue to show other results
            }
        }
    }

    setProcessedFiles(finalResults);
    setIsProcessing(false);
    setProcessingStatus('Processing Complete');
  }, [masterFileId, uploadedFiles, isGreedyMode, isRefinementEnabled, isEnsembleCorrectionEnabled]);

  const handleExport = useCallback(async () => {
    if (processedFiles.length === 0 || isExporting) return;
    
    setIsExporting(true);
    setError(null);

    try {
      const zip = new JSZip();
      
      const sortedFiles = [...processedFiles].sort((a, b) => a.originalName.localeCompare(b.originalName));

      sortedFiles.forEach((file, index) => {
        const base64Data = file.processedUrl.split(',')[1];
        const paddedIndex = String(index + 1).padStart(4, '0');
        const originalNameWithoutExt = file.originalName.split('.').slice(0, -1).join('.');
        const fileName = `matched_logo_${paddedIndex}_${originalNameWithoutExt}.png`;
        
        zip.file(fileName, base64Data, { base64: true });
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = 'matched_logos.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

    } catch (err) {
      console.error("Error creating ZIP file:", err);
      setError("Could not create the ZIP file. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [processedFiles, isExporting]);
  
  const handleBackToSelection = () => {
    setProcessedFiles([]);
    setProcessingStatus('');
    setError(null);
  };

  const canProcess = useMemo(() => masterFileId && uploadedFiles.length > 0 && cvReady, [masterFileId, uploadedFiles.length, cvReady]);

  const resetState = () => {
    uploadedFiles.forEach(file => URL.revokeObjectURL(file.previewUrl));
    setUploadedFiles([]);
    setMasterFileId(null);
    setProcessedFiles([]);
    setIsProcessing(false);
    setError(null);
    setProcessingProgress(0);
    setProcessingStatus('');
  };

  if (!cvReady) {
    return (
       <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center text-center p-4">
          <Spinner />
          <h1 className="text-2xl font-semibold mt-4 text-cyan-400">Loading Vision Engine...</h1>
          <p className="text-gray-400 mt-2">Getting the image processing tools ready.</p>
       </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col p-4 sm:p-6 lg:p-8">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <LogoIcon className="h-8 w-8 text-cyan-400" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Logo Match Cut <span className="text-cyan-400">AI</span>
          </h1>
        </div>
        {(uploadedFiles.length > 0) && (
          <button
            onClick={resetState}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
          >
            Start Over
          </button>
        )}
      </header>

      <main className="flex-grow flex flex-col">
          <>
            {error && (
              <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-md relative mb-6" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            {processedFiles.length > 0 && !isProcessing ? (
              <div className="flex flex-col items-center">
                <Previewer 
                  files={processedFiles} 
                  masterFileId={masterFileId}
                  isDebugMode={isDebugMode}
                  onSetDebugMode={setIsDebugMode}
                  onBackToSelection={handleBackToSelection}
                />
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="mt-6 w-full max-w-xs px-6 py-3 text-lg font-bold text-gray-900 bg-cyan-400 rounded-lg shadow-lg hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500 transition-transform transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-wait"
                >
                  {isExporting ? 'Zipping files...' : 'Export All as ZIP'}
                </button>
              </div>
            ) : isProcessing ? (
              <div className="flex flex-col items-center justify-center flex-grow text-center">
                 <Spinner />
                 <p className="text-xl font-semibold mt-4 text-cyan-400">{processingStatus || 'Aligning your images locally...'}</p>
                 <p className="text-gray-400 mt-2">This may take a few moments. Your files are not being uploaded.</p>
                 <div className="w-full max-w-md bg-gray-700 rounded-full h-2.5 mt-6">
                    <div className="bg-cyan-400 h-2.5 rounded-full" style={{ width: `${processingProgress}%` }}></div>
                 </div>
                 <p className="mt-2 text-sm text-gray-300">{Math.round(processingProgress)}% complete</p>
              </div>
            ) : (
              <>
                {uploadedFiles.length === 0 ? (
                  <FileDropzone onDrop={handleFilesDrop} />
                ) : (
                  <div className="flex flex-col items-center">
                     <ImageGrid 
                        files={uploadedFiles} 
                        masterFileId={masterFileId} 
                        onSelectMaster={setMasterFileId}
                        onTogglePerspective={handleTogglePerspective}
                      />
                     <div className="mt-8 w-full max-w-4xl flex flex-col items-center gap-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full justify-center max-w-4xl p-4 bg-gray-800/50 rounded-lg">
                          <GreedyModeToggle isChecked={isGreedyMode} onChange={setIsGreedyMode} />
                          <RefinementToggle isChecked={isRefinementEnabled} onChange={setIsRefinementEnabled} />
                          <EnsembleCorrectionToggle isChecked={isEnsembleCorrectionEnabled} onChange={setIsEnsembleCorrectionEnabled} />
                          <PerspectiveCorrectionToggle isChecked={allNonMasterFilesNeedPerspective} onChange={handleToggleAllPerspective} />
                        </div>
                        <button
                          onClick={handleProcessImages}
                          disabled={!canProcess}
                          className="w-full max-w-xs mt-4 px-6 py-3 text-lg font-bold text-gray-900 bg-cyan-400 rounded-lg shadow-lg disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500 transition-transform transform enabled:hover:scale-105"
                        >
                          Go! Align Images
                        </button>
                     </div>
                     {!canProcess && uploadedFiles.length > 0 && <p className="mt-2 text-sm text-yellow-400">Please select a master image to continue.</p>}
                  </div>
                )}
              </>
            )}
          </>
      </main>
    </div>
  );
}