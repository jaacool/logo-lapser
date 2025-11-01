import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Gemini API proxy endpoint
app.post('/api/generate-variation', async (req, res) => {
  try {
    console.log('Received request for variation generation');
    const { referenceImages, prompt } = req.body;
    
    console.log('Request data:', { 
      imageCount: referenceImages?.length || 0, 
      promptLength: prompt?.length || 0 
    });
    
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not configured');
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log('GoogleGenAI client created');

    if (!referenceImages || referenceImages.length === 0) {
      console.error('No reference images provided');
      return res.status(400).json({ error: 'No reference images provided' });
    }

    const imageParts = referenceImages.map(image => ({
      inlineData: {
        mimeType: 'image/png',
        data: image.processedUrl.split(',')[1], // Extract base64 from data URL
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
        const base64ImageBytes = part.inlineData.data;
        console.log('Image data extracted, returning response');
        return res.json({ 
          imageUrl: `data:image/png;base64,${base64ImageBytes}` 
        });
      }
    }
    
    throw new Error("AI did not return an image.");
  } catch (error) {
    console.error('Error generating variation:', error);
    res.status(500).json({ 
      error: 'Failed to generate variation',
      details: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
