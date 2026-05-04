/**
 * Orlode AI — Firestore Vector Index Setup (v2)
 *
 * This script prints instructions for creating the required Firestore indexes,
 * including the vector index on the `vectorChunks` collection.
 *
 * Run:
 *   npx ts-node scripts/setup-firestore-indexes.ts
 *
 * The firestore.indexes.json at the project root also contains the index
 * definitions — deploy them with:
 *   firebase deploy --only firestore:indexes
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PROJECT_ID = process.env['VITE_FIREBASE_PROJECT_ID'] ?? 'mon-assistant-86bbd';

console.log('\n===== Orlode AI — Firestore Index Setup =====\n');

console.log('1. Deploy existing indexes from firestore.indexes.json:');
console.log(`   firebase deploy --only firestore:indexes --project ${PROJECT_ID}\n`);

console.log('2. To create the vector index manually via Firebase CLI:');
console.log(`   firebase firestore:indexes --project ${PROJECT_ID}\n`);

console.log('3. Add the following to firestore.indexes.json (already done in v2):');
console.log(`
{
  "fieldOverrides": [
    {
      "collectionGroup": "vectorChunks",
      "fieldPath": "embedding",
      "indexes": [],
      "vectorConfig": {
        "dimension": 768,
        "flat": {}
      }
    }
  ]
}
`);

console.log('4. Vector index note:');
console.log('   - Dimension 768 matches text-embedding-004 (Google AI)');
console.log('   - The index is scoped per company sub-collection: companies/{id}/vectorChunks');
console.log('   - Allow ~5 minutes for the index to build after deployment\n');

console.log('5. Verify indexes are active:');
console.log('   https://console.firebase.google.com/project/' + PROJECT_ID + '/firestore/indexes\n');

// Optionally verify Firebase Admin can connect
if (process.env['FIREBASE_SERVICE_ACCOUNT_KEY']) {
  try {
    const serviceAccount = JSON.parse(
      process.env['FIREBASE_SERVICE_ACCOUNT_KEY']
    ) as admin.ServiceAccount;

    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    const db = app.firestore();
    db.collection('_health_check').limit(1).get()
      .then(() => {
        console.log('✓ Firestore connection successful\n');
        process.exit(0);
      })
      .catch((err: unknown) => {
        console.error('✗ Firestore connection failed:', err);
        process.exit(1);
      });
  } catch (err) {
    console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT_KEY — skipping connection check\n');
    process.exit(0);
  }
} else {
  console.log('FIREBASE_SERVICE_ACCOUNT_KEY not set — skipping connection check\n');
  process.exit(0);
}
