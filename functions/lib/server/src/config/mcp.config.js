"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpAvailability = exports.MCP_SERVERS = void 0;
exports.callMcpTool = callMcpTool;
exports.listMcpTools = listMcpTools;
exports.isMcpServerAvailable = isMcpServerAvailable;
exports.googleAuthHeaders = googleAuthHeaders;
exports.slackAuthHeaders = slackAuthHeaders;
exports.checkMcpAvailability = checkMcpAvailability;
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
const env_config_1 = require("./env.config");
const logger_1 = require("../utils/logger");
// ── MCP Server URLs (from env) ────────────────────────────────────────────────
exports.MCP_SERVERS = {
    googleWorkspace: env_config_1.env.GOOGLE_WORKSPACE_MCP_URL,
    slack: env_config_1.env.SLACK_MCP_URL,
    bigquery: env_config_1.env.BIGQUERY_MCP_URL,
    notion: env_config_1.env.NOTION_MCP_URL,
    hubspot: env_config_1.env.HUBSPOT_MCP_URL,
};
// ── JSON-RPC request ID counter ───────────────────────────────────────────────
let _rpcId = 1;
// ── Core MCP HTTP caller ──────────────────────────────────────────────────────
async function callMcpTool(serverUrl, toolName, args, headers) {
    const id = _rpcId++;
    const response = await fetch(serverUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            ...headers,
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id,
            method: 'tools/call',
            params: { name: toolName, arguments: args },
        }),
    });
    if (!response.ok) {
        throw new Error(`MCP server ${serverUrl} returned HTTP ${response.status}`);
    }
    // Handle SSE responses (server streams a single result)
    const contentType = response.headers.get('content-type') ?? '';
    let data;
    if (contentType.includes('text/event-stream')) {
        const text = await response.text();
        // Parse the first data: line from SSE stream
        const match = text.match(/^data:\s*(.+)$/m);
        if (!match)
            throw new Error('MCP SSE: no data received');
        data = JSON.parse(match[1]);
    }
    else {
        data = await response.json();
    }
    if (data['error']) {
        const err = data['error'];
        throw new Error(`MCP tool error: ${String(err['message'] ?? err)}`);
    }
    // Extract text content from MCP result
    const result = data['result'];
    const content = result?.['content'];
    if (content && content.length > 0) {
        return content.map((c) => c.text ?? '').join('\n');
    }
    return result ?? data;
}
// ── List available tools on an MCP server ─────────────────────────────────────
async function listMcpTools(serverUrl, headers) {
    try {
        const id = _rpcId++;
        const response = await fetch(serverUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/list', params: {} }),
        });
        if (!response.ok)
            return [];
        const data = await response.json();
        const result = data['result'];
        return result?.tools ?? [];
    }
    catch {
        return [];
    }
}
// ── Health check for an MCP server ───────────────────────────────────────────
async function isMcpServerAvailable(serverUrl) {
    if (!serverUrl)
        return false;
    try {
        // Check root URL (GET) — MCP servers return 200 on root even without auth
        const rootUrl = serverUrl.replace(/\/mcp\/?$/, '');
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch(rootUrl, { method: 'GET', signal: ctrl.signal });
        clearTimeout(timeout);
        return res.status < 500; // 200, 404, 406 all mean server is up
    }
    catch {
        return false;
    }
}
// ── Auth header builders ──────────────────────────────────────────────────────
function googleAuthHeaders() {
    if (!env_config_1.env.GOOGLE_WORKSPACE_MCP_TOKEN)
        return {};
    return { Authorization: `Bearer ${env_config_1.env.GOOGLE_WORKSPACE_MCP_TOKEN}` };
}
function slackAuthHeaders() {
    if (!env_config_1.env.SLACK_BOT_TOKEN)
        return {};
    return { Authorization: `Bearer ${env_config_1.env.SLACK_BOT_TOKEN}` };
}
// ── Availability flags (set at startup) ──────────────────────────────────────
exports.mcpAvailability = {
    googleWorkspace: false,
    slack: false,
    bigquery: false,
    notion: false,
    hubspot: false,
};
async function checkMcpAvailability() {
    const checks = Object.entries(exports.MCP_SERVERS).map(async ([name, url]) => {
        if (!url) {
            logger_1.logger.debug(`[MCP] ${name}: not configured`);
            return;
        }
        const available = await isMcpServerAvailable(url);
        exports.mcpAvailability[name] = available;
        logger_1.logger.info(`[MCP] ${name} @ ${url}: ${available ? '✓ online' : '✗ offline'}`);
    });
    await Promise.all(checks);
}
//# sourceMappingURL=mcp.config.js.map