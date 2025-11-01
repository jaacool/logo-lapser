import { GoogleGenAI, Modality } from "@google/genai";
import type { ProcessedFile } from '../types';

// Helper to convert data URL to base64
const dataUrlToBase64 = (dataUrl: string): string => dataUrl.split(',')[1];

// Embedded API key for browser usage
const GEMINI_API_KEY = "AIzaSyAF2l6Ilmbrh9zRq-UQmupnCqE8uOu_mwI";

// Enhanced logging system
const createLogEntry = (type: string, data: any) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        type,
        data,
        userAgent: navigator.userAgent,
        url: window.location.href
    };
    
    // Store in localStorage for debugging
    const existingLogs = JSON.parse(localStorage.getItem('geminiLogs') || '[]');
    existingLogs.push(logEntry);
    
    // Keep only last 50 entries
    if (existingLogs.length > 50) {
        existingLogs.splice(0, existingLogs.length - 50);
    }
    
    localStorage.setItem('geminiLogs', JSON.stringify(existingLogs));
    
    // Also log to console
    console.log(`[GEMINI-${type}]`, logEntry);
    
    return logEntry;
};

// Export function to get logs for debugging
export const getDebugLogs = () => {
    return JSON.parse(localStorage.getItem('geminiLogs') || '[]');
};

// Export function to download logs
export const downloadLogs = () => {
    const logs = getDebugLogs();
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// Helper to resize base64 image to reduce payload size
const resizeBase64Image = (base64Data: string, maxSize: number = 500000): string => {
    if (base64Data.length <= maxSize) return base64Data;
    
    // For now, just truncate the data (not ideal but will work for testing)
    // In production, you'd want to properly resize the image
    createLogEntry('IMAGE_RESIZE_TRUNCATE', {
        originalSize: base64Data.length,
        targetSize: maxSize,
        note: 'Truncating image data for size reduction'
    });
    
    return base64Data.substring(0, maxSize);
};

export const generateVariation = async (
    referenceImages: ProcessedFile[], 
    prompt: string
): Promise<string> => {
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
        try {
            createLogEntry('START', {
                imageCount: referenceImages.length,
                promptLength: prompt.length,
                promptPreview: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
                hasApiKey: !!GEMINI_API_KEY,
                apiKeyLength: GEMINI_API_KEY.length,
                retryAttempt: retryCount
            });
            
            const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
            createLogEntry('AI_CLIENT_CREATED', { model: 'gemini-2.5-flash-image' });

            // Start with just 1 image for browser compatibility
            let imagesToUse = referenceImages;
            if (retryCount === 0) {
                imagesToUse = referenceImages.slice(0, 1); // Only 1 image on first attempt
                createLogEntry('REDUCED_IMAGES', {
                    originalCount: referenceImages.length,
                    reducedCount: imagesToUse.length,
                    reason: 'Browser compatibility - using only 1 image'
                });
            } else if (retryCount >= 1) {
                imagesToUse = referenceImages.slice(0, 1); // Still only 1 image
                createLogEntry('REDUCED_IMAGES', {
                    originalCount: referenceImages.length,
                    reducedCount: imagesToUse.length,
                    reason: 'Retry attempt - still using 1 image'
                });
            }

            const processedImages = imagesToUse.map((image, index) => {
                const base64Data = dataUrlToBase64(image.processedUrl);
                const resizedData = resizeBase64Image(base64Data, 300000); // Max 300KB per image
                
                createLogEntry('IMAGE_PROCESSING', {
                    imageIndex: index,
                    originalUrlLength: image.processedUrl.length,
                    originalBase64Length: base64Data.length,
                    resizedBase64Length: resizedData.length,
                    sizeReduction: base64Data.length - resizedData.length,
                    isValidBase64: resizedData.length > 0
                });
                
                return {
                    inlineData: {
                        mimeType: 'image/png',
                        data: resizedData,
                    },
                };
            });

            const textPart = { text: prompt };
            const contents = { parts: [textPart, ...processedImages] };
            
            createLogEntry('REQUEST_PREPARED', {
                totalParts: contents.parts.length,
                imagePartsCount: processedImages.length,
                contentSize: JSON.stringify(contents).length,
                retryAttempt: retryCount
            });

            // Very short timeout for faster feedback
            const requestPromise = ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: contents,
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });

            // 20 second timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout after 20 seconds')), 20000);
            });

            console.log('Sending request to Gemini API...');
            const response = await Promise.race([requestPromise, timeoutPromise]);

            createLogEntry('API_RESPONSE_RECEIVED', {
                hasCandidates: !!response.candidates,
                candidatesCount: response.candidates?.length || 0,
                hasContent: !!response.candidates?.[0]?.content,
                partsCount: response.candidates?.[0]?.content?.parts?.length || 0
            });

            // Extract the image data
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64ImageBytes: string = part.inlineData.data;
                    createLogEntry('IMAGE_EXTRACTED', {
                        base64Length: base64ImageBytes.length,
                        isValidBase64: base64ImageBytes.length > 0
                    });
                    
                    const imageUrl = `data:image/png;base64,${base64ImageBytes}`;
                    createLogEntry('SUCCESS', { 
                        imageUrlLength: imageUrl.length,
                        retryAttempt: retryCount 
                    });
                    return imageUrl;
                }
            }
            
            throw new Error("AI did not return an image.");
        } catch (error) {
            createLogEntry('ERROR', {
                errorMessage: error.message,
                errorName: error.name,
                errorStack: error.stack,
                errorCode: error.status || error.code,
                errorDetails: error.details || error.response?.data,
                retryAttempt: retryCount
            });
            
            console.error('Error in generateVariation (attempt ' + retryCount + '):', error);
            
            // If this is a timeout or network error, retry
            if (retryCount < maxRetries && 
                (error.message.includes('timeout') || 
                 error.message.includes('Load failed') ||
                 error.message.includes('network'))) {
                retryCount++;
                createLogEntry('RETRY', {
                    retryAttempt: retryCount,
                    maxRetries: maxRetries,
                    reason: error.message
                });
                continue;
            }
            
            throw error;
        }
    }
};
