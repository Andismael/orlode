/**
 * Google Workspace MCP — Genkit Tool Wrappers
 *
 * One MCP server covers: Gmail, Drive, Docs, Sheets, Slides, Calendar,
 * Tasks, Contacts, Chat, Forms.
 *
 * Recommended server: @taylorwilsdon/google-workspace-mcp
 *   npx @google/google-workspace-mcp
 *   (or your own OAuth-configured instance)
 *
 * All tools return null when the MCP server is not configured.
 * Agents must check mcpAvailability.googleWorkspace before calling them.
 */
import { z } from 'zod';
import { ai } from '../../../config/genkit.config';
import {
  MCP_SERVERS,
  callMcpTool,
  googleAuthHeaders,
  mcpAvailability,
} from '../../../config/mcp.config';

// Helper: call Google Workspace MCP with auth headers
async function gw(tool: string, args: Record<string, unknown>): Promise<unknown> {
  if (!mcpAvailability.googleWorkspace) {
    throw new Error('Google Workspace MCP server is not available. Set GOOGLE_WORKSPACE_MCP_URL in .env.');
  }
  return callMcpTool(MCP_SERVERS.googleWorkspace!, tool, args, googleAuthHeaders());
}

// ── GMAIL ─────────────────────────────────────────────────────────────────────

export const gmailSearchTool = ai.defineTool(
  {
    name: 'gmail_search',
    description: 'Search emails in Gmail. Returns matching email threads with subject, sender, date, and snippet. Use to find relevant emails before replying.',
    inputSchema: z.object({
      query:   z.string().describe('Gmail search query (e.g., "from:boss@company.com subject:report")'),
      maxResults: z.number().optional().default(10),
    }),
    outputSchema: z.object({
      emails: z.array(z.object({
        id:       z.string(),
        subject:  z.string(),
        from:     z.string(),
        date:     z.string(),
        snippet:  z.string(),
        threadId: z.string(),
      })),
    }),
  },
  async ({ query, maxResults }) => {
    const result = await gw('gmail_search', { query, maxResults });
    const raw = result as { emails?: unknown[] } | string;
    if (typeof raw === 'string') {
      return { emails: [] }; // graceful parse failure
    }
    return { emails: (raw.emails ?? []) as Array<{ id: string; subject: string; from: string; date: string; snippet: string; threadId: string }> };
  }
);

export const gmailReadTool = ai.defineTool(
  {
    name: 'gmail_read',
    description: 'Read the full content of an email by its ID or thread ID.',
    inputSchema: z.object({
      messageId: z.string().describe('Gmail message ID or thread ID'),
    }),
    outputSchema: z.object({
      subject:  z.string(),
      from:     z.string(),
      to:       z.string(),
      date:     z.string(),
      body:     z.string(),
    }),
  },
  async ({ messageId }) => {
    const result = await gw('gmail_read', { messageId });
    return result as { subject: string; from: string; to: string; date: string; body: string };
  }
);

export const gmailDraftTool = ai.defineTool(
  {
    name: 'gmail_draft',
    description: 'Create a draft email in Gmail. Does NOT send — creates a draft for user review. Always use this instead of gmail_send unless explicitly asked to send.',
    inputSchema: z.object({
      to:       z.string().describe('Recipient email address'),
      subject:  z.string(),
      body:     z.string().describe('Email body (plain text or HTML)'),
      cc:       z.string().optional(),
      replyTo:  z.string().optional().describe('Message ID to reply to'),
    }),
    outputSchema: z.object({
      draftId: z.string(),
      message: z.string(),
    }),
  },
  async ({ to, subject, body, cc, replyTo }) => {
    const result = await gw('gmail_draft', { to, subject, body, cc, replyTo });
    return result as { draftId: string; message: string };
  }
);

export const gmailSendTool = ai.defineTool(
  {
    name: 'gmail_send',
    description: 'Send an email via Gmail. IMPORTANT: Only use when the user has explicitly approved sending. Prefer gmail_draft for creating drafts.',
    inputSchema: z.object({
      to:      z.string(),
      subject: z.string(),
      body:    z.string(),
      cc:      z.string().optional(),
    }),
    outputSchema: z.object({
      messageId: z.string(),
      message:   z.string(),
    }),
  },
  async ({ to, subject, body, cc }) => {
    const result = await gw('gmail_send', { to, subject, body, cc });
    return result as { messageId: string; message: string };
  }
);

export const gmailLabelTool = ai.defineTool(
  {
    name: 'gmail_label',
    description: 'Add or remove labels on emails for organization (e.g., mark as important, archive, add custom label).',
    inputSchema: z.object({
      messageId:    z.string(),
      addLabels:    z.array(z.string()).optional(),
      removeLabels: z.array(z.string()).optional(),
    }),
    outputSchema: z.object({ success: z.boolean() }),
  },
  async ({ messageId, addLabels, removeLabels }) => {
    await gw('gmail_label', { messageId, addLabels, removeLabels });
    return { success: true };
  }
);

// ── GOOGLE DRIVE ──────────────────────────────────────────────────────────────

