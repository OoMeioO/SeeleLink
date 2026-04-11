/**
 * Windows Mouse Control Implementation
 * 
 * Uses PowerShell and Win32 API for mouse control.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { MouseControl, MousePosition, MouseButton } from '../MouseControl';
import { DebugService } from '../../debug/DebugService';

const execAsync = promisify(exec);

export class WindowsMouse implements MouseControl {
  private debug: DebugService;
  
  constructor(debug: DebugService) {
    this.debug = debug;
  }
  
  async getPosition(): Promise<MousePosition> {
    try {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        $pos = [System.Windows.Forms.Cursor]::Position
        Write-Output "$($pos.X),$($pos.Y)"
      `;
      
      const { stdout } = await execAsync(`powershell -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
      const [x, y] = stdout.trim().split(',').map(Number);
      
      this.debug.debug('WindowsMouse', 'getPosition', { x, y });
      return { x, y };
    } catch (error) {
      this.debug.error('WindowsMouse', 'getPosition', error);
      throw error;
    }
  }
  
  async setPosition(x: number, y: number): Promise<void> {
    try {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new(${x}, ${y})
      `;
      
      await execAsync(`powershell -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
      this.debug.debug('WindowsMouse', 'setPosition', { x, y });
    } catch (error) {
      this.debug.error('WindowsMouse', 'setPosition', error);
      throw error;
    }
  }
  
  async click(x: number, y: number, button: MouseButton = 'left'): Promise<void> {
    try {
      // Move to position first
      await this.setPosition(x, y);
      
      // Small delay to ensure position is set
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Perform click using mouse_event
      const btnFlag = button === 'right' ? 'RIGHT' : button === 'middle' ? 'MIDDLE' : 'LEFT';
      
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type @"using System;using System.Runtime.InteropServices;public class Win32{[DllImport("user32.dll")]public static extern void mouse_event(uint f,uint dx,uint dy,uint d,uint ei);}
"@
        [Win32]::mouse_event(0x2,0,0,0,0)
        Start-Sleep -Milliseconds 50
        [Win32]::mouse_event(0x4,0,0,0,0)
      `;
      
      await execAsync(`powershell -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
      this.debug.info('WindowsMouse', 'click', { x, y, button });
    } catch (error) {
      this.debug.error('WindowsMouse', 'click', error);
      throw error;
    }
  }
  
  async doubleClick(x: number, y: number): Promise<void> {
    try {
      await this.click(x, y);
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.click(x, y);
      this.debug.info('WindowsMouse', 'doubleClick', { x, y });
    } catch (error) {
      this.debug.error('WindowsMouse', 'doubleClick', error);
      throw error;
    }
  }
  
  async drag(from: MousePosition, to: MousePosition): Promise<void> {
    try {
      // Move to start
      await this.setPosition(from.x, from.y);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Mouse down
      const scriptDown = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type @"using System;using System.Runtime.InteropServices;public class Win32{[DllImport("user32.dll")]public static extern void mouse_event(uint f,uint dx,uint dy,uint d,uint ei);}
"@
        [Win32]::mouse_event(0x2,0,0,0,0)
      `;
      await execAsync(`powershell -Command "${scriptDown.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
      
      // Move to end (smooth drag)
      const steps = 10;
      for (let i = 1; i <= steps; i++) {
        const progress = i / steps;
        const x = Math.round(from.x + (to.x - from.x) * progress);
        const y = Math.round(from.y + (to.y - from.y) * progress);
        await this.setPosition(x, y);
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      
      // Mouse up
      const scriptUp = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type @"using System;using System.Runtime.InteropServices;public class Win32{[DllImport("user32.dll")]public static extern void mouse_event(uint f,uint dx,uint dy,uint d,uint ei);}
"@
        [Win32]::mouse_event(0x4,0,0,0,0)
      `;
      await execAsync(`powershell -Command "${scriptUp.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
      
      this.debug.info('WindowsMouse', 'drag', { from, to });
    } catch (error) {
      this.debug.error('WindowsMouse', 'drag', error);
      throw error;
    }
  }
  
  async mouseDown(x: number, y: number, button: MouseButton): Promise<void> {
    try {
      await this.setPosition(x, y);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const btnFlag = button === 'right' ? 'RIGHT' : button === 'middle' ? 'MIDDLE' : 'LEFT';
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type @"using System;using System.Runtime.InteropServices;public class Win32{[DllImport("user32.dll")]public static extern void mouse_event(uint f,uint dx,uint dy,uint d,uint ei);}
"@
        [Win32]::mouse_event(0x2,0,0,0,0)
      `;
      
      await execAsync(`powershell -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
      this.debug.debug('WindowsMouse', 'mouseDown', { x, y, button });
    } catch (error) {
      this.debug.error('WindowsMouse', 'mouseDown', error);
      throw error;
    }
  }
  
  async mouseUp(x: number, y: number, button: MouseButton): Promise<void> {
    try {
      await this.setPosition(x, y);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type @"using System;using System.Runtime.InteropServices;public class Win32{[DllImport("user32.dll")]public static extern void mouse_event(uint f,uint dx,uint dy,uint d,uint ei);}
"@
        [Win32]::mouse_event(0x4,0,0,0,0)
      `;
      
      await execAsync(`powershell -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
      this.debug.debug('WindowsMouse', 'mouseUp', { x, y, button });
    } catch (error) {
      this.debug.error('WindowsMouse', 'mouseUp', error);
      throw error;
    }
  }
  
  async scroll(x: number, y: number, deltaX: number, deltaY: number): Promise<void> {
    try {
      await this.setPosition(x, y);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Windows scroll using mouse_event
      // 0x0800 = Wheel, positive = up, negative = down
      const wheelAmount = Math.round(deltaY / 120) * 120;
      
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type @"using System;using System.Runtime.InteropServices;public class Win32{[DllImport("user32.dll")]public static extern void mouse_event(uint f,uint dx,uint dy,uint d,uint ei);}
"@
        [Win32]::mouse_event(0x0800,0,0,${wheelAmount},0)
      `;
      
      await execAsync(`powershell -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
      this.debug.debug('WindowsMouse', 'scroll', { x, y, deltaX, deltaY });
    } catch (error) {
      this.debug.error('WindowsMouse', 'scroll', error);
      throw error;
    }
  }
}
