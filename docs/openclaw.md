# OpenClaw Integration Guide

This guide explains how to configure **OpenClaw** to control SeeleLink via both the **MCP Server** and **Control API**.

## Method 1: MCP Server (Recommended)

The MCP server exposes SeeleLink as AI tools that OpenClaw can call directly.

### Enable MCP Server

1. Open SeeleLink → **Settings** tab
2. Find **MCP Server (HTTP+SSE)**
3. Check **Enabled**, configure host/port (default: `127.0.0.1:9381`)
4. Click **Save Changes**

### Configure OpenClaw

Add to your OpenClaw config (usually at `~/.openclaw/config.json` or via `openclaw config`):

```json
{
  "mcpServers": {
    "SeeleLink": {
      "url": "http://127.0.0.1:9381/mcp"
    }
  }
}
```

Or use the **Settings → Copy Config** button inside SeeleLink's Settings tab to copy the JSON directly.

### Available MCP Tools

**Connection:**
- `ps_connect`, `ps_execute`, `ps_disconnect`
- `cmd_connect`, `cmd_execute`, `cmd_disconnect`
- `ssh_connect`, `ssh_execute`, `ssh_disconnect`
- `serial_list`, `serial_connect`, `serial_send`, `serial_disconnect`
- `ws_connect`, `ws_send`, `ws_disconnect`

**Window Automation:**
- `window_capture` — screenshot (returns base64 PNG)
- `window_get_bounds` — window position/size
- `window_click` — click at (x, y)
- `window_move_mouse` — move cursor
- `window_send_keys` — send keyboard input

---

## Method 2: Control API (TCP JSON)

Use the TCP JSON API directly from OpenClaw skills or ClawFlow steps.

### Enable Control API

1. Open SeeleLink → **Settings** tab
2. Find **Control API (TCP JSON)**
3. Check **Enabled**, configure host/port (default: `127.0.0.1:9380`)
4. Click **Save Changes**

### Example OpenClaw Skill

```javascript
// In your OpenClaw skill or ClawFlow step:
const net = require('net');

async function seelelinkCommand(cmd, args = []) {
  return new Promise((resolve, reject) => {
    const c = new net.Socket();
    let d = '', done = false;
    const to = setTimeout(() => {
      if (!done) { done = true; c.destroy(); reject(new Error('timeout')); }
    }, 10000);
    c.connect(9380, '127.0.0.1', () => {
      c.write(JSON.stringify({ cmd, args }) + '\n');
    });
    c.on('data', chunk => {
      d += chunk.toString();
      const i = d.indexOf('\n');
      if (i < 0) return;
      if (done) return;
      done = true; clearTimeout(to);
      const r = JSON.parse(d.substring(0, i));
      c.end();
      r.ok ? resolve(r.result) : reject(new Error(r.error));
    });
    c.on('error', e => {
      if (!done) { done = true; clearTimeout(to); reject(e); }
    });
  });
}

// Example: Connect to SSH server
const result = await seelelinkCommand('ssh:connect', [
  'prod-server',       // connId
  '10.18.224.177',    // host
  'admin',             // username
  'password123'        // password
]);
console.log('Connected:', result);
```

---

## Complete Automation Example

**Task:** Have OpenClaw click to the SSH tab, then connect to a saved server, then run a command.

```javascript
// Step 1: Take a screenshot to see current state
const { png } = await seelelinkCommand('window:capture');
// Show image to user or use vision model to analyze

// Step 2: Click the SSH tab
// SSH tab is approximately at window-relative (80, 50)
await seelelinkCommand('window:click', [80, 50]);

// Step 3: Wait for tab to activate, then click first connection
await new Promise(r => setTimeout(r, 300));
await seelelinkCommand('window:click', [20, 100]);

// Step 4: Wait for connection to establish
await new Promise(r => setTimeout(r, 1000));

// Step 5: Send a command
await seelelinkCommand('ssh:send', ['prod-server', 'ls -la\n']);
```

---

## Coordinate System

All window automation coordinates are **window-relative** (0,0 = top-left of the custom title bar).

```
Window layout (1200px wide content area):

y=0   ┌─────────────────────────────────────────────────┐
       │  ⚡ SeeleLink  File Edit View Help    ☀️  [—][□][×]  │  ← Title Bar (36px)
y=36  ├─────────────────────────────────────────────────┤
       │  [SSH] [Serial] [PowerShell] [Bash] [WebSocket] [⚙]   │  ← Tab Bar (34px)
y=70  ├────────────┬────────────────────────────────────┤
       │ CONNECTIONS│                                    │
       │ [+ New]    │   Main content area               │
       │            │                                    │
       │ 10.0.0.1   │                                    │
       │ 10.0.0.2   │                                    │
       │            │                                    │
```

**Content area starts at y ≈ 70** (36px title bar + 34px tab bar).

Use `window:bounds` to get the exact offset for your window size.

### Quick Reference

| Element | x | y |
|---------|---|---|
| SSH tab | ~80 | ~50 |
| Serial tab | ~150 | ~50 |
| Settings tab | ~600 | ~50 |
| + New button | ~185 | ~50 |
| First connection | ~20 | ~90 |
| Window close (×) | ~1160 | ~18 |

---

## Debug Mode

When doing UI automation, use **Debug Mode** to discover exact coordinates:

1. Open SeeleLink → **Settings** → **Debug Tools**
2. Click **▶ Start Debug**
3. Hover/click/keyboard around the UI — events appear with exact coordinates
4. Click **📷 Screenshot** to capture the current state

This is the easiest way to find the right (x, y) for `window:click`.

---

## Settings → Copy Config

The **Settings → OpenClaw → Copy Config** button generates the correct JSON for your current configuration:

```json
{
  "mcpServers": {
    "SeeleLink": {
      "url": "http://127.0.0.1:9381/mcp"
    }
  }
}
```

Click the button to copy directly to clipboard, then paste into your OpenClaw config file.
