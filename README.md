# Orlode AI

A corporate AI agent platform that enables companies to chat with their internal knowledge base, transcribe meetings, and analyze company data.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Zustand
- **Backend**: Node.js + Express + TypeScript
- **Database**: Firebase Firestore + Storage + Auth
- **Vector DB**: Pinecone
- **AI**: Anthropic Claude (claude-sonnet-4-20250514) + OpenAI (Whisper + text-embedding-3-small)

## Quick Start

### Prerequisites
- Node.js >= 18
- Firebase project (Firestore, Storage, Auth enabled)
- Pinecone account + index created
- Anthropic API key
- OpenAI API key

### Setup

1. **Clone and install dependencies**
   ```bash
   npm run install:all
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your actual keys
   ```
   Also copy `.env.example` to `client/.env` and `server/.env`.

3. **Initialize Pinecone index**
   ```bash
   cd scripts && npx ts-node setup-pinecone.ts
   ```

4. **(Optional) Seed demo data**
   ```bash
   cd scripts && npx ts-node seed-demo-data.ts
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

## Project Structure

```
corpmind-ai/
├── client/                 # React frontend
│   └── src/
│       ├── components/     # UI components
│       ├── pages/          # Page components
│       ├── hooks/          # Custom React hooks
│       ├── services/       # API & Firebase services
│       ├── store/          # Zustand state stores
│       ├── types/          # TypeScript types
│       └── utils/          # Utility functions
├── server/                 # Express backend
│   └── src/
│       ├── config/         # Service configurations
│       ├── controllers/    # Route handlers
│       ├── middleware/     # Express middleware
│       ├── models/         # TypeScript interfaces
│       ├── routes/         # API routes
│       ├── services/       # Business logic
│       └── utils/          # Server utilities
├── shared/                 # Shared types
├── scripts/                # Setup & seed scripts
├── firebase.json
├── firestore.rules
└── firestore.indexes.json
```

## Features (Phase 1 MVP)

- **AI Chat**: Ask questions about your company's documents with RAG
- **Document Management**: Upload PDF, DOCX, XLSX, CSV, TXT files
- **Meeting Management**: Track meetings and notes
- **Analytics**: Usage statistics dashboard
- **Face Directory**: Employee recognition (Phase 2)
- **Settings**: Company configuration and AI personality

## Architecture

### RAG Pipeline
1. Document uploaded → text extracted (pdf-parse, mammoth, xlsx)
2. Text chunked into 800-token segments with 150 overlap
3. Chunks embedded via OpenAI text-embedding-3-small (1536 dims)
4. Vectors stored in Pinecone (namespace = companyId)
5. Query → embed → Pinecone semantic search → top-5 chunks → Claude

### Streaming Chat
- Server-Sent Events (SSE) for real-time token streaming
- Conversation history stored in Firestore (last 20 messages)
- Sources cited inline with document references

## Production Deployment

- Frontend: Deploy `client/dist` to Vercel/Netlify
- Backend: Deploy `server` to Railway/Render/Cloud Run
- Set all environment variables in deployment platform
- Update `CORS_ORIGIN` to production frontend URL
