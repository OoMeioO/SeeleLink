/**
 * Windows Screen Capture Implementation
 * 
 * Uses PowerShell and System.Drawing for screen capture.
 */

import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { ScreenCapture, ScreenInfo, ScreenshotResult } from '../ScreenCapture';
import { DebugService } from '../../debug/DebugService';

const execAsync = promisify(exec);

export class WindowsScreen implements ScreenCapture {
  private debug: DebugService;
  
  constructor(debug: DebugService) {
    this.debug = debug;
  }
  
  async listScreens(): Promise<ScreenInfo[]> {
    try {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        $screens = [System.Windows.Forms.Screen]::AllScreens
        $result = @()
        for ($i = 0; $i -lt $screens.Length; $i++) {
          $s = $screens[$i]
          $result += @{
            id = "screen_$i"
            name = if ($s.Primary) { "Primary Display" } else { "Display $($i + 1)" }
            width = $s.Bounds.Width
            height = $s.Bounds.Height
            x = $s.Bounds.X
            y = $s.Bounds.Y
            isPrimary = $s.Primary
          }
        }
        $result | ConvertTo-Json -Compress
      `;
      
      const { stdout } = await execAsync(
        `powershell -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`
      );
      
      const screens = JSON.parse(stdout.trim());
      const screenArray = Array.isArray(screens) ? screens : [screens];
      
      this.debug.info('WindowsScreen', 'listScreens', { count: screenArray.length });
      return screenArray;
    } catch (error) {
      this.debug.error('WindowsScreen', 'listScreens', error);
      throw error;
    }
  }
  
  async capture(screen?: string): Promise<ScreenshotResult> {
    try {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $bmp = New-Object System.Drawing.Bitmap([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width, [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Location, [System.Drawing.Point]::Empty, [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Size)
        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $base64 = [Convert]::ToBase64String($ms.ToArray())
        $bmp.Dispose()
        $g.Dispose()
        $ms.Dispose()
        Write-Output "$base64|$([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width)|$([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height)"
      `;
      
      const { stdout } = await execAsync(
        `powershell -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`
      );
      
      const [base64, width, height] = stdout.trim().split('|');
      
      this.debug.info('WindowsScreen', 'capture', { width, height });
      
      return {
        base64: base64.trim(),
        width: parseInt(width),
        height: parseInt(height),
        format: 'png',
        timestamp: Date.now(),
        screen: screen || 'primary',
      };
    } catch (error) {
      this.debug.error('WindowsScreen', 'capture', error);
      throw error;
    }
  }
  
  async captureRegion(x: number, y: number, width: number, height: number): Promise<ScreenshotResult> {
    try {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $bmp = New-Object System.Drawing.Bitmap(${width}, ${height})
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen(${x}, ${y}, 0, 0, [System.Drawing.Size]::new(${width}, ${height}))
        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $base64 = [Convert]::ToBase64String($ms.ToArray())
        $bmp.Dispose()
        $g.Dispose()
        $ms.Dispose()
        Write-Output $base64
      `;
      
      const { stdout } = await execAsync(
        `powershell -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`
      );
      
      this.debug.info('WindowsScreen', 'captureRegion', { x, y, width, height });
      
      return {
        base64: stdout.trim(),
        width,
        height,
        format: 'png',
        timestamp: Date.now(),
      };
    } catch (error) {
      this.debug.error('WindowsScreen', 'captureRegion', error);
      throw error;
    }
  }
  
  async captureWindow(windowId?: string): Promise<ScreenshotResult> {
    // For now, capture full screen
    // TODO: Implement window-specific capture using Win32 API
    this.debug.warn('WindowsScreen', 'captureWindow', { note: 'Using full screen capture' });
    return this.capture();
  }
  
  async captureAndSave(path: string, format: 'png' | 'jpeg' = 'png'): Promise<string> {
    try {
      const screenshot = await this.capture();
      
      // Ensure directory exists
      const dir = dirname(path);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      
      // Decode and save
      const buffer = Buffer.from(screenshot.base64, 'base64');
      writeFileSync(path, buffer);
      
      this.debug.info('WindowsScreen', 'captureAndSave', { path });
      return path;
    } catch (error) {
      this.debug.error('WindowsScreen', 'captureAndSave', error);
      throw error;
    }
  }
}
