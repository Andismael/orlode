"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INSIGHTS_GOOGLE_TOOLS = exports.QA_GOOGLE_TOOLS = exports.DOCUMENTS_GOOGLE_TOOLS = exports.MEETING_GOOGLE_TOOLS = exports.COMMS_GOOGLE_TOOLS = exports.slidesCreateTool = exports.docsCreateTool = exports.docsReadTool = exports.sheetsReadTool = exports.contactsSearchTool = exports.tasksListTool = exports.tasksCreateTool = exports.calendarCreateEventTool = exports.calendarListEventsTool = exports.driveDownloadTool = exports.driveSearchTool = exports.gmailLabelTool = exports.gmailSendTool = exports.gmailDraftTool = exports.gmailReadTool = exports.gmailSearchTool = void 0;
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
const zod_1 = require("zod");
const genkit_config_1 = require("../../../config/genkit.config");
const mcp_config_1 = require("../../../config/mcp.config");
// Helper: call Google Workspace MCP with auth headers
async function gw(tool, args) {
    if (!mcp_config_1.mcpAvailability.googleWorkspace) {
        throw new Error('Google Workspace MCP server is not available. Set GOOGLE_WORKSPACE_MCP_URL in .env.');
    }
    return (0, mcp_config_1.callMcpTool)(mcp_config_1.MCP_SERVERS.googleWorkspace, tool, args, (0, mcp_config_1.googleAuthHeaders)());
}
// ── GMAIL ─────────────────────────────────────────────────────────────────────
exports.gmailSearchTool = genkit_config_1.ai.defineTool({
    name: 'gmail_search',
    description: 'Search emails in Gmail. Returns matching email threads with subject, sender, date, and snippet. Use to find relevant emails before replying.',
    inputSchema: zod_1.z.object({
        query: zod_1.z.string().describe('Gmail search query (e.g., "from:boss@company.com subject:report")'),
        maxResults: zod_1.z.number().optional().default(10),
    }),
    outputSchema: zod_1.z.object({
        emails: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            subject: zod_1.z.string(),
            from: zod_1.z.string(),
            date: zod_1.z.string(),
            snippet: zod_1.z.string(),
            threadId: zod_1.z.string(),
        })),
    }),
}, async ({ query, maxResults }) => {
    const result = await gw('gmail_search', { query, maxResults });
    const raw = result;
    if (typeof raw === 'string') {
        return { emails: [] }; // graceful parse failure
    }
    return { emails: (raw.emails ?? []) };
});
exports.gmailReadTool = genkit_config_1.ai.defineTool({
    name: 'gmail_read',
    description: 'Read the full content of an email by its ID or thread ID.',
    inputSchema: zod_1.z.object({
        messageId: zod_1.z.string().describe('Gmail message ID or thread ID'),
    }),
    outputSchema: zod_1.z.object({
        subject: zod_1.z.string(),
        from: zod_1.z.string(),
        to: zod_1.z.string(),
        date: zod_1.z.string(),
        body: zod_1.z.string(),
    }),
}, async ({ messageId }) => {
    const result = await gw('gmail_read', { messageId });
    return result;
});
exports.gmailDraftTool = genkit_config_1.ai.defineTool({
    name: 'gmail_draft',
    description: 'Create a draft email in Gmail. Does NOT send — creates a draft for user review. Always use this instead of gmail_send unless explicitly asked to send.',
    inputSchema: zod_1.z.object({
        to: zod_1.z.string().describe('Recipient email address'),
        subject: zod_1.z.string(),
        body: zod_1.z.string().describe('Email body (plain text or HTML)'),
        cc: zod_1.z.string().optional(),
        replyTo: zod_1.z.string().optional().describe('Message ID to reply to'),
    }),
    outputSchema: zod_1.z.object({
        draftId: zod_1.z.string(),
        message: zod_1.z.string(),
    }),
}, async ({ to, subject, body, cc, replyTo }) => {
    const result = await gw('gmail_draft', { to, subject, body, cc, replyTo });
    return result;
});
exports.gmailSendTool = genkit_config_1.ai.defineTool({
    name: 'gmail_send',
    description: 'Send an email via Gmail. IMPORTANT: Only use when the user has explicitly approved sending. Prefer gmail_draft for creating drafts.',
    inputSchema: zod_1.z.object({
        to: zod_1.z.string(),
        subject: zod_1.z.string(),
        body: zod_1.z.string(),
        cc: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        messageId: zod_1.z.string(),
        message: zod_1.z.string(),
    }),
}, async ({ to, subject, body, cc }) => {
    const result = await gw('gmail_send', { to, subject, body, cc });
    return result;
});
exports.gmailLabelTool = genkit_config_1.ai.defineTool({
    name: 'gmail_label',
    description: 'Add or remove labels on emails for organization (e.g., mark as important, archive, add custom label).',
    inputSchema: zod_1.z.object({
        messageId: zod_1.z.string(),
        addLabels: zod_1.z.array(zod_1.z.string()).optional(),
        removeLabels: zod_1.z.array(zod_1.z.string()).optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean() }),
}, async ({ messageId, addLabels, removeLabels }) => {
    await gw('gmail_label', { messageId, addLabels, removeLabels });
    return { success: true };
});
// ── GOOGLE DRIVE ──────────────────────────────────────────────────────────────
exports.driveSearchTool = genkit_config_1.ai.defineTool({
    name: 'drive_search',
    description: 'Search files in Google Drive. Returns file name, type, last modified date, and download URL. Use for document ingestion or finding files.',
    inputSchema: zod_1.z.object({
        query: zod_1.z.string().describe('Search query (e.g., "type:pdf modified:this_month")'),
        maxResults: zod_1.z.number().optional().default(10),
        mimeType: zod_1.z.string().optional().describe('Filter by MIME type (e.g., application/pdf)'),
    }),
    outputSchema: zod_1.z.object({
        files: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            name: zod_1.z.string(),
            mimeType: zod_1.z.string(),
            modifiedTime: zod_1.z.string(),
            size: zod_1.z.string().optional(),
            webViewLink: zod_1.z.string().optional(),
        })),
    }),
}, async ({ query, maxResults, mimeType }) => {
    const result = await gw('drive_search', { query, maxResults, mimeType });
    return result;
});
exports.driveDownloadTool = genkit_config_1.ai.defineTool({
    name: 'drive_download',
    description: 'Download a file from Google Drive as base64 content for processing.',
    inputSchema: zod_1.z.object({
        fileId: zod_1.z.string().describe('Google Drive file ID'),
        exportAs: zod_1.z.string().optional().describe('Export MIME type for Google Docs (e.g., text/plain for Docs)'),
    }),
    outputSchema: zod_1.z.object({
        fileName: zod_1.z.string(),
        mimeType: zod_1.z.string(),
        base64: zod_1.z.string(),
        sizeBytes: zod_1.z.number(),
    }),
}, async ({ fileId, exportAs }) => {
    const result = await gw('drive_download', { fileId, exportAs });
    return result;
});
// ── GOOGLE CALENDAR ───────────────────────────────────────────────────────────
exports.calendarListEventsTool = genkit_config_1.ai.defineTool({
    name: 'calendar_list_events',
    description: 'List upcoming events from Google Calendar. Returns event title, attendees, date, location, and description.',
    inputSchema: zod_1.z.object({
        calendarId: zod_1.z.string().optional().default('primary'),
        timeMin: zod_1.z.string().optional().describe('ISO 8601 start time (defaults to now)'),
        timeMax: zod_1.z.string().optional().describe('ISO 8601 end time'),
        maxResults: zod_1.z.number().optional().default(10),
        query: zod_1.z.string().optional().describe('Search query to filter events'),
    }),
    outputSchema: zod_1.z.object({
        events: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            title: zod_1.z.string(),
            start: zod_1.z.string(),
            end: zod_1.z.string(),
            attendees: zod_1.z.array(zod_1.z.string()),
            location: zod_1.z.string().optional(),
            description: zod_1.z.string().optional(),
            meetLink: zod_1.z.string().optional(),
        })),
    }),
}, async (args) => {
    const result = await gw('calendar_list_events', args);
    return result;
});
exports.calendarCreateEventTool = genkit_config_1.ai.defineTool({
    name: 'calendar_create_event',
    description: 'Create a new event in Google Calendar. Returns the created event ID and link.',
    inputSchema: zod_1.z.object({
        title: zod_1.z.string(),
        start: zod_1.z.string().describe('ISO 8601 datetime (e.g., 2025-04-15T10:00:00)'),
        end: zod_1.z.string().describe('ISO 8601 datetime'),
        attendees: zod_1.z.array(zod_1.z.string()).optional().describe('List of email addresses'),
        description: zod_1.z.string().optional(),
        location: zod_1.z.string().optional(),
        calendarId: zod_1.z.string().optional().default('primary'),
    }),
    outputSchema: zod_1.z.object({
        eventId: zod_1.z.string(),
        htmlLink: zod_1.z.string(),
        message: zod_1.z.string(),
    }),
}, async (args) => {
    const result = await gw('calendar_create_event', args);
    return result;
});
// ── GOOGLE TASKS ──────────────────────────────────────────────────────────────
exports.tasksCreateTool = genkit_config_1.ai.defineTool({
    name: 'tasks_create',
    description: 'Create a task in Google Tasks. Perfect for saving action items from meetings.',
    inputSchema: zod_1.z.object({
        title: zod_1.z.string(),
        notes: zod_1.z.string().optional(),
        due: zod_1.z.string().optional().describe('Due date in ISO 8601 format'),
        listId: zod_1.z.string().optional().describe('Task list ID (defaults to primary)'),
    }),
    outputSchema: zod_1.z.object({
        taskId: zod_1.z.string(),
        message: zod_1.z.string(),
    }),
}, async (args) => {
    const result = await gw('tasks_create', args);
    return result;
});
exports.tasksListTool = genkit_config_1.ai.defineTool({
    name: 'tasks_list',
    description: 'List tasks from Google Tasks. Returns pending and completed tasks with due dates.',
    inputSchema: zod_1.z.object({
        listId: zod_1.z.string().optional().describe('Task list ID (defaults to primary)'),
        showCompleted: zod_1.z.boolean().optional().default(false),
        maxResults: zod_1.z.number().optional().default(20),
    }),
    outputSchema: zod_1.z.object({
        tasks: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            title: zod_1.z.string(),
            status: zod_1.z.string(),
            due: zod_1.z.string().optional(),
            notes: zod_1.z.string().optional(),
        })),
    }),
}, async (args) => {
    const result = await gw('tasks_list', args);
    return result;
});
// ── GOOGLE CONTACTS ───────────────────────────────────────────────────────────
exports.contactsSearchTool = genkit_config_1.ai.defineTool({
    name: 'contacts_search',
    description: 'Search the company contacts directory (Google Contacts). Returns name, email, phone, and job title.',
    inputSchema: zod_1.z.object({
        query: zod_1.z.string().describe('Name, email, or keyword to search'),
        maxResults: zod_1.z.number().optional().default(10),
    }),
    outputSchema: zod_1.z.object({
        contacts: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string(),
            email: zod_1.z.string(),
            phone: zod_1.z.string().optional(),
            jobTitle: zod_1.z.string().optional(),
            department: zod_1.z.string().optional(),
        })),
    }),
}, async (args) => {
    const result = await gw('contacts_search', args);
    return result;
});
// ── GOOGLE SHEETS ─────────────────────────────────────────────────────────────
exports.sheetsReadTool = genkit_config_1.ai.defineTool({
    name: 'sheets_read',
    description: 'Read data from a Google Sheets spreadsheet. Returns rows as arrays. Use for financial data, KPIs, or any structured data in sheets.',
    inputSchema: zod_1.z.object({
        spreadsheetId: zod_1.z.string(),
        range: zod_1.z.string().describe('A1 notation range (e.g., "Sheet1!A1:Z100")'),
    }),
    outputSchema: zod_1.z.object({
        values: zod_1.z.array(zod_1.z.array(zod_1.z.string())),
        rowCount: zod_1.z.number(),
        colCount: zod_1.z.number(),
    }),
}, async (args) => {
    const result = await gw('sheets_read', args);
    return result;
});
// ── GOOGLE DOCS ───────────────────────────────────────────────────────────────
exports.docsReadTool = genkit_config_1.ai.defineTool({
    name: 'docs_read',
    description: 'Read the full text content of a Google Docs document.',
    inputSchema: zod_1.z.object({
        documentId: zod_1.z.string().describe('Google Docs document ID (from URL)'),
    }),
    outputSchema: zod_1.z.object({
        title: zod_1.z.string(),
        content: zod_1.z.string(),
    }),
}, async (args) => {
    const result = await gw('docs_read', args);
    return result;
});
exports.docsCreateTool = genkit_config_1.ai.defineTool({
    name: 'docs_create',
    description: 'Create a new Google Docs document with content. Use for auto-generating reports.',
    inputSchema: zod_1.z.object({
        title: zod_1.z.string(),
        content: zod_1.z.string().describe('Document content in Markdown or plain text'),
    }),
    outputSchema: zod_1.z.object({
        documentId: zod_1.z.string(),
        title: zod_1.z.string(),
        url: zod_1.z.string(),
    }),
}, async (args) => {
    const result = await gw('docs_create', args);
    return result;
});
// ── GOOGLE SLIDES ─────────────────────────────────────────────────────────────
exports.slidesCreateTool = genkit_config_1.ai.defineTool({
    name: 'slides_create',
    description: 'Create a Google Slides presentation from structured content. Use for auto-generating insight presentations.',
    inputSchema: zod_1.z.object({
        title: zod_1.z.string(),
        slides: zod_1.z.array(zod_1.z.object({
            title: zod_1.z.string(),
            content: zod_1.z.string(),
            notes: zod_1.z.string().optional(),
        })),
    }),
    outputSchema: zod_1.z.object({
        presentationId: zod_1.z.string(),
        title: zod_1.z.string(),
        url: zod_1.z.string(),
    }),
}, async (args) => {
    const result = await gw('slides_create', args);
    return result;
});
// ── Convenience bundles per agent ─────────────────────────────────────────────
/** Tools for Comms Agent */
exports.COMMS_GOOGLE_TOOLS = [
    exports.gmailSearchTool,
    exports.gmailReadTool,
    exports.gmailDraftTool,
    exports.gmailSendTool,
    exports.gmailLabelTool,
    exports.contactsSearchTool,
];
/** Tools for Meeting Agent */
exports.MEETING_GOOGLE_TOOLS = [
    exports.calendarListEventsTool,
    exports.calendarCreateEventTool,
    exports.tasksCreateTool,
    exports.tasksListTool,
    exports.gmailDraftTool,
];
/** Tools for Documents Agent */
exports.DOCUMENTS_GOOGLE_TOOLS = [
    exports.driveSearchTool,
    exports.driveDownloadTool,
    exports.docsReadTool,
    exports.sheetsReadTool,
];
/** Tools for Q&A Agent */
exports.QA_GOOGLE_TOOLS = [
    exports.driveSearchTool,
    exports.docsReadTool,
    exports.sheetsReadTool,
];
/** Tools for Insights Agent */
exports.INSIGHTS_GOOGLE_TOOLS = [
    exports.sheetsReadTool,
    exports.docsCreateTool,
    exports.slidesCreateTool,
    exports.driveSearchTool,
];
//# sourceMappingURL=googleWorkspace.js.map