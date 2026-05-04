import dotenv from 'dotenv';
import path from 'path';

// Load .env from the corpmind-ai root (one level up from server/)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
// Also try server/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

function optional(key: string, defaultVal = ''): string {
  return process.env[key] ?? defaultVal;
}

export const env = {
  // Server
  PORT: parseInt(optional('PORT', '3001'), 10),
  NODE_ENV: optional('NODE_ENV', 'development') as 'development' | 'production' | 'test',
  CORS_ORIGIN: optional('CORS_ORIGIN', 'http://localhost:5173'),
  JWT_SECRET: optional('JWT_SECRET', 'change-me-in-production'),

  // Firebase Admin (optional — auth features disabled if not set)
  FIREBASE_SERVICE_ACCOUNT_KEY: optional('FIREBASE_SERVICE_ACCOUNT_KEY'),
  FIREBASE_STORAGE_BUCKET: optional('FIREBASE_STORAGE_BUCKET', 'mon-assistant-86bbd.firebasestorage.app'),

  // Anthropic (legacy — non utilisé, remplacé par Gemini 3 Pro)
  ANTHROPIC_API_KEY: optional('ANTHROPIC_API_KEY'),
  CLAUDE_MODEL: optional('CLAUDE_MODEL', 'claude-sonnet-4-20250514'),

  // OpenAI
  OPENAI_API_KEY: optional('OPENAI_API_KEY'),
  EMBEDDING_MODEL: optional('EMBEDDING_MODEL', 'text-embedding-3-small'),

  // Pinecone
  PINECONE_API_KEY: optional('PINECONE_API_KEY'),
  PINECONE_INDEX_NAME: optional('PINECONE_INDEX_NAME', 'corpmind'),

  // Google AI (Gemini via Firebase AI Logic / Genkit) — v2
  GOOGLE_AI_API_KEY: optional('GOOGLE_AI_API_KEY'),
  GOOGLE_AI_ENABLED: optional('GOOGLE_AI_ENABLED', 'true'),

  // Dialogflow CX / Contact Center AI webhook
  // Header secret expected on POST /api/ccai/webhook (sent by Dialogflow CX webhook config)
  DIALOGFLOW_WEBHOOK_SECRET: optional('DIALOGFLOW_WEBHOOK_SECRET'),
  // Optional: full page path to bascule on handoff. Format:
  // projects/{p}/locations/{l}/agents/{a}/flows/{f}/pages/{page}
  DIALOGFLOW_HANDOFF_PAGE: optional('DIALOGFLOW_HANDOFF_PAGE'),

  // ── MCP Servers (Phase 3) ────────────────────────────────────────────────────
  // Google Workspace MCP (Gmail, Drive, Calendar, Tasks, Contacts, Sheets, Docs, Slides)
  GOOGLE_WORKSPACE_MCP_URL:   optional('GOOGLE_WORKSPACE_MCP_URL'),
  GOOGLE_WORKSPACE_MCP_TOKEN: optional('GOOGLE_WORKSPACE_MCP_TOKEN'),  // OAuth access token

  // Slack MCP
  SLACK_MCP_URL:   optional('SLACK_MCP_URL'),
  SLACK_BOT_TOKEN: optional('SLACK_BOT_TOKEN'),

  // BigQuery MCP (Phase 4)
  BIGQUERY_MCP_URL:    optional('BIGQUERY_MCP_URL'),
  BIGQUERY_PROJECT_ID: optional('BIGQUERY_PROJECT_ID'),

  // Notion MCP (Phase 5)
  NOTION_MCP_URL:    optional('NOTION_MCP_URL'),
  NOTION_API_KEY:    optional('NOTION_API_KEY'),

  // HubSpot MCP (Phase 4-5)
  HUBSPOT_MCP_URL: optional('HUBSPOT_MCP_URL'),
  HUBSPOT_API_KEY: optional('HUBSPOT_API_KEY'),

  // Email — Resend
  RESEND_API_KEY: optional('RESEND_API_KEY'),
  RESEND_FROM:    optional('RESEND_FROM', 'Orlode AI <noreply@music.zinakonect.com>'),

  // SMTP (legacy fallback)
  SMTP_HOST: optional('SMTP_HOST'),
  SMTP_PORT: parseInt(optional('SMTP_PORT', '587'), 10),
  SMTP_USER: optional('SMTP_USER'),
  SMTP_PASS: optional('SMTP_PASS'),
  ELEVENLABS_API_KEY: optional('ELEVENLABS_API_KEY'),
  ELEVENLABS_VOICE_ID: optional('ELEVENLABS_VOICE_ID'),

  // WhatsApp Business
  WHATSAPP_APP_SECRET:          optional('WHATSAPP_APP_SECRET'),
  WHATSAPP_PHONE_NUMBER_ID:     optional('WHATSAPP_PHONE_NUMBER_ID'),
  WHATSAPP_BUSINESS_ACCOUNT_ID: optional('WHATSAPP_BUSINESS_ACCOUNT_ID'),
  WHATSAPP_ACCESS_TOKEN:        optional('WHATSAPP_ACCESS_TOKEN'),
  WHATSAPP_VERIFY_TOKEN:        optional('WHATSAPP_VERIFY_TOKEN'),

  // BYOE — Tenant API key encryption master key (AES-256)
  // MUST be set to a 32+ char random string in production
  TENANT_ENCRYPTION_KEY: optional('TENANT_ENCRYPTION_KEY'),

  // Stripe (Billing)
  STRIPE_SECRET_KEY: optional('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: optional('STRIPE_WEBHOOK_SECRET'),
  STRIPE_STARTER_PRICE_ID: optional('STRIPE_STARTER_PRICE_ID'),
  STRIPE_PRO_PRICE_ID: optional('STRIPE_PRO_PRICE_ID'),
  STRIPE_ENTERPRISE_PRICE_ID: optional('STRIPE_ENTERPRISE_PRICE_ID'),
} as const;

export type Env = typeof env;
