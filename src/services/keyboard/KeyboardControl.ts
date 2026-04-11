/**
 * Keyboard Control Service
 * 
 * Interface for cross-platform keyboard control.
 */

export type KeyModifier = 'ctrl' | 'alt' | 'shift' | 'meta';

export interface KeyboardControl {
  // Text input
  typeText(text: string): Promise<void>;
  
  // Single key press
  pressKey(key: string): Promise<void>;
  
  // Key combinations (e.g., Ctrl+A)
  pressKeys(keys: (string | KeyModifier)[]): Promise<void>;
  
  // Common shortcuts
  copy(): Promise<void>;
  paste(): Promise<void>;
  cut(): Promise<void>;
  selectAll(): Promise<void>;
  
  // Control keys
  enter(): Promise<void>;
  escape(): Promise<void>;
  tab(): Promise<void>;
  backspace(): Promise<void>;
  delete(): Promise<void>;
  
  // Arrow keys
  arrowUp(): Promise<void>;
  arrowDown(): Promise<void>;
  arrowLeft(): Promise<void>;
  arrowRight(): Promise<void>;
  
  // Function keys
  functionKey(n: number): Promise<void>;
  
  // Hold/Release keys (for complex interactions)
  holdKey(key: string): Promise<void>;
  releaseKey(key: string): Promise<void>;
}