export const driveSearchTool = ai.defineTool(
  {
    name: 'drive_search',
    description: 'Search files in Google Drive. Returns file name, type, last modified date, and download URL. Use for document ingestion or finding files.',
    inputSchema: z.object({
      query:   z.string().describe('Search query (e.g., "type:pdf modified:this_month")'),
      maxResults: z.number().optional().default(10),
      mimeType: z.string().optional().describe('Filter by MIME type (e.g., application/pdf)'),
    }),
    outputSchema: z.object({
      files: z.array(z.object({
        id:           z.string(),
        name:         z.string(),
        mimeType:     z.string(),
        modifiedTime: z.string(),
        size:         z.string().optional(),
        webViewLink:  z.string().optional(),
      })),
    }),
  },
  async ({ query, maxResults, mimeType }) => {
    const result = await gw('drive_search', { query, maxResults, mimeType });
    return result as { files: Array<{ id: string; name: string; mimeType: string; modifiedTime: string; size?: string; webViewLink?: string }> };
  }
);

export const driveDownloadTool = ai.defineTool(
  {
    name: 'drive_download',
    description: 'Download a file from Google Drive as base64 content for processing.',
    inputSchema: z.object({
      fileId:   z.string().describe('Google Drive file ID'),
      exportAs: z.string().optional().describe('Export MIME type for Google Docs (e.g., text/plain for Docs)'),
    }),
    outputSchema: z.object({
      fileName:    z.string(),
      mimeType:    z.string(),
      base64:      z.string(),
      sizeBytes:   z.number(),
    }),
  },
  async ({ fileId, exportAs }) => {
    const result = await gw('drive_download', { fileId, exportAs });
    return result as { fileName: string; mimeType: string; base64: string; sizeBytes: number };
  }
);

// ── GOOGLE CALENDAR ───────────────────────────────────────────────────────────

export const calendarListEventsTool = ai.defineTool(
  {
    name: 'calendar_list_events',
    description: 'List upcoming events from Google Calendar. Returns event title, attendees, date, location, and description.',
    inputSchema: z.object({
      calendarId: z.string().optional().default('primary'),
      timeMin:    z.string().optional().describe('ISO 8601 start time (defaults to now)'),
      timeMax:    z.string().optional().describe('ISO 8601 end time'),
      maxResults: z.number().optional().default(10),
      query:      z.string().optional().describe('Search query to filter events'),
    }),
    outputSchema: z.object({
      events: z.array(z.object({
        id:          z.string(),
        title:       z.string(),
        start:       z.string(),
        end:         z.string(),
        attendees:   z.array(z.string()),
        location:    z.string().optional(),
        description: z.string().optional(),
        meetLink:    z.string().optional(),
      })),
    }),
  },
  async (args) => {
    const result = await gw('calendar_list_events', args as Record<string, unknown>);
    return result as { events: Array<{ id: string; title: string; start: string; end: string; attendees: string[]; location?: string; description?: string; meetLink?: string }> };
  }
);

export const calendarCreateEventTool = ai.defineTool(
  {
    name: 'calendar_create_event',
    description: 'Create a new event in Google Calendar. Returns the created event ID and link.',
    inputSchema: z.object({
      title:       z.string(),
      start:       z.string().describe('ISO 8601 datetime (e.g., 2025-04-15T10:00:00)'),
      end:         z.string().describe('ISO 8601 datetime'),
      attendees:   z.array(z.string()).optional().describe('List of email addresses'),
      description: z.string().optional(),
      location:    z.string().optional(),
      calendarId:  z.string().optional().default('primary'),
    }),
    outputSchema: z.object({
      eventId:  z.string(),
      htmlLink: z.string(),
      message:  z.string(),
    }),
  },
  async (args) => {
    const result = await gw('calendar_create_event', args as Record<string, unknown>);
    return result as { eventId: string; htmlLink: string; message: string };
  }
);

// ── GOOGLE TASKS ──────────────────────────────────────────────────────────────

export const tasksCreateTool = ai.defineTool(
  {
    name: 'tasks_create',
    description: 'Create a task in Google Tasks. Perfect for saving action items from meetings.',
    inputSchema: z.object({
      title:    z.string(),
      notes:    z.string().optional(),
      due:      z.string().optional().describe('Due date in ISO 8601 format'),
      listId:   z.string().optional().describe('Task list ID (defaults to primary)'),
    }),
    outputSchema: z.object({
      taskId:  z.string(),
      message: z.string(),
    }),
  },
  async (args) => {
    const result = await gw('tasks_create', args as Record<string, unknown>);
    return result as { taskId: string; message: string };
  }
);

export const tasksListTool = ai.defineTool(
  {
    name: 'tasks_list',
    description: 'List tasks from Google Tasks. Returns pending and completed tasks with due dates.',
    inputSchema: z.object({
      listId:     z.string().optional().describe('Task list ID (defaults to primary)'),
      showCompleted: z.boolean().optional().default(false),
      maxResults: z.number().optional().default(20),
    }),
    outputSchema: z.object({
      tasks: z.array(z.object({
        id:     z.string(),
        title:  z.string(),
        status: z.string(),
        due:    z.string().optional(),
        notes:  z.string().optional(),
      })),
    }),
  },
  async (args) => {
    const result = await gw('tasks_list', args as Record<string, unknown>);
    return result as { tasks: Array<{ id: string; title: string; status: string; due?: string; notes?: string }> };
  }
);

