/**
 * Mouse Control Service
 * 
 * Interface for cross-platform mouse control.
 * Each platform has its own implementation.
 */

export interface MousePosition {
  x: number;
  y: number;
  screen?: string;
}

export type MouseButton = 'left' | 'right' | 'middle';

export interface MouseControl {
  // Position
  getPosition(): Promise<MousePosition>;
  setPosition(x: number, y: number): Promise<void>;
  
  // Click
  click(x: number, y: number, button?: MouseButton): Promise<void>;
  doubleClick(x: number, y: number): Promise<void>;
  
  // Drag
  drag(from: MousePosition, to: MousePosition): Promise<void>;
  
  // Press/Release (for drag operations)
  mouseDown(x: number, y: number, button: MouseButton): Promise<void>;
  mouseUp(x: number, y: number, button: MouseButton): Promise<void>;
  
  // Scroll
  scroll(x: number, y: number, deltaX: number, deltaY: number): Promise<void>;
}
