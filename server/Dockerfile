# CorpMind AI Server — Cloud Run Dockerfile
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install all deps (including devDeps for tsc)
RUN npm install

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# ── Production stage ──
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json ./

# Install production deps only
RUN npm install --omit=dev

# Copy built JS from builder
COPY --from=builder /app/dist ./dist

# Cloud Run uses PORT env var (default 8080)
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "dist/index.js"]
