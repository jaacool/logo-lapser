export type AspectRatio = '9:16' | '1:1' | '16:9';

export interface UploadedFile {
  id: string;
  file: File;
  previewUrl: string;
  imageElement: HTMLImageElement;
  needsPerspectiveCorrection?: boolean;
}

export interface ProcessedFile {
  id: string; // To identify the master file in the processed list
  originalName: string;
  processedUrl:string;
  debugUrl: string;
}

// FIX: Define and export an interface for aistudio to resolve the type conflict, as suggested by the error message.
export interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    cv?: any; // OpenCV.js
    aistudio?: AIStudio;
  }
}
