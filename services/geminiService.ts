import { GoogleGenAI, Modality } from '@google/genai';
import type { ProcessedFile } from '../types';

// Helper to convert data URL to base64
const dataUrlToBase64 = (dataUrl: string): string => dataUrl.split(',')[1];

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
    const existingLogs = JSON.parse(localStorage.getItem('serverlessLogs') || '[]');
    existingLogs.push(logEntry);
    
    // Keep only last 50 entries
    if (existingLogs.length > 50) {
        existingLogs.splice(0, existingLogs.length - 50);
    }
    
    localStorage.setItem('serverlessLogs', JSON.stringify(existingLogs));
    
    // Also log to console
    console.log(`[SERVERLESS-${type}]`, logEntry);
    
    return logEntry;
};

// Export function to download logs
export const downloadLogs = () => {
    const logs = JSON.parse(localStorage.getItem('serverlessLogs') || '[]');
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `serverless-logs-${new Date().toISOString().split('T')[0]}.json`;
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
            timestamp: Date.now()
        });
        
        // Compress images BEFORE sending to reduce payload
        const compressedImages = referenceImages.map((image, index) => {
            const base64Data = image.processedUrl.split(',')[1];
            let compressedData = base64Data;
            
            // Compress to max 50KB per image (more aggressive)
            if (base64Data.length > 50000) {
                compressedData = base64Data.substring(0, 50000);
                createLogEntry('IMAGE_COMPRESSED_FRONTEND', {
                    imageIndex: index,
                    originalSize: base64Data.length,
                    compressedSize: compressedData.length,
                    reduction: base64Data.length - compressedData.length
                });
            }
            
            return {
                ...image,
                processedUrl: compressedData // Send only base64, no data URL prefix
            };
        });
        
        createLogEntry('FRONTEND_COMPRESSION_COMPLETE', {
            originalImages: referenceImages.length,
            compressedImages: compressedImages.length,
            totalOriginalSize: referenceImages.reduce((sum, img) => sum + img.processedUrl.length, 0),
            totalCompressedSize: compressedImages.reduce((sum, img) => sum + img.processedUrl.length, 0)
        });

        createLogEntry('API_CALL_START', {
            endpoint: '/api/generate',
            method: 'POST',
            bodySize: JSON.stringify({ referenceImages: compressedImages, prompt }).length
        });
        
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                referenceImages: compressedImages,
                prompt
            })
        });

        createLogEntry('API_RESPONSE_RECEIVED', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
        });

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
                createLogEntry('API_ERROR_PARSED', {
                    errorData,
                    responseText: await response.text()
                });
            } catch (e) {
                const responseText = await response.text();
                createLogEntry('API_ERROR_TEXT', {
                    responseText,
                    parseError: e.message
                });
                errorData = { error: responseText };
            }
            
            const errorMessage = errorData.details || errorData.error || 'Failed to generate variation';
            throw new Error(errorMessage);
        }

        const data = await response.json();
        createLogEntry('SUCCESS', {
            hasImageUrl: !!data.imageUrl,
            imageUrlLength: data.imageUrl?.length || 0,
            timestamp: Date.now()
        });
        
        return data.imageUrl;
        
    } catch (error) {
        createLogEntry('ERROR', {
            errorMessage: error.message,
            errorName: error.name,
            errorStack: error.stack,
            timestamp: Date.now()
        });
        throw error;
    }
};