import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { connectionManager } from '../core/ConnectionManager.js';
import { logger } from '../utils/logger.js';

const server = new Server({ name: 'SeeleLink', version: '0.1.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: 'ssh_connect', description: 'Connect SSH', inputSchema: { type: 'object', properties: { host: { type: 'string' }, port: { type: 'number' }, username: { type: 'string' }, password: { type: 'string' } }, required: ['host', 'username'] }},
    { name: 'ssh_execute', description: 'Execute SSH command', inputSchema: { type: 'object', properties: { id: { type: 'string' }, cmd: { type: 'string' } }, required: ['id', 'cmd'] }},
    { name: 'ps_connect', description: 'Connect PowerShell', inputSchema: { type: 'object', properties: {} }},
    { name: 'ps_execute', description: 'Execute PowerShell command', inputSchema: { type: 'object', properties: { id: { type: 'string' }, cmd: { type: 'string' } }, required: ['id', 'cmd'] }},
    { name: 'serial_connect', description: 'Connect Serial', inputSchema: { type: 'object', properties: { port: { type: 'string' }, baudRate: { type: 'number' } }, required: ['port'] }},
    { name: 'serial_send', description: 'Send to Serial', inputSchema: { type: 'object', properties: { id: { type: 'string' }, data: { type: 'string' } }, required: ['id', 'data'] }},
    { name: 'disconnect', description: 'Disconnect', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }},
    { name: 'list', description: 'List connections', inputSchema: { type: 'object', properties: {} }},
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params as any;
  try {
    switch (name) {
      case 'ssh_connect': { const id = `ssh_${Date.now()}`; await connectionManager.connect(id, { type: 'ssh', host: args.host, port: args.port, username: args.username, password: args.password }); return { content: [{ type: 'text', text: `SSH connected ${args.host} [${id}]` }] }; }
      case 'ssh_execute': { const client = connectionManager.getClient(args.id) as any; if (!client) return { content: [{ type: 'text', text: 'Connection not found' }], isError: true }; const r = await client.execute(args.cmd); return { content: [{ type: 'text', text: r }] }; }
      case 'ps_connect': { const id = `ps_${Date.now()}`; await connectionManager.connect(id, { type: 'powershell' }); return { content: [{ type: 'text', text: `PowerShell connected [${id}]` }] }; }
      case 'ps_execute': { const client = connectionManager.getClient(args.id) as any; if (!client) return { content: [{ type: 'text', text: 'Connection not found' }], isError: true }; const r = await client.execute(args.cmd); return { content: [{ type: 'text', text: r }] }; }
      case 'serial_connect': { const id = `serial_${Date.now()}`; await connectionManager.connect(id, { type: 'serial', port: args.port, baudRate: args.baudRate }); return { content: [{ type: 'text', text: `Serial ${args.port} connected [${id}]` }] }; }
      case 'serial_send': { const client = connectionManager.getClient(args.id) as any; if (!client) return { content: [{ type: 'text', text: 'Connection not found' }], isError: true }; client.write(args.data); return { content: [{ type: 'text', text: 'Sent' }] }; }
      case 'disconnect': { await connectionManager.disconnect(args.id); return { content: [{ type: 'text', text: 'Disconnected' }] }; }
      case 'list': { const conns = connectionManager.getAllConnections(); return { content: [{ type: 'text', text: conns.map(c => `${c.id}: ${c.config.type}`).join('\n') || 'None' }] }; }
      default: return { content: [{ type: 'text', text: `Unknown: ${name}` }], isError: true };
    }
  } catch (err: any) { logger.error(err.message); return { content: [{ type: 'text', text: err.message }], isError: true }; }
});

server.connect(new StdioServerTransport()).then(() => logger.info('MCP started')).catch(console.error);
