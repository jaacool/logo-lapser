import { GoogleGenAI, Modality } from "@google/genai";
import type { ProcessedFile } from '../types';

// Helper to convert data URL to base64
const dataUrlToBase64 = (dataUrl: string): string => dataUrl.split(',')[1];

// Embedded API key for browser usage
const GEMINI_API_KEY = "AIzaSyAF2l6Ilmbrh9zRq-UQmupnCqE8uOu_mwI";

export const generateVariation = async (
    referenceImages: ProcessedFile[], 
    prompt: string
): Promise<string> => {
    try {
        console.log('Generating variation with', referenceImages.length, 'images');
        
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

        const imageParts = referenceImages.map(image => ({
            inlineData: {
                mimeType: 'image/png',
                data: dataUrlToBase64(image.processedUrl),
            },
        }));

        const textPart = {
            text: prompt,
        };

        const contents = { parts: [textPart, ...imageParts] };

        console.log('Sending request to Gemini API...');
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: contents,
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        console.log('Gemini API response received');

        // Extract the image data
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                console.log('Image data extracted successfully');
                return `data:image/png;base64,${base64ImageBytes}`;
            }
        }
        
        throw new Error("AI did not return an image.");
    } catch (error) {
        console.error('Error in generateVariation:', error);
        throw error;
    }
};
