"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEETING_SLACK_TOOLS = exports.COMMS_SLACK_TOOLS = exports.slackGetUserTool = exports.slackUploadFileTool = exports.slackListChannelsTool = exports.slackSearchTool = exports.slackSendMessageTool = void 0;
/**
 * Slack MCP — Genkit Tool Wrappers
 *
 * Recommended server: official Slack MCP (first-party)
 *   npx @slack/mcp-server
 *
 * Used by: Comms Agent (primary), Meeting Agent (post-meeting notifications)
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../../../config/genkit.config");
const mcp_config_1 = require("../../../config/mcp.config");
async function sl(tool, args) {
    if (!mcp_config_1.mcpAvailability.slack) {
        throw new Error('Slack MCP server is not available. Set SLACK_MCP_URL in .env.');
    }
    return (0, mcp_config_1.callMcpTool)(mcp_config_1.MCP_SERVERS.slack, tool, args, (0, mcp_config_1.slackAuthHeaders)());
}
// ── SEND MESSAGE ──────────────────────────────────────────────────────────────
exports.slackSendMessageTool = genkit_config_1.ai.defineTool({
    name: 'slack_send_message',
    description: 'Send a message to a Slack channel or DM. Use for internal notifications, meeting summaries, and alerts.',
    inputSchema: zod_1.z.object({
        channel: zod_1.z.string().describe('Channel name (e.g., #general) or user ID for DM'),
        text: zod_1.z.string().describe('Message text (supports Slack markdown: *bold*, _italic_, `code`)'),
        blocks: zod_1.z.array(zod_1.z.unknown()).optional().describe('Slack Block Kit blocks for rich formatting'),
        threadTs: zod_1.z.string().optional().describe('Thread timestamp to reply in a thread'),
    }),
    outputSchema: zod_1.z.object({
        ts: zod_1.z.string().describe('Message timestamp (can be used for threading)'),
        channel: zod_1.z.string(),
        ok: zod_1.z.boolean(),
    }),
}, async ({ channel, text, blocks, threadTs }) => {
    const result = await sl('send_message', { channel, text, blocks, thread_ts: threadTs });
    return result;
});
// ── SEARCH MESSAGES ───────────────────────────────────────────────────────────
exports.slackSearchTool = genkit_config_1.ai.defineTool({
    name: 'slack_search',
    description: 'Search messages in Slack. Returns matching messages with channel, user, text, and timestamp.',
    inputSchema: zod_1.z.object({
        query: zod_1.z.string().describe('Search query (supports Slack search syntax: in:#channel, from:@user)'),
        count: zod_1.z.number().optional().default(10),
        sort: zod_1.z.enum(['score', 'timestamp']).optional().default('score'),
    }),
    outputSchema: zod_1.z.object({
        messages: zod_1.z.array(zod_1.z.object({
            channel: zod_1.z.string(),
            user: zod_1.z.string(),
            text: zod_1.z.string(),
            ts: zod_1.z.string(),
            permalink: zod_1.z.string().optional(),
        })),
    }),
}, async (args) => {
    const result = await sl('search_messages', args);
    return result;
});
// ── LIST CHANNELS ─────────────────────────────────────────────────────────────
exports.slackListChannelsTool = genkit_config_1.ai.defineTool({
    name: 'slack_list_channels',
    description: 'List available Slack channels in the workspace. Use to find the right channel before sending a message.',
    inputSchema: zod_1.z.object({
        types: zod_1.z.string().optional().default('public_channel').describe('Channel types: public_channel, private_channel, im, mpim'),
        limit: zod_1.z.number().optional().default(100),
    }),
    outputSchema: zod_1.z.object({
        channels: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            name: zod_1.z.string(),
            purpose: zod_1.z.string().optional(),
            memberCount: zod_1.z.number().optional(),
        })),
    }),
}, async (args) => {
    const result = await sl('list_channels', args);
    return result;
});
// ── UPLOAD FILE ───────────────────────────────────────────────────────────────
exports.slackUploadFileTool = genkit_config_1.ai.defineTool({
    name: 'slack_upload_file',
    description: 'Upload a file or document to a Slack channel. Use to share reports, summaries, or generated documents.',
    inputSchema: zod_1.z.object({
        channel: zod_1.z.string(),
        content: zod_1.z.string().describe('File content as text or base64'),
        filename: zod_1.z.string(),
        fileType: zod_1.z.string().optional().default('text').describe('File type: text, pdf, markdown'),
        title: zod_1.z.string().optional(),
        comment: zod_1.z.string().optional().describe('Initial message to accompany the file'),
    }),
    outputSchema: zod_1.z.object({
        fileId: zod_1.z.string(),
        message: zod_1.z.string(),
    }),
}, async (args) => {
    const result = await sl('upload_file', args);
    return result;
});
// ── GET USER INFO ─────────────────────────────────────────────────────────────
exports.slackGetUserTool = genkit_config_1.ai.defineTool({
    name: 'slack_get_user',
    description: 'Look up a Slack user by name or email. Returns their Slack ID, display name, and status.',
    inputSchema: zod_1.z.object({
        email: zod_1.z.string().optional(),
        name: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        id: zod_1.z.string(),
        name: zod_1.z.string(),
        realName: zod_1.z.string(),
        email: zod_1.z.string().optional(),
        status: zod_1.z.string().optional(),
        isActive: zod_1.z.boolean(),
    }),
}, async (args) => {
    const result = await sl('get_user', args);
    return result;
});
// ── Convenience bundles ───────────────────────────────────────────────────────
/** Full Slack toolkit for Comms Agent */
exports.COMMS_SLACK_TOOLS = [
    exports.slackSendMessageTool,
    exports.slackSearchTool,
    exports.slackListChannelsTool,
    exports.slackUploadFileTool,
    exports.slackGetUserTool,
];
/** Minimal Slack toolkit for Meeting Agent (notifications only) */
exports.MEETING_SLACK_TOOLS = [
    exports.slackSendMessageTool,
    exports.slackListChannelsTool,
];
//# sourceMappingURL=slack.js.map