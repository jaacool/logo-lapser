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

export const generateVariation = async (
    referenceImages: ProcessedFile[], 
    prompt: string
): Promise<string> => {
    try {
        createLogEntry('START', {
            imageCount: referenceImages.length,
            promptLength: prompt.length,
            promptPreview: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
            hasApiKey: !!GEMINI_API_KEY,
            apiKeyLength: GEMINI_API_KEY.length
        });
        
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        createLogEntry('AI_CLIENT_CREATED', { model: 'gemini-2.5-flash-image' });

        const imageParts = referenceImages.map((image, index) => {
            const base64Data = dataUrlToBase64(image.processedUrl);
            createLogEntry('IMAGE_PROCESSING', {
                imageIndex: index,
                originalUrlLength: image.processedUrl.length,
                base64Length: base64Data.length,
                isValidBase64: base64Data.length > 0
            });
            
            return {
                inlineData: {
                    mimeType: 'image/png',
                    data: base64Data,
                },
            };
        });

        const textPart = { text: prompt };
        const contents = { parts: [textPart, ...imageParts] };
        
        createLogEntry('REQUEST_PREPARED', {
            totalParts: contents.parts.length,
            imagePartsCount: imageParts.length,
            contentSize: JSON.stringify(contents).length
        });

        console.log('Sending request to Gemini API...');
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: contents,
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

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
                createLogEntry('SUCCESS', { imageUrlLength: imageUrl.length });
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
            errorDetails: error.details || error.response?.data
        });
        
        console.error('Error in generateVariation:', error);
        throw error;
    }
};