// ── GOOGLE CONTACTS ───────────────────────────────────────────────────────────

export const contactsSearchTool = ai.defineTool(
  {
    name: 'contacts_search',
    description: 'Search the company contacts directory (Google Contacts). Returns name, email, phone, and job title.',
    inputSchema: z.object({
      query:      z.string().describe('Name, email, or keyword to search'),
      maxResults: z.number().optional().default(10),
    }),
    outputSchema: z.object({
      contacts: z.array(z.object({
        name:       z.string(),
        email:      z.string(),
        phone:      z.string().optional(),
        jobTitle:   z.string().optional(),
        department: z.string().optional(),
      })),
    }),
  },
  async (args) => {
    const result = await gw('contacts_search', args as Record<string, unknown>);
    return result as { contacts: Array<{ name: string; email: string; phone?: string; jobTitle?: string; department?: string }> };
  }
);

// ── GOOGLE SHEETS ─────────────────────────────────────────────────────────────

export const sheetsReadTool = ai.defineTool(
  {
    name: 'sheets_read',
    description: 'Read data from a Google Sheets spreadsheet. Returns rows as arrays. Use for financial data, KPIs, or any structured data in sheets.',
    inputSchema: z.object({
      spreadsheetId: z.string(),
      range:         z.string().describe('A1 notation range (e.g., "Sheet1!A1:Z100")'),
    }),
    outputSchema: z.object({
      values:    z.array(z.array(z.string())),
      rowCount:  z.number(),
      colCount:  z.number(),
    }),
  },
  async (args) => {
    const result = await gw('sheets_read', args as Record<string, unknown>);
    return result as { values: string[][]; rowCount: number; colCount: number };
  }
);

// ── GOOGLE DOCS ───────────────────────────────────────────────────────────────

export const docsReadTool = ai.defineTool(
  {
    name: 'docs_read',
    description: 'Read the full text content of a Google Docs document.',
    inputSchema: z.object({
      documentId: z.string().describe('Google Docs document ID (from URL)'),
    }),
    outputSchema: z.object({
      title:   z.string(),
      content: z.string(),
    }),
  },
  async (args) => {
    const result = await gw('docs_read', args as Record<string, unknown>);
    return result as { title: string; content: string };
  }
);

export const docsCreateTool = ai.defineTool(
  {
    name: 'docs_create',
    description: 'Create a new Google Docs document with content. Use for auto-generating reports.',
    inputSchema: z.object({
      title:   z.string(),
      content: z.string().describe('Document content in Markdown or plain text'),
    }),
    outputSchema: z.object({
      documentId: z.string(),
      title:      z.string(),
      url:        z.string(),
    }),
  },
  async (args) => {
    const result = await gw('docs_create', args as Record<string, unknown>);
    return result as { documentId: string; title: string; url: string };
  }
);

// ── GOOGLE SLIDES ─────────────────────────────────────────────────────────────

export const slidesCreateTool = ai.defineTool(
  {
    name: 'slides_create',
    description: 'Create a Google Slides presentation from structured content. Use for auto-generating insight presentations.',
    inputSchema: z.object({
      title:  z.string(),
      slides: z.array(z.object({
        title:   z.string(),
        content: z.string(),
        notes:   z.string().optional(),
      })),
    }),
    outputSchema: z.object({
      presentationId: z.string(),
      title:          z.string(),
      url:            z.string(),
    }),
  },
  async (args) => {
    const result = await gw('slides_create', args as Record<string, unknown>);
    return result as { presentationId: string; title: string; url: string };
  }
);

// ── Convenience bundles per agent ─────────────────────────────────────────────

/** Tools for Comms Agent */
export const COMMS_GOOGLE_TOOLS = [
  gmailSearchTool,
  gmailReadTool,
  gmailDraftTool,
  gmailSendTool,
  gmailLabelTool,
  contactsSearchTool,
] as const;

/** Tools for Meeting Agent */
export const MEETING_GOOGLE_TOOLS = [
  calendarListEventsTool,
  calendarCreateEventTool,
  tasksCreateTool,
  tasksListTool,
  gmailDraftTool,
] as const;

/** Tools for Documents Agent */
export const DOCUMENTS_GOOGLE_TOOLS = [
  driveSearchTool,
  driveDownloadTool,
  docsReadTool,
  sheetsReadTool,
] as const;

/** Tools for Q&A Agent */
export const QA_GOOGLE_TOOLS = [
  driveSearchTool,
  docsReadTool,
  sheetsReadTool,
] as const;

/** Tools for Insights Agent */
export const INSIGHTS_GOOGLE_TOOLS = [
  sheetsReadTool,
  docsCreateTool,
  slidesCreateTool,
  driveSearchTool,
] as const;
