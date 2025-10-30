import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { FileDropzone } from './components/FileDropzone';
import { ImageGrid } from './components/ImageGrid';
import { Previewer } from './components/Previewer';
import { ProjectManager } from './components/ProjectManager';
import { processImageLocally, refineWithGoldenTemplate } from './services/imageProcessorService';
import { fileToImageElement, dataUrlToImageElement } from './utils/fileUtils';
import type { UploadedFile, ProcessedFile } from './types';
import { LogoIcon } from './components/Icons';
import { Spinner } from './components/Spinner';
import { DebugToggle } from './components/DebugToggle';
import { GreedyModeToggle } from './components/GreedyModeToggle';
import { RefinementToggle } from './components/RefinementToggle';
import { EnsembleCorrectionToggle } from './components/EnsembleCorrectionToggle';

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
  const [showProjectManager, setShowProjectManager] = useState(false);

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
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          return {
            id: `${file.name}-${file.lastModified}`,
            file,
            previewUrl: imageElement.src,
            imageElement: imageElement,
            dataUrl,
          };
        })
    );
    setUploadedFiles(prev => [...prev, ...newFiles]);
  }, []);

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

    const filesToProcess = uploadedFiles;
    const totalFiles = filesToProcess.length;
    let initialProcessedFiles: ProcessedFile[] = [];

    // --- STAGE 1: Initial Alignment ---
    setProcessingStatus('Stage 1/2: Performing initial alignment...');
    for (let i = 0; i < totalFiles; i++) {
      const targetFile = filesToProcess[i];
      try {
        const { processedUrl, debugUrl } = await processImageLocally(
            masterFile.imageElement, 
            targetFile.imageElement, 
            isGreedyMode,
            isRefinementEnabled,
            targetFile.id === masterFileId // Pass if current file is master
        );
        initialProcessedFiles.push({
          id: targetFile.id,
          originalName: targetFile.file.name,
          processedUrl,
          debugUrl,
        });
        setProcessedFiles([...initialProcessedFiles]);
        setProcessingProgress(((i + 1) / totalFiles) * 100);
      } catch (err) {
        console.error("Error processing file:", targetFile.file.name, err);
        let errorMessage = `Failed to process ${targetFile.file.name}.`;
        if (err instanceof Error) {
            errorMessage += ` Please try again. Details: ${err.message}`;
        }
        setError(errorMessage);
        setIsProcessing(false);
        return;
      }
    }
    
    // --- STAGE 2: Ensemble Correction ---
    if (isEnsembleCorrectionEnabled && totalFiles > 1) {
        setProcessingStatus('Stage 2/2: Applying ensemble correction for consistency...');
        setProcessingProgress(0);

        const goldenTemplateResult = initialProcessedFiles.find(f => f.id === masterFileId);
        if (!goldenTemplateResult) {
            setError("Could not find the processed master image for ensemble correction.");
            setIsProcessing(false);
            return;
        }

        const goldenTemplateElement = await dataUrlToImageElement(goldenTemplateResult.processedUrl);
        const finalProcessedFiles: ProcessedFile[] = [goldenTemplateResult];
        const otherFiles = initialProcessedFiles.filter(f => f.id !== masterFileId);

        for (let i = 0; i < otherFiles.length; i++) {
            const fileToRefine = otherFiles[i];
            try {
                const refinedUrl = await refineWithGoldenTemplate(fileToRefine.processedUrl, goldenTemplateElement);
                finalProcessedFiles.push({ ...fileToRefine, processedUrl: refinedUrl });
                setProcessedFiles([...finalProcessedFiles]);
                setProcessingProgress(((i + 1) / otherFiles.length) * 100);
            } catch (err) {
                console.error("Error during ensemble correction:", fileToRefine.originalName, err);
                // In case of error, just use the initially processed one
                finalProcessedFiles.push(fileToRefine);
                setProcessedFiles([...finalProcessedFiles]);
            }
        }
        setProcessedFiles(finalProcessedFiles);
    } else {
       setProcessedFiles(initialProcessedFiles);
    }


    setIsProcessing(false);
  }, [masterFileId, uploadedFiles, isGreedyMode, isRefinementEnabled, isEnsembleCorrectionEnabled]);

  const handleExport = useCallback(async () => {
    if (processedFiles.length === 0 || isExporting) return;
    
    setIsExporting(true);
    setError(null);

    try {
      const zip = new JSZip();

      processedFiles.forEach((file, index) => {
        // Extract base64 data from data URL
        const base64Data = file.processedUrl.split(',')[1];
        const paddedIndex = String(index + 1).padStart(4, '0');
        const originalNameWithoutExt = file.originalName.split('.').slice(0, -1).join('.');
        const fileName = `matched_logo_${paddedIndex}_${originalNameWithoutExt}.png`;
        
        // Add file to zip
        zip.file(fileName, base64Data, { base64: true });
      });

      // Generate zip file and trigger download
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

  const canProcess = useMemo(() => masterFileId && uploadedFiles.length > 0 && cvReady, [masterFileId, uploadedFiles.length, cvReady]);

  const resetState = () => {
    // Revoke blob URLs to prevent memory leaks
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

      <main className="flex-grow flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-6xl">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-center flex-grow">Logo Lapser</h1>
            <button
              onClick={() => setShowProjectManager(!showProjectManager)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              {showProjectManager ? 'Verbergen' : 'Projekte'}
            </button>
          </div>

          {showProjectManager && (
            <div className="mb-8">
              <ProjectManager 
                onLoadProject={(files) => {
                  setUploadedFiles(files);
                  setProcessedFiles([]);
                  setMasterFileId(null);
                  setShowProjectManager(false);
                }}
                currentFiles={uploadedFiles}
                processedFiles={processedFiles}
              />
            </div>
          )}
            {error && (
              <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-md relative mb-6" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            {processedFiles.length > 0 && !isProcessing ? (
              <div className="flex flex-col items-center">
                <div className="w-full max-w-4xl flex justify-between items-center mb-2">
                    <h2 className="text-xl font-semibold">Processing Complete</h2>
                    <DebugToggle isChecked={isDebugMode} onChange={setIsDebugMode} />
                </div>
                <Previewer files={processedFiles} isDebugMode={isDebugMode} />
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="mt-6 w-full max-w-xs px-6 py-3 text-lg font-bold text-gray-900 bg-cyan-400 rounded-lg shadow-lg hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500 transition-transform transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-wait"
                >
                  {isExporting ? 'Zipping files...' : 'Export All as ZIP'}
                </button>
              </div>
            ) : isProcessing ? (
              <main className="flex-grow flex flex-col items-center justify-center px-4 py-8">
                <div className="w-full max-w-6xl">
                  <div className="flex justify-between items-center mb-8">
                    <h1 className="text-4xl font-bold text-center flex-grow">Logo Lapser</h1>
                    <button
                      onClick={() => setShowProjectManager(!showProjectManager)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      {showProjectManager ? 'Verbergen' : 'Projekte'}
                    </button>
                  </div>

                  {showProjectManager && (
                    <div className="mb-8">
                      <ProjectManager 
                        onLoadProject={(files) => {
                          setUploadedFiles(files);
                          setProcessedFiles([]);
                          setMasterFileId(null);
                          setShowProjectManager(false);
                        }}
                        currentFiles={uploadedFiles}
                        processedFiles={processedFiles}
                      />
                    </div>
                  )}
                  <p className="text-xl font-semibold mt-4 text-cyan-400">{processingStatus || 'Aligning your images locally...'}</p>
                  <p className="text-gray-400 mt-2">This may take a few moments. Your files are not being uploaded.</p>
                  <div className="w-full max-w-md bg-gray-700 rounded-full h-2.5 mt-6">
                    <div className="bg-cyan-400 h-2.5 rounded-full" style={{ width: `${processingProgress}%` }}></div>
                  </div>
                  <p className="mt-2 text-sm text-gray-300">{Math.round(processingProgress)}% complete</p>
                </div>
              </main>
            ) : (
              <>
                {uploadedFiles.length === 0 ? (
                  <FileDropzone onDrop={handleFilesDrop} />
                ) : (
                  <div className="flex flex-col items-center">
                     <ImageGrid files={uploadedFiles} masterFileId={masterFileId} onSelectMaster={setMasterFileId} />
                     <div className="mt-8 w-full max-w-3xl flex flex-col items-center gap-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full justify-center">
                          <GreedyModeToggle isChecked={isGreedyMode} onChange={setIsGreedyMode} />
                          <RefinementToggle isChecked={isRefinementEnabled} onChange={setIsRefinementEnabled} />
                           <EnsembleCorrectionToggle isChecked={isEnsembleCorrectionEnabled} onChange={setIsEnsembleCorrectionEnabled} />
                        </div>
                         <div className="w-full flex justify-center mt-4">
                            <DebugToggle isChecked={isDebugMode} onChange={setIsDebugMode} />
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
          </div>
      </main>
    </div>
  );
}