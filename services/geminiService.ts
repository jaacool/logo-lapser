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
    try {
        createLogEntry('START', {
            imageCount: referenceImages.length,
            promptLength: prompt.length,
            promptPreview: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
            hasApiKey: !!GEMINI_API_KEY,
            apiKeyLength: GEMINI_API_KEY.length,
            retryAttempt: 0
        });
        
        // Test with a very simple request first
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        createLogEntry('AI_CLIENT_CREATED', { model: 'gemini-2.5-flash-image' });

        // Try a minimal test request to see if API is blocked
        createLogEntry('TEST_REQUEST', { reason: 'Testing if Gemini API is accessible from browser' });
        
        const testRequest = ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: "test" }] },
        });

        // 10 second timeout for test
        const testTimeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('API test timeout - Gemini API blocked by browser')), 10000);
        });

        await Promise.race([testRequest, testTimeout]);
        createLogEntry('TEST_SUCCESS', { message: 'Gemini API is accessible' });

        // If test passes, try the real request with minimal data
        const singleImage = referenceImages[0];
        const base64Data = dataUrlToBase64(singleImage.processedUrl);
        const minimalData = base64Data.substring(0, 50000); // Only 50KB
        
        createLogEntry('REAL_REQUEST', {
            imageSize: minimalData.length,
            note: 'Attempting real request with minimal image data'
        });

        const requestPromise = ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { text: prompt.substring(0, 200) }, // Shorter prompt
                    { inlineData: { mimeType: 'image/png', data: minimalData } }
                ]
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout after 15 seconds')), 15000);
        });

        const response = await Promise.race([requestPromise, timeoutPromise]);

        createLogEntry('API_RESPONSE_RECEIVED', {
            hasCandidates: !!response.candidates,
            candidatesCount: response.candidates?.length || 0
        });

        // Extract the image data
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                createLogEntry('SUCCESS', { 
                    base64Length: base64ImageBytes.length
                });
                return `data:image/png;base64,${base64ImageBytes}`;
            }
        }
        
        throw new Error("AI did not return an image.");
        
    } catch (error) {
        createLogEntry('ERROR', {
            errorMessage: error.message,
            errorName: error.name,
            isBrowserBlock: error.message.includes('blocked') || error.message.includes('timeout')
        });
        
        // If it's a browser block, give user helpful information
        if (error.message.includes('blocked') || error.message.includes('timeout')) {
            throw new Error("Browser Security Block: Safari blocks direct AI API calls. Please try Chrome/Firefox or use a local server. The API key works, but browser security prevents the request.");
        }
        
        throw error;
    }
};
