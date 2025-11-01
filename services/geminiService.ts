import { GoogleGenAI, Modality } from '@google/genai';
import type { ProcessedFile } from '../types';

// Helper to convert data URL to base64
const dataUrlToBase64 = (dataUrl: string): string => dataUrl.split(',')[1];

export const generateVariation = async (
    referenceImages: ProcessedFile[], 
    prompt: string
): Promise<string> => {
    try {
        console.log('Sending request to serverless API...');
        
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                referenceImages,
                prompt
            })
        });

        console.log('API response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.details || errorData.error || 'Failed to generate variation';
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('Successfully generated variation');
        return data.imageUrl;
        
    } catch (error) {
        console.error('Error in generateVariation:', error);
        throw error;
    }
};