import { GoogleGenAI, Modality } from '@google/genai';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { referenceImages, prompt } = req.body;

    // Validate input
    if (!referenceImages || !Array.isArray(referenceImages) || referenceImages.length === 0) {
      return res.status(400).json({ error: 'No reference images provided' });
    }

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'No prompt provided' });
    }

    // Check API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY not configured');
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Initialize AI client
    const ai = new GoogleGenAI({ apiKey });

    // Process images - take first 3 to avoid timeout
    const imageParts = referenceImages.slice(0, 3).map(image => ({
      inlineData: {
        mimeType: 'image/png',
        data: image.processedUrl.split(',')[1], // Extract base64 from data URL
      },
    }));

    const textPart = { text: prompt };
    const contents = { parts: [textPart, ...imageParts] };

    console.log('Generating content with', imageParts.length, 'images');

    // Generate content with timeout
    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: contents,
        config: {
          responseModalities: [Modality.IMAGE],
        },
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 45000)
      )
    ]);

    // Extract and return image
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64Image = part.inlineData.data;
        return res.json({ 
          imageUrl: `data:image/png;base64,${base64Image}` 
        });
      }
    }

    throw new Error('AI did not return an image');

  } catch (error) {
    console.error('Error generating variation:', error);
    
    // Return detailed error info
    return res.status(500).json({ 
      error: 'Failed to generate variation',
      details: error.message,
      type: error.name || 'UnknownError'
    });
  }
}
