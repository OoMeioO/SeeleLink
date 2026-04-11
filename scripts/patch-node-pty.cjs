/**
 * patch-node-pty.js
 *
 * Patches node-pty to fix Node.js v20 compatibility issue.
 * The issue: node-pty uses stream.Socket which was removed in Node.js v20.
 * The fix: Replace stream.Socket with net.Socket.
 *
 * This script runs after `npm install` to ensure the patch is applied.
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'node_modules', 'node-pty', 'lib', 'windowsPtyAgent.js');

try {
  let content = fs.readFileSync(filePath, 'utf8');

  // Check if already patched
  if (content.includes('stream.Socket') || content.includes('stream_1.Socket')) {
    console.log('[patch-node-pty] Found stream.Socket reference, replacing with net.Socket...');
    content = content.replace(/stream\.Socket/g, 'net.Socket');
    content = content.replace(/stream_1\.Socket/g, 'net_1.Socket');
    fs.writeFileSync(filePath, content);
    console.log('[patch-node-pty] Patch applied successfully');
  } else {
    console.log('[patch-node-pty] Already patched or no stream.Socket reference found');
  }
} catch (e) {
  console.error('[patch-node-pty] Error:', e.message);
}