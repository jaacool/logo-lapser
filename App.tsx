import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { FileDropzone } from './components/FileDropzone';
import { ImageGrid } from './components/ImageGrid';
import { Previewer } from './components/Previewer';
import { processImageLocally, refineWithGoldenTemplate } from './services/imageProcessorService';
import { generateVariation } from './services/geminiService';
import { fileToImageElement, dataUrlToImageElement } from './utils/fileUtils';
import type { UploadedFile, ProcessedFile, AspectRatio } from './types';
import { JaaCoolMediaLogo, LogoIcon } from './components/Icons';
import { Spinner } from './components/Spinner';
import { DebugToggle } from './components/DebugToggle';
import { GreedyModeToggle } from './components/GreedyModeToggle';
import { RefinementToggle } from './components/RefinementToggle';
import { EnsembleCorrectionToggle } from './components/EnsembleCorrectionToggle';
import { PerspectiveCorrectionToggle } from './components/PerspectiveCorrectionToggle';
import { AspectRatioSelector } from './components/AspectRatioSelector';
import { AIVariationsToggle } from './components/AIVariationsToggle';
import { VariationSelector } from './components/VariationSelector';
import { PromptCustomizer } from './components/PromptCustomizer';

declare var JSZip: any;

const AI_PROMPT_BASE = "Generate a completely new and creative photorealistic image. Crucially, the logo must appear perfectly flat and be viewed from a direct, head-on, frontal perspective, with zero angle or perspective distortion.The reference images show this exact logo. Your task is to create a completely new, photorealistic background scene. The logo's shape, colors, style, position, scale, and 2D rotation must be identical to the references. Do not wrap, bend, skew, or apply any 3D perspective to the logo itself.";

const DEFAULT_PROMPT_SNIPPETS: string[] = [
    'a storefront',
    'a product',
    'clothing',
    'a digital screen',
    'graffiti on a wall',
    'a hand written post it',
    'a flyer in a hand',
    'a mug print',
    'an embroidered logo on a baseball cap',
    'an embroidered logo on a T-shirt',
    'a trade show display'
];


