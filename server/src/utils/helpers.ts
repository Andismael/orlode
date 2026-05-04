import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export function generateId(): string {
  return uuidv4();
}

export function sanitizeFilename(filename: string): string {
  // Remove path components, keep only basename
  const base = path.basename(filename);
  // Replace problematic characters
  return base
    .replace(/[^a-zA-Z0-9._\-\s]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

export function getFileExtension(filename: string): string {
  return path.extname(filename).toLowerCase().replace('.', '');
}

export function buildMetadataFilter(
  companyId: string,
  additionalFilters?: Record<string, string | number | boolean>
): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    companyId: { $eq: companyId },
  };

  if (additionalFilters) {
    for (const [key, value] of Object.entries(additionalFilters)) {
      filter[key] = { $eq: value };
    }
  }

  return filter;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 1000,
  backoff = 2
): Promise<T> {
  let lastError: Error = new Error('Retry failed');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts) {
        await sleep(delayMs * Math.pow(backoff, attempt - 1));
      }
    }
  }
  throw lastError;
}

export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function estimateTokenCount(text: string): number {
  // Rough estimate: ~4 chars per token for English, ~3 for French
  return Math.ceil(text.length / 3.8);
}
