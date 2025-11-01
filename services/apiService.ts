import type { ProcessedFile } from '../types';

export const generateVariation = async (
    referenceImages: ProcessedFile[], 
    prompt: string
): Promise<string> => {
    try {
        console.log('Sending request to backend:', { 
            imageCount: referenceImages.length, 
            prompt: prompt.substring(0, 50) + '...' 
        });
        
        const response = await fetch('http://localhost:3001/api/generate-variation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                referenceImages,
                prompt
            })
        });

        console.log('Backend response status:', response.status);

        if (!response.ok) {
            const error = await response.json();
            console.error('Backend error:', error);
            throw new Error(error.error || 'Failed to generate variation');
        }

        const data = await response.json();
        console.log('Backend response data received');
        return data.imageUrl;
    } catch (error) {
        console.error('API Service error:', error);
        throw error;
    }
};
