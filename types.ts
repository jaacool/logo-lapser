export interface UploadedFile {
  id: string;
  file: File;
  previewUrl: string;
  imageElement: HTMLImageElement;
  needsPerspectiveCorrection?: boolean;
}

export interface ProcessedFile {
  id?: string; // To identify the master file in the processed list
  originalName: string;
  processedUrl:string;
  debugUrl: string;
}

declare global {
  interface Window {
    cv?: any; // OpenCV.js
  }
}