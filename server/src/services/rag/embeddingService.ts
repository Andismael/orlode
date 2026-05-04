import OpenAI from 'openai';
import { env } from '../../config/env.config';
import { logger } from '../../utils/logger';
import { chunkArray, retry } from '../../utils/helpers';

let openaiClient: OpenAI;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  return retry(async () => {
    const client = getOpenAI();
    const response = await client.embeddings.create({
      model: env.EMBEDDING_MODEL,
      input: text.replace(/\n/g, ' ').slice(0, 8191), // max input
      dimensions: 1536,
    });
    return response.data[0]!.embedding;
  }, 3, 1000);
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  // OpenAI allows up to 100 texts per batch, but we batch by 50 to be safe
  const batches = chunkArray(texts, 50);
  const allEmbeddings: number[][] = [];

  for (const batch of batches) {
    const batchEmbeddings = await retry(async () => {
      const client = getOpenAI();
      const response = await client.embeddings.create({
        model: env.EMBEDDING_MODEL,
        input: batch.map((t) => t.replace(/\n/g, ' ').slice(0, 8191)),
        dimensions: 1536,
      });
      return response.data.map((d) => d.embedding);
    }, 3, 1000);

    allEmbeddings.push(...batchEmbeddings);
    logger.debug(`Embedded batch of ${batch.length} texts`);
  }

  return allEmbeddings;
}
