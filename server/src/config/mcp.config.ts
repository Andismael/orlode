/**
 * MCP Client Configuration
 *
 * Provides a lightweight HTTP client to connect to MCP servers.
 * Uses JSON-RPC 2.0 over HTTP (Streamable HTTP transport — MCP standard 2025).
 * No extra package needed — uses Node 18+ built-in fetch.
 *
 * Architecture: each MCP server runs as a separate process/container.
 * Agents discover tools at startup and call them via HTTP.
 */
import { env } from './env.config';
import { logger } from '../utils/logger';

// ── MCP Server URLs (from env) ────────────────────────────────────────────────
export const MCP_SERVERS = {
  googleWorkspace: env.GOOGLE_WORKSPACE_MCP_URL,
  slack:           env.SLACK_MCP_URL,
  bigquery:        env.BIGQUERY_MCP_URL,
  notion:          env.NOTION_MCP_URL,
  hubspot:         env.HUBSPOT_MCP_URL,
} as const;

export type McpServerName = keyof typeof MCP_SERVERS;

// ── JSON-RPC request ID counter ───────────────────────────────────────────────
let _rpcId = 1;

// ── Core MCP HTTP caller ──────────────────────────────────────────────────────
export async function callMcpTool(
  serverUrl: string,
  toolName:  string,
  args:      Record<string, unknown>,
  headers?:  Record<string, string>,
): Promise<unknown> {
  const id = _rpcId++;

  const response = await fetch(serverUrl, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept:         'application/json, text/event-stream',
      ...headers,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method:  'tools/call',
      params:  { name: toolName, arguments: args },
    }),
  });

  if (!response.ok) {
    throw new Error(`MCP server ${serverUrl} returned HTTP ${response.status}`);
  }

  // Handle SSE responses (server streams a single result)
  const contentType = response.headers.get('content-type') ?? '';
  let data: Record<string, unknown>;

  if (contentType.includes('text/event-stream')) {
    const text = await response.text();
    // Parse the first data: line from SSE stream
    const match = text.match(/^data:\s*(.+)$/m);
    if (!match) throw new Error('MCP SSE: no data received');
    data = JSON.parse(match[1]) as Record<string, unknown>;
  } else {
    data = await response.json() as Record<string, unknown>;
  }

  if (data['error']) {
    const err = data['error'] as Record<string, unknown>;
    throw new Error(`MCP tool error: ${String(err['message'] ?? err)}`);
  }

  // Extract text content from MCP result
  const result = data['result'] as Record<string, unknown> | undefined;
  const content = result?.['content'] as Array<{ type: string; text?: string }> | undefined;
  if (content && content.length > 0) {
    return content.map((c) => c.text ?? '').join('\n');
  }
  return result ?? data;
}

// ── List available tools on an MCP server ─────────────────────────────────────
export async function listMcpTools(
  serverUrl: string,
  headers?:  Record<string, string>,
): Promise<Array<{ name: string; description: string; inputSchema: unknown }>> {
  try {
    const id = _rpcId++;
    const response = await fetch(serverUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body:    JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/list', params: {} }),
    });

    if (!response.ok) return [];
    const data = await response.json() as Record<string, unknown>;
    const result = data['result'] as { tools?: Array<{ name: string; description: string; inputSchema: unknown }> } | undefined;
    return result?.tools ?? [];
  } catch {
    return [];
  }
}

// ── Health check for an MCP server ───────────────────────────────────────────
export async function isMcpServerAvailable(serverUrl: string): Promise<boolean> {
  if (!serverUrl) return false;
  try {
    // Check root URL (GET) — MCP servers return 200 on root even without auth
    const rootUrl = serverUrl.replace(/\/mcp\/?$/, '');
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(rootUrl, { method: 'GET', signal: ctrl.signal });
    clearTimeout(timeout);
    return res.status < 500; // 200, 404, 406 all mean server is up
  } catch {
    return false;
  }
}

// ── Auth header builders ──────────────────────────────────────────────────────
export function googleAuthHeaders(): Record<string, string> {
  if (!env.GOOGLE_WORKSPACE_MCP_TOKEN) return {};
  return { Authorization: `Bearer ${env.GOOGLE_WORKSPACE_MCP_TOKEN}` };
}

export function slackAuthHeaders(): Record<string, string> {
  if (!env.SLACK_BOT_TOKEN) return {};
  return { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}` };
}

// ── Availability flags (set at startup) ──────────────────────────────────────
export const mcpAvailability: Record<McpServerName, boolean> = {
  googleWorkspace: false,
  slack:           false,
  bigquery:        false,
  notion:          false,
  hubspot:         false,
};

export async function checkMcpAvailability(): Promise<void> {
  const checks = Object.entries(MCP_SERVERS).map(async ([name, url]) => {
    if (!url) {
      logger.debug(`[MCP] ${name}: not configured`);
      return;
    }
    const available = await isMcpServerAvailable(url);
    mcpAvailability[name as McpServerName] = available;
    logger.info(`[MCP] ${name} @ ${url}: ${available ? '✓ online' : '✗ offline'}`);
  });

  await Promise.all(checks);
}
