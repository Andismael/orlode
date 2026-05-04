import { Pinecone } from '@pinecone-database/pinecone';
import { env } from './env.config';
import { logger } from '../utils/logger';

let pineconeClient: Pinecone;

export function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: env.PINECONE_API_KEY,
    });
    logger.info('Pinecone client initialized');
  }
  return pineconeClient;
}

export function getPineconeIndex() {
  const client = getPineconeClient();
  return client.index(env.PINECONE_INDEX_NAME);
}
