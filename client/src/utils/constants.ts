export const API_BASE_URL = '/api';

export const API_ROUTES = {
  // Auth
  AUTH_REGISTER: '/auth/register',
  AUTH_VERIFY: '/auth/verify-token',

  // Chat
  CONVERSATIONS: '/chat/conversations',
  CONVERSATION_MESSAGES: (id: string) => `/chat/conversations/${id}/messages`,

  // Data
  DOCUMENTS: '/data/documents',
  DOCUMENT_BY_ID: (id: string) => `/data/documents/${id}`,

  // Analytics
  ANALYTICS_OVERVIEW: '/analytics/overview',

  // Meetings
  MEETINGS: '/meetings',
  MEETING_BY_ID: (id: string) => `/meetings/${id}`,
} as const;

export const SUPPORTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/csv': ['.csv'],
  'text/plain': ['.txt'],
} as const;

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export const MAX_CONVERSATION_HISTORY = 20;

export const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;
export const PINECONE_INDEX_NAME = 'corpmind';
export const CHUNK_SIZE_TOKENS = 800;
export const CHUNK_OVERLAP_TOKENS = 150;
export const TOP_K_RESULTS = 5;
