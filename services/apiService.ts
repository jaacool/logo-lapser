import type { ProcessedFile } from '../types';

export const generateVariation = async (
    referenceImages: ProcessedFile[], 
    prompt: string
): Promise<string> => {
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

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate variation');
    }

    const data = await response.json();
    return data.imageUrl;
};