const getFriendlyErrorMessage = (err: any, context: string) => {
    const rawMessage = err.message || 'An unknown error occurred.';
    if (rawMessage.includes('Not enough good matches')) {
        return `Alignment failed for "${context}". The image may be too blurry, low-contrast, or different from the master. Tip: Try enabling "Greedy Mode" for difficult images.`;
    }
    return `An error occurred with "${context}": ${rawMessage}`;
};

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
  const [isAiVariationsEnabled, setIsAiVariationsEnabled] = useState(false);
  const [numVariations, setNumVariations] = useState<number>(1);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [fixingImageId, setFixingImageId] = useState<string | null>(null);
  const [promptSnippets, setPromptSnippets] = useState<string[]>(DEFAULT_PROMPT_SNIPPETS);
  const [selectedSnippets, setSelectedSnippets] = useState<string[]>(DEFAULT_PROMPT_SNIPPETS);
  
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

    const storedSnippets = localStorage.getItem('logoLapserPromptSnippets');
    if (storedSnippets) {
        try {
            const parsedSnippets = JSON.parse(storedSnippets);
            if (Array.isArray(parsedSnippets) && parsedSnippets.every(s => typeof s === 'string')) {
                setPromptSnippets(parsedSnippets);
                if (parsedSnippets.length > 0) {
                    setSelectedSnippets(parsedSnippets);
                }
            }
        } catch (e) {
            console.error("Failed to parse stored prompt snippets:", e);
        }
    }
  }, []);

  const handleAiToggleChange = async (enabled: boolean) => {
    if (enabled) {
      // For serverless API, no key check needed - just enable
      setIsAiVariationsEnabled(true);
    } else {
      setIsAiVariationsEnabled(false);
    }
  };

  const handleAddSnippet = (newSnippet: string) => {
    const trimmedSnippet = newSnippet.trim();
    if (trimmedSnippet && !promptSnippets.includes(trimmedSnippet)) {
        const updatedSnippets = [...promptSnippets, trimmedSnippet];
        setPromptSnippets(updatedSnippets);
        setSelectedSnippets(prev => [...prev, trimmedSnippet]);
        localStorage.setItem('logoLapserPromptSnippets', JSON.stringify(updatedSnippets));
    }
  };

  const handleSnippetSelectionChange = (updatedSelection: string[]) => {
      setSelectedSnippets(updatedSelection);
  };


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

  const handleBackToSelection = useCallback(() => {
    setProcessedFiles([]);
    setProcessingStatus('');
    setError(null);
  }, []);

  const handleDeleteUploadedFile = useCallback((idToDelete: string) => {
    setUploadedFiles(prev => {
        const fileToDelete = prev.find(f => f.id === idToDelete);
        if (fileToDelete) {
            URL.revokeObjectURL(fileToDelete.previewUrl);
        }
        return prev.filter(f => f.id !== idToDelete);
    });
    if (masterFileId === idToDelete) {
        setMasterFileId(null);
    }
  }, [masterFileId]);

  const handleDeleteProcessedFile = useCallback((idToDelete: string) => {
    const newProcessed = processedFiles.filter(f => f.id !== idToDelete);
    setUploadedFiles(prev => {
        const fileToDelete = prev.find(f => f.id === idToDelete);
        if (fileToDelete && !idToDelete.startsWith('ai-var-')) { // Don't remove from uploaded if it was AI generated
            URL.revokeObjectURL(fileToDelete.previewUrl);
            return prev.filter(f => f.id !== idToDelete);
        }
        return prev;
    });
    setProcessedFiles(newProcessed);
    if (masterFileId === idToDelete) {
        setMasterFileId(null);
    }
    if (newProcessed.length === 0) {
        handleBackToSelection();
    }
  }, [processedFiles, masterFileId, handleBackToSelection]);


  const handleProcessImages = useCallback(async () => {
    if (!masterFileId || uploadedFiles.length < 1) {
      setError("Please select a master image and upload at least one other image.");
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setProcessedFiles([]);
    setProcessingProgress(0);
    setProcessingStatus('Initializing processor...');

    const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

    setTimeout(async () => {
        const masterFile = uploadedFiles.find(f => f.id === masterFileId);
        if (!masterFile) {
            setError("Master file not found.");
            setIsProcessing(false);
            return;
        }

        const standardFiles = uploadedFiles.filter(f => !f.needsPerspectiveCorrection);
        const perspectiveFiles = uploadedFiles.filter(f => f.needsPerspectiveCorrection && f.id !== masterFileId);
        const totalAlignmentFiles = standardFiles.length + perspectiveFiles.length;
        const totalSteps = totalAlignmentFiles + (isAiVariationsEnabled ? numVariations : 0);
        let stepsCompleted = 0;
        
        const alignmentStages = 2 + (perspectiveFiles.length > 0 ? 1 : 0);
        const generationStages = (isAiVariationsEnabled ? 1 : 0); // Generation + Alignment is now a single stage
        const totalStages = alignmentStages + generationStages;
        let currentStage = 1;

        // --- STAGE 1: Process standard files ---
        setProcessingStatus(`Stage ${currentStage}/${totalStages}: Aligning standard images...`);
        await yieldToMain();
        
        let stage1Results: ProcessedFile[] = [];
        for (const targetFile of standardFiles) {
            try {
                const { processedUrl, debugUrl } = await processImageLocally(
                    masterFile.imageElement, targetFile.imageElement, isGreedyMode, isRefinementEnabled,
                    false, targetFile.id === masterFileId, aspectRatio
                );
                stage1Results.push({ id: targetFile.id, originalName: targetFile.file.name, processedUrl, debugUrl });
                setProcessedFiles([...stage1Results]);
            } catch (err) {
                console.error("Error processing standard file:", targetFile.file.name, err);
                setError(prev => (prev ? prev + ' | ' : '') + getFriendlyErrorMessage(err, targetFile.file.name));
            }
            stepsCompleted++;
            setProcessingProgress((stepsCompleted / totalSteps) * 100);
            await yieldToMain();
        }
        currentStage++;

        // --- STAGE 2: Ensemble Correction on standard files ---
        let stage2Results = stage1Results;
        if (isEnsembleCorrectionEnabled && stage1Results.length > 1) {
            setProcessingStatus(`Stage ${currentStage}/${totalStages}: Applying ensemble correction...`);
            await yieldToMain();

            const masterResult = stage1Results.find(f => f.id === masterFileId);
            if (masterResult) {
                const goldenTemplateElement = await dataUrlToImageElement(masterResult.processedUrl);
                const refinedResults: ProcessedFile[] = [masterResult];
                const otherFiles = stage1Results.filter(f => f.id !== masterFileId);

                for (const fileToRefine of otherFiles) {
                    const refinedUrl = await refineWithGoldenTemplate(fileToRefine.processedUrl, goldenTemplateElement);
                    refinedResults.push({ ...fileToRefine, processedUrl: refinedUrl });
                    await yieldToMain();
                }
                stage2Results = refinedResults;
                setProcessedFiles(stage2Results);
            }
        }
        currentStage++;

        // --- STAGE 3: Process perspective files ---
        let finalResults = [...stage2Results];
        if (perspectiveFiles.length > 0) {
            setProcessingStatus(`Stage ${currentStage}/${totalStages}: Correcting perspective images...`);
            await yieldToMain();

            const processedMasterResult = stage2Results.find(f => f.id === masterFileId);
            if (!processedMasterResult) {
                 setError("Could not find processed master for perspective alignment.");
                 setIsProcessing(false);
                 return;
            }
            const processedMasterElement = await dataUrlToImageElement(processedMasterResult.processedUrl);

            for (const targetFile of perspectiveFiles) {
                try {
                    const { processedUrl, debugUrl } = await processImageLocally(
                        processedMasterElement, targetFile.imageElement, isGreedyMode, isRefinementEnabled,
                        true, false, aspectRatio
                    );
                    const refinedUrl = await refineWithGoldenTemplate(processedUrl, processedMasterElement);
                    finalResults.push({ id: targetFile.id, originalName: targetFile.file.name, processedUrl: refinedUrl, debugUrl });
                    setProcessedFiles([...finalResults]);
                } catch (err) {
                    console.error("Error processing perspective file:", targetFile.file.name, err);
                    setError(prev => (prev ? prev + ' | ' : '') + getFriendlyErrorMessage(err, targetFile.file.name));
                }
                stepsCompleted++;
                setProcessingProgress((stepsCompleted / totalSteps) * 100);
                await yieldToMain();
            }
        }
        currentStage++;
        
        // --- STAGE 4: AI Variations (in Parallel) ---
        if (isAiVariationsEnabled && numVariations > 0) {
            setProcessingStatus(`Stage ${currentStage}/${totalStages}: Generating & aligning AI variations...`);
            await yieldToMain();

            const processedMasterResult = finalResults.find(f => f.id === masterFileId);
            if (!processedMasterResult) {
                setError("Could not find processed master for AI generation.");
                setIsProcessing(false);
                return;
            }
            const processedMasterElement = await dataUrlToImageElement(processedMasterResult.processedUrl);

            const variationPromises = Array.from({ length: numVariations }).map(async (_, i) => {
                try {
                    // Cycle through selected snippets for variation.
                    const availableSnippets = selectedSnippets.length > 0 ? selectedSnippets : DEFAULT_PROMPT_SNIPPETS;
                    const snippet = availableSnippets[i % availableSnippets.length];
                    const finalPrompt = `${AI_PROMPT_BASE} The background should be a novel setting, like ${snippet}, but the logo must always remain perfectly frontal and flat over it.`;

                    // Step 1: Generate
                    const generatedDataUrl = await generateVariation(finalResults, finalPrompt);

                    // Step 2: Align
                    const refinedUrl = await refineWithGoldenTemplate(generatedDataUrl, processedMasterElement);
                    
                    return {
                        id: `ai-var-${i}-${Date.now()}`,
                        originalName: `AI_Variation_${String(i + 1).padStart(2, '0')}.png`,
                        processedUrl: refinedUrl,
                        debugUrl: generatedDataUrl,
                    };
                } catch (err: any) {
                    const errorMessage = `Failed to create AI variation ${i + 1}.`;
                    console.error(errorMessage, err);
                    
                    let detailedError = '';
                    if (err.message && err.message.includes('Requested entity was not found')) {
                        detailedError = 'API key selection error. Please try selecting your API key again.';
                    } else {
                        try {
                            const errorJson = JSON.parse(err.message);
                            if (errorJson?.error?.message) {
                                detailedError = errorJson.error.message;
                            }
                        } catch (e) {
                             detailedError = err.message; // Fallback to raw message
                        }
                    }
                    
                    setError(prev => (prev ? prev + ' | ' : '') + `${errorMessage} ${detailedError}`);
                    return null; // Return null for failed promises
                }
            });

            const newVariations = (await Promise.all(variationPromises)).filter(v => v !== null) as ProcessedFile[];
            
            finalResults.push(...newVariations);
            
            stepsCompleted += numVariations; // Update progress for all variations at once
            setProcessingProgress((stepsCompleted / totalSteps) * 100);
            setProcessedFiles([...finalResults]);
            await yieldToMain();
        }

        setProcessedFiles(finalResults);
        setIsProcessing(false);
        setProcessingStatus('Processing Complete');
    }, 0);
  }, [masterFileId, uploadedFiles, isGreedyMode, isRefinementEnabled, isEnsembleCorrectionEnabled, aspectRatio, isAiVariationsEnabled, numVariations, selectedSnippets, promptSnippets]);

  const handlePerspectiveFix = useCallback(async (fileId: string) => {
    if (fixingImageId || !masterFileId) return;

    setFixingImageId(fileId);
    setError(null);

    try {
        const processedMasterFile = processedFiles.find(f => f.id === masterFileId);
        if (!processedMasterFile) {
            throw new Error("Processed master file not found.");
        }
        
        let targetImageElement: HTMLImageElement;
        const targetUploadedFile = uploadedFiles.find(f => f.id === fileId);

        if (targetUploadedFile) {
            // It's a user-uploaded file
            targetImageElement = targetUploadedFile.imageElement;
        } else {
            // It's likely an AI variation, find its original (unaligned) data from the processed files list
            const targetProcessedFile = processedFiles.find(f => f.id === fileId);
            if (!targetProcessedFile || !targetProcessedFile.debugUrl) {
                throw new Error("Required files for perspective fix not found.");
            }
            // The `debugUrl` for AI variations stores the original, unaligned image data URL.
            targetImageElement = await dataUrlToImageElement(targetProcessedFile.debugUrl);
        }

        const processedMasterElement = await dataUrlToImageElement(processedMasterFile.processedUrl);

        const { processedUrl: tempUrl, debugUrl } = await processImageLocally(
            processedMasterElement,
            targetImageElement,
            isGreedyMode,
            isRefinementEnabled,
            true, // Force perspective correction
            false,
            aspectRatio
        );

        const finalUrl = await refineWithGoldenTemplate(tempUrl, processedMasterElement);

        setProcessedFiles(prevFiles =>
            prevFiles.map(file =>
                file.id === fileId
                    ? { ...file, processedUrl: finalUrl, debugUrl }
                    : file
            )
        );

    } catch (err: any) {
        console.error("Error during perspective fix:", err);
        const targetFile = processedFiles.find(f => f.id === fileId) || uploadedFiles.find(f => f.id === fileId);
        const fileName = targetFile?.originalName || `item ${fileId}`;
        setError(getFriendlyErrorMessage(err, fileName));
    } finally {
        setFixingImageId(null);
    }
  }, [fixingImageId, masterFileId, uploadedFiles, processedFiles, isGreedyMode, isRefinementEnabled, aspectRatio]);

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
      <header className="flex items-start justify-between mb-6">
        <div>
          <JaaCoolMediaLogo className="h-5 w-auto mb-2" />
          <div className="flex items-center gap-3">
            <LogoIcon className="h-8 w-8 text-cyan-400" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Logo-Lapser
            </h1>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
            <span className="text-xs font-mono text-gray-500">v5.0</span>
            {(uploadedFiles.length > 0) && (
            <button
                onClick={resetState}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
            >
                Start Over
            </button>
            )}
        </div>
      </header>

      <main className="flex-grow flex flex-col">
          <>
            {error && (
              <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-md relative mb-6" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline whitespace-pre-wrap">{error}</span>
              </div>
            )}

            {processedFiles.length > 0 && !isProcessing ? (
              <div className="flex flex-col items-center">
                <Previewer 
                  files={processedFiles} 
                  originalFiles={uploadedFiles}
                  masterFileId={masterFileId}
                  isDebugMode={isDebugMode}
                  onSetDebugMode={setIsDebugMode}
                  onBackToSelection={handleBackToSelection}
                  aspectRatio={aspectRatio}
                  onDelete={handleDeleteProcessedFile}
                  onPerspectiveFix={handlePerspectiveFix}
                  fixingImageId={fixingImageId}
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
                        onDelete={handleDeleteUploadedFile}
                      />
                     <div className="mt-8 w-full max-w-5xl flex flex-col items-center gap-6">
                        <AspectRatioSelector selectedRatio={aspectRatio} onSelectRatio={setAspectRatio} />
                        
                        <div className="w-full max-w-5xl p-4 bg-gray-800/50 rounded-lg">
                            <h3 className="text-center text-lg text-gray-300 mb-4">4. Alignment & Correction Controls</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 place-items-center">
                              <GreedyModeToggle isChecked={isGreedyMode} onChange={setIsGreedyMode} />
                              <RefinementToggle isChecked={isRefinementEnabled} onChange={setIsRefinementEnabled} />
                              <EnsembleCorrectionToggle isChecked={isEnsembleCorrectionEnabled} onChange={setIsEnsembleCorrectionEnabled} />
                              <PerspectiveCorrectionToggle isChecked={allNonMasterFilesNeedPerspective} onChange={handleToggleAllPerspective} />
                            </div>
                        </div>

                        <div className="w-full max-w-5xl p-4 bg-gray-800/50 rounded-lg">
                            <h3 className="text-center text-lg text-gray-300 mb-4">5. Generative AI Controls</h3>
                            <div className="flex flex-col items-center justify-center gap-6">
                                <AIVariationsToggle isChecked={isAiVariationsEnabled} onChange={handleAiToggleChange} />
                                {isAiVariationsEnabled && (
                                    <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-6">
                                        <VariationSelector selectedValue={numVariations} onSelectValue={setNumVariations} max={6} />
                                        <PromptCustomizer
                                            snippets={promptSnippets}
                                            selectedSnippets={selectedSnippets}
                                            onSelectionChange={handleSnippetSelectionChange}
                                            onAddSnippet={handleAddSnippet}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <button
                          onClick={handleProcessImages}
                          disabled={!canProcess}
                          className="w-full max-w-xs mt-2 px-6 py-3 text-lg font-bold text-gray-900 bg-cyan-400 rounded-lg shadow-lg disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500 transition-transform transform enabled:hover:scale-105"
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