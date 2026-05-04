/**
 * Setup Pinecone index for Orlode AI
 * Run: cd scripts && npx ts-node setup-pinecone.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import { Pinecone } from '@pinecone-database/pinecone';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const INDEX_NAME = process.env['PINECONE_INDEX_NAME'] ?? 'corpmind';
const EMBEDDING_DIMENSIONS = 1536; // text-embedding-3-small dimensions

async function setupPinecone(): Promise<void> {
  const apiKey = process.env['PINECONE_API_KEY'];
  if (!apiKey) {
    throw new Error('PINECONE_API_KEY is required in .env');
  }

  console.log('Initializing Pinecone client...');
  const pinecone = new Pinecone({ apiKey });

  // Check existing indexes
  const existingIndexes = await pinecone.listIndexes();
  const indexNames = existingIndexes.indexes?.map((i) => i.name) ?? [];

  if (indexNames.includes(INDEX_NAME)) {
    console.log(`Index "${INDEX_NAME}" already exists. Skipping creation.`);
    const index = pinecone.index(INDEX_NAME);
    const stats = await index.describeIndexStats();
    console.log('Index stats:', JSON.stringify(stats, null, 2));
    return;
  }

  console.log(`Creating Pinecone index "${INDEX_NAME}" with ${EMBEDDING_DIMENSIONS} dimensions...`);

  await pinecone.createIndex({
    name: INDEX_NAME,
    dimension: EMBEDDING_DIMENSIONS,
    metric: 'cosine',
    spec: {
      serverless: {
        cloud: 'aws',
        region: 'us-east-1',
      },
    },
  });

  // Wait for index to be ready
  console.log('Waiting for index to be ready...');
  let ready = false;
  let attempts = 0;
  const maxAttempts = 30;

  while (!ready && attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 5000));
    const description = await pinecone.describeIndex(INDEX_NAME);
    ready = description.status?.ready ?? false;
    attempts++;
    process.stdout.write(`Attempt ${attempts}/${maxAttempts}: ${ready ? 'Ready!' : 'Not ready yet...'}\r`);
  }

  if (ready) {
    console.log(`\nPinecone index "${INDEX_NAME}" is ready!`);
    console.log(`Dimensions: ${EMBEDDING_DIMENSIONS} (text-embedding-3-small)`);
    console.log('Metric: cosine');
    console.log('You can now upload documents and they will be indexed automatically.');
  } else {
    console.log(`\nIndex creation may still be in progress. Check the Pinecone dashboard.`);
  }
}

setupPinecone().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
