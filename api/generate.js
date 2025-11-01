// === VERSION v5.6 - RADICAL PAYBACK OPTIMIZATION ===
// Should be deployed on Vercel - frontend sends raw base64 (50KB each)
import { GoogleGenAI, Modality } from '@google/genai';

// Helper function to create log entries
const createLog = (type, data) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type,
    data,
    environment: process.env.NODE_ENV || 'unknown'
  };
  console.log(`[API-${type}]`, JSON.stringify(logEntry, null, 2));
  return logEntry;
};

export default async function handler(req, res) {
  const startTime = Date.now();
  createLog('REQUEST_START', {
    method: req.method,
    contentType: req.headers['content-type'],
    userAgent: req.headers['user-agent'],
    bodySize: JSON.stringify(req.body).length
  });

  // Only allow POST requests
  if (req.method !== 'POST') {
    createLog('METHOD_ERROR', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { referenceImages, prompt } = req.body;
    
    createLog('REQUEST_PARSED', {
      hasReferenceImages: !!referenceImages,
      imageCount: referenceImages?.length || 0,
      hasPrompt: !!prompt,
      promptLength: prompt?.length || 0,
      promptPreview: prompt?.substring(0, 100) + (prompt?.length > 100 ? '...' : '')
    });

    // Validate input
    if (!referenceImages || !Array.isArray(referenceImages) || referenceImages.length === 0) {
      createLog('VALIDATION_ERROR', { error: 'No reference images provided' });
      return res.status(400).json({ error: 'No reference images provided' });
    }

    if (!prompt || typeof prompt !== 'string') {
      createLog('VALIDATION_ERROR', { error: 'No prompt provided' });
      return res.status(400).json({ error: 'No prompt provided' });
    }

    // Check API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      createLog('API_KEY_ERROR', { error: 'GEMINI_API_KEY not configured' });
      return res.status(500).json({ error: 'API key not configured' });
    }

    createLog('API_KEY_FOUND', { 
      keyLength: apiKey.length,
      keyPrefix: apiKey.substring(0, 10) + '...'
    });

    // Initialize AI client
    createLog('AI_CLIENT_INIT_START', {});
    const ai = new GoogleGenAI({ apiKey });
    createLog('AI_CLIENT_INIT_SUCCESS', {});

    // Process images - compress all images to fit size limit
    const imagesToProcess = referenceImages;
    createLog('IMAGE_PROCESSING_START', {
      totalImages: referenceImages.length,
      processingImages: imagesToProcess.length,
      reason: 'Compress all images to fit Vercel size limit'
    });

    const imageParts = imagesToProcess.map((image, index) => {
      // processedUrl is now just base64 data, not full data URL
      const base64Data = image.processedUrl;
      
      createLog('IMAGE_PROCESSED', {
        imageIndex: index,
        originalUrlLength: image.processedUrl.length,
        finalBase64Length: base64Data.length,
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

    createLog('GEMINI_REQUEST_START', {
      imageCount: imageParts.length,
      totalContentSize: JSON.stringify(contents).length
    });

    // Generate content with timeout
    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: contents,
        config: {
          responseModalities: [Modality.IMAGE],
        },
      }),
      new Promise((_, reject) => {
        setTimeout(() => {
          createLog('TIMEOUT_ERROR', { elapsed: Date.now() - startTime });
          reject(new Error('Request timeout after 45 seconds'));
        }, 45000);
      })
    ]);

    createLog('GEMINI_RESPONSE_RECEIVED', {
      hasCandidates: !!response.candidates,
      candidatesCount: response.candidates?.length || 0,
      elapsed: Date.now() - startTime
    });

    // Extract and return image
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64Image = part.inlineData.data;
        createLog('IMAGE_EXTRACTED', {
          base64Length: base64Image.length,
          elapsed: Date.now() - startTime
        });
        
        const imageUrl = `data:image/png;base64,${base64Image}`;
        createLog('SUCCESS', {
          imageUrlLength: imageUrl.length,
          totalElapsed: Date.now() - startTime
        });
        
        return res.json({ imageUrl });
      }
    }

    createLog('NO_IMAGE_ERROR', { elapsed: Date.now() - startTime });
    throw new Error('AI did not return an image');

  } catch (error) {
    createLog('CATCH_ERROR', {
      errorMessage: error.message,
      errorName: error.name,
      errorStack: error.stack,
      elapsed: Date.now() - startTime
    });
    
    // Return detailed error info
    return res.status(500).json({ 
      error: 'Failed to generate variation',
      details: error.message,
      type: error.name || 'UnknownError',
      elapsed: Date.now() - startTime
    });
  }
}
