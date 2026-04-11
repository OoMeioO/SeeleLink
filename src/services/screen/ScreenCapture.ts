/**
 * Screen Capture Service
 * 
 * Interface for cross-platform screen capture.
 */

export interface ScreenInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  x: number;  // Position on virtual desktop
  y: number;
  isPrimary: boolean;
}

export interface ScreenshotResult {
  base64: string;           // Base64 encoded image
  width: number;
  height: number;
  format: 'png' | 'jpeg';
  timestamp: number;
  screen?: string;
}

export interface ScreenCapture {
  // List all screens
  listScreens(): Promise<ScreenInfo[]>;
  
  // Capture full screen
  capture(screen?: string): Promise<ScreenshotResult>;
  
  // Capture specific region
  captureRegion(x: number, y: number, width: number, height: number): Promise<ScreenshotResult>;
  
  // Capture specific window
  captureWindow(windowId?: string): Promise<ScreenshotResult>;
  
  // Save to file
  captureAndSave(path: string, format?: 'png' | 'jpeg'): Promise<string>;
}
