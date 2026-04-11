// Launcher that ensures ELECTRON_RUN_AS_NODE is cleared before starting electron
// This is needed because some shell environments set ELECTRON_RUN_AS_NODE=1
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const electronPath = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');

// Get all env vars but remove ELECTRON_RUN_AS_NODE
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const args = process.argv.slice(2);
args.push('.'); // always specify app directory
const child = spawn(electronPath, args, {
  env,
  stdio: 'inherit',
  shell: false,
  windowsHide: false
});

child.on('close', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('Failed to start electron:', err.message);
  process.exit(1);
});
