/**
 * IPC Control Handlers - Bridge Electron IPC to Control Services
 * 
 * Handles IPC messages from the renderer process and routes them
 * to the appropriate control service.
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { getControlService, ControlService } from '../../services/control/ControlService';

export interface IPCHandler {
  channel: string;
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any>;
}

export function registerControlHandlers(): void {
  const service = getControlService();
  
  // ========== Mouse Handlers ==========
  ipcMain.handle('control:mouse:position', async () => {
    const pos = await service.mouse.getPosition();
    return { ok: true, result: pos };
  });
  
  ipcMain.handle('control:mouse:move', async (_, x: number, y: number) => {
    await service.mouse.setPosition(x, y);
    return { ok: true };
  });
  
  ipcMain.handle('control:mouse:click', async (_, x: number, y: number, button?: string) => {
    await service.mouse.click(x, y, button as any || 'left');
    return { ok: true };
  });
  
  ipcMain.handle('control:mouse:doubleClick', async (_, x: number, y: number) => {
    await service.mouse.doubleClick(x, y);
    return { ok: true };
  });
  
  ipcMain.handle('control:mouse:drag', async (_, fromX: number, fromY: number, toX: number, toY: number) => {
    await service.mouse.drag({ x: fromX, y: fromY }, { x: toX, y: toY });
    return { ok: true };
  });
  
  ipcMain.handle('control:mouse:mouseDown', async (_, x: number, y: number, button: string) => {
    await service.mouse.mouseDown(x, y, button as any);
    return { ok: true };
  });
  
  ipcMain.handle('control:mouse:mouseUp', async (_, x: number, y: number, button: string) => {
    await service.mouse.mouseUp(x, y, button as any);
    return { ok: true };
  });
  
  ipcMain.handle('control:mouse:scroll', async (_, x: number, y: number, deltaX: number, deltaY: number) => {
    await service.mouse.scroll(x, y, deltaX, deltaY);
    return { ok: true };
  });
  
  // ========== Keyboard Handlers ==========
  ipcMain.handle('control:keyboard:type', async (_, text: string) => {
    await service.keyboard.typeText(text);
    return { ok: true };
  });
  
  ipcMain.handle('control:keyboard:press', async (_, key: string) => {
    await service.keyboard.pressKey(key);
    return { ok: true };
  });
  
  ipcMain.handle('control:keyboard:pressKeys', async (_, keys: string[]) => {
    await service.keyboard.pressKeys(keys);
    return { ok: true };
  });
  
  ipcMain.handle('control:keyboard:copy', async () => {
    await service.keyboard.copy();
    return { ok: true };
  });
  
  ipcMain.handle('control:keyboard:paste', async () => {
    await service.keyboard.paste();
    return { ok: true };
  });
  
  ipcMain.handle('control:keyboard:cut', async () => {
    await service.keyboard.cut();
    return { ok: true };
  });
  
  ipcMain.handle('control:keyboard:selectAll', async () => {
    await service.keyboard.selectAll();
    return { ok: true };
  });
  
  // ========== Screen Handlers ==========
  ipcMain.handle('control:screen:list', async () => {
    const screens = await service.screen.listScreens();
    return { ok: true, result: screens };
  });
  
  ipcMain.handle('control:screen:capture', async (_, screen?: string) => {
    const screenshot = await service.screen.capture(screen);
    return { ok: true, result: screenshot };
  });
  
  ipcMain.handle('control:screen:captureRegion', async (_, x: number, y: number, width: number, height: number) => {
    const screenshot = await service.screen.captureRegion(x, y, width, height);
    return { ok: true, result: screenshot };
  });
  
  ipcMain.handle('control:screen:captureAndSave', async (_, path: string, format?: string) => {
    const savedPath = await service.screen.captureAndSave(path, format as any || 'png');
    return { ok: true, result: savedPath };
  });
  
  // ========== Debug Handlers ==========
  ipcMain.handle('control:debug:getLogs', async (_, filter?: any) => {
    const logs = service.debug.getLogs(filter);
    return { ok: true, result: logs };
  });
  
  ipcMain.handle('control:debug:getStats', async () => {
    const stats = service.debug.getStats();
    return { ok: true, result: stats };
  });
  
  ipcMain.handle('control:debug:clear', async () => {
    service.debug.clearLogs();
    return { ok: true };
  });
  
  ipcMain.handle('control:debug:setLevel', async (_, level: string) => {
    service.debug.setLevel(level as any);
    return { ok: true };
  });
  
  ipcMain.handle('control:debug:export', async (_, format?: string) => {
    const data = format === 'text' 
      ? service.debug.exportText()
      : service.debug.exportJSON();
    return { ok: true, result: data };
  });
  
  // ========== Platform Handlers ==========
  ipcMain.handle('control:platform:info', async () => {
    return {
      ok: true,
      result: {
        type: service.platform.type,
        arch: service.platform.arch,
      }
    };
  });
  
  console.log('[IPC] Control handlers registered');
}

export function unregisterControlHandlers(): void {
  const channels = [
    'control:mouse:position',
    'control:mouse:move',
    'control:mouse:click',
    'control:mouse:doubleClick',
    'control:mouse:drag',
    'control:mouse:mouseDown',
    'control:mouse:mouseUp',
    'control:mouse:scroll',
    'control:keyboard:type',
    'control:keyboard:press',
    'control:keyboard:pressKeys',
    'control:keyboard:copy',
    'control:keyboard:paste',
    'control:keyboard:cut',
    'control:keyboard:selectAll',
    'control:screen:list',
    'control:screen:capture',
    'control:screen:captureRegion',
    'control:screen:captureAndSave',
    'control:debug:getLogs',
    'control:debug:getStats',
    'control:debug:clear',
    'control:debug:setLevel',
    'control:debug:export',
    'control:platform:info',
  ];
  
  for (const channel of channels) {
    ipcMain.removeHandler(channel);
  }
  
  console.log('[IPC] Control handlers unregistered');
}
