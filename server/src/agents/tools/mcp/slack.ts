/**
 * Slack MCP — Genkit Tool Wrappers
 *
 * Recommended server: official Slack MCP (first-party)
 *   npx @slack/mcp-server
 *
 * Used by: Comms Agent (primary), Meeting Agent (post-meeting notifications)
 */
import { z } from 'zod';
import { ai } from '../../../config/genkit.config';
import {
  MCP_SERVERS,
  callMcpTool,
  slackAuthHeaders,
  mcpAvailability,
} from '../../../config/mcp.config';

async function sl(tool: string, args: Record<string, unknown>): Promise<unknown> {
  if (!mcpAvailability.slack) {
    throw new Error('Slack MCP server is not available. Set SLACK_MCP_URL in .env.');
  }
  return callMcpTool(MCP_SERVERS.slack!, tool, args, slackAuthHeaders());
}

// ── SEND MESSAGE ──────────────────────────────────────────────────────────────

export const slackSendMessageTool = ai.defineTool(
  {
    name: 'slack_send_message',
    description: 'Send a message to a Slack channel or DM. Use for internal notifications, meeting summaries, and alerts.',
    inputSchema: z.object({
      channel: z.string().describe('Channel name (e.g., #general) or user ID for DM'),
      text:    z.string().describe('Message text (supports Slack markdown: *bold*, _italic_, `code`)'),
      blocks:  z.array(z.unknown()).optional().describe('Slack Block Kit blocks for rich formatting'),
      threadTs: z.string().optional().describe('Thread timestamp to reply in a thread'),
    }),
    outputSchema: z.object({
      ts:      z.string().describe('Message timestamp (can be used for threading)'),
      channel: z.string(),
      ok:      z.boolean(),
    }),
  },
  async ({ channel, text, blocks, threadTs }) => {
    const result = await sl('send_message', { channel, text, blocks, thread_ts: threadTs });
    return result as { ts: string; channel: string; ok: boolean };
  }
);

// ── SEARCH MESSAGES ───────────────────────────────────────────────────────────

export const slackSearchTool = ai.defineTool(
  {
    name: 'slack_search',
    description: 'Search messages in Slack. Returns matching messages with channel, user, text, and timestamp.',
    inputSchema: z.object({
      query:   z.string().describe('Search query (supports Slack search syntax: in:#channel, from:@user)'),
      count:   z.number().optional().default(10),
      sort:    z.enum(['score', 'timestamp']).optional().default('score'),
    }),
    outputSchema: z.object({
      messages: z.array(z.object({
        channel:  z.string(),
        user:     z.string(),
        text:     z.string(),
        ts:       z.string(),
        permalink: z.string().optional(),
      })),
    }),
  },
  async (args) => {
    const result = await sl('search_messages', args as Record<string, unknown>);
    return result as { messages: Array<{ channel: string; user: string; text: string; ts: string; permalink?: string }> };
  }
);

// ── LIST CHANNELS ─────────────────────────────────────────────────────────────

export const slackListChannelsTool = ai.defineTool(
  {
    name: 'slack_list_channels',
    description: 'List available Slack channels in the workspace. Use to find the right channel before sending a message.',
    inputSchema: z.object({
      types:   z.string().optional().default('public_channel').describe('Channel types: public_channel, private_channel, im, mpim'),
      limit:   z.number().optional().default(100),
    }),
    outputSchema: z.object({
      channels: z.array(z.object({
        id:         z.string(),
        name:       z.string(),
        purpose:    z.string().optional(),
        memberCount: z.number().optional(),
      })),
    }),
  },
  async (args) => {
    const result = await sl('list_channels', args as Record<string, unknown>);
    return result as { channels: Array<{ id: string; name: string; purpose?: string; memberCount?: number }> };
  }
);

// ── UPLOAD FILE ───────────────────────────────────────────────────────────────

export const slackUploadFileTool = ai.defineTool(
  {
    name: 'slack_upload_file',
    description: 'Upload a file or document to a Slack channel. Use to share reports, summaries, or generated documents.',
    inputSchema: z.object({
      channel:  z.string(),
      content:  z.string().describe('File content as text or base64'),
      filename: z.string(),
      fileType: z.string().optional().default('text').describe('File type: text, pdf, markdown'),
      title:    z.string().optional(),
      comment:  z.string().optional().describe('Initial message to accompany the file'),
    }),
    outputSchema: z.object({
      fileId:  z.string(),
      message: z.string(),
    }),
  },
  async (args) => {
    const result = await sl('upload_file', args as Record<string, unknown>);
    return result as { fileId: string; message: string };
  }
);

// ── GET USER INFO ─────────────────────────────────────────────────────────────

export const slackGetUserTool = ai.defineTool(
  {
    name: 'slack_get_user',
    description: 'Look up a Slack user by name or email. Returns their Slack ID, display name, and status.',
    inputSchema: z.object({
      email: z.string().optional(),
      name:  z.string().optional(),
    }),
    outputSchema: z.object({
      id:          z.string(),
      name:        z.string(),
      realName:    z.string(),
      email:       z.string().optional(),
      status:      z.string().optional(),
      isActive:    z.boolean(),
    }),
  },
  async (args) => {
    const result = await sl('get_user', args as Record<string, unknown>);
    return result as { id: string; name: string; realName: string; email?: string; status?: string; isActive: boolean };
  }
);

// ── Convenience bundles ───────────────────────────────────────────────────────

/** Full Slack toolkit for Comms Agent */
export const COMMS_SLACK_TOOLS = [
  slackSendMessageTool,
  slackSearchTool,
  slackListChannelsTool,
  slackUploadFileTool,
  slackGetUserTool,
] as const;

/** Minimal Slack toolkit for Meeting Agent (notifications only) */
export const MEETING_SLACK_TOOLS = [
  slackSendMessageTool,
  slackListChannelsTool,
] as const;
