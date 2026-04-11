// Copy xterm.js assets to dist-electron for iframe-based terminal
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist-electron');
const assets = join(dist, 'assets');

// Ensure assets directory exists
if (!existsSync(assets)) {
  mkdirSync(assets, { recursive: true });
}

// Files to copy from node_modules
const files = [
  { src: join(root, 'node_modules/@xterm/xterm/lib/xterm.js'), dest: join(assets, 'xterm.js') },
  { src: join(root, 'node_modules/@xterm/addon-fit/lib/addon-fit.js'), dest: join(assets, 'addon-fit.js') },
  { src: join(root, 'node_modules/@xterm/xterm/css/xterm.css'), dest: join(assets, 'xterm.css') },
];

// Copy terminal.html to dist-electron
const terminalSrc = join(root, 'electron/terminal.html');
const terminalDest = join(dist, 'terminal.html');
files.push({ src: terminalSrc, dest: terminalDest });

// Copy controlHandlers.cjs to dist-electron
const controlSrc = join(root, 'electron/controlHandlers.cjs');
const controlDest = join(dist, 'controlHandlers.cjs');
files.push({ src: controlSrc, dest: controlDest });

// Copy preload.js to dist-electron
const preloadSrc = join(root, 'electron/preload.js');
const preloadDest = join(dist, 'preload.js');
files.push({ src: preloadSrc, dest: preloadDest });

// Copy platform folder to dist-electron
import { cpSync } from 'fs';
const platformSrc = join(root, 'electron/platform');
const platformDest = join(dist, 'platform');
if (existsSync(platformSrc)) {
  cpSync(platformSrc, platformDest, { recursive: true });
  console.log(`Copied: ${platformSrc} -> ${platformDest}`);
}

for (const file of files) {
  try {
    if (existsSync(file.src)) {
      copyFileSync(file.src, file.dest);
      console.log(`Copied: ${file.src} -> ${file.dest}`);
    } else {
      console.warn(`Warning: ${file.src} not found, skipping`);
    }
  } catch (err) {
    console.error(`Error copying ${file.src}:`, err.message);
  }
}

console.log('Assets copy complete!');
