import { FieldValue } from 'firebase-admin/firestore';
import { getFirestore } from '../../config/firebase.config';
import { logger } from '../../utils/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface VectorChunkData {
  documentId: string;
  documentName: string;
  content: string;
  chunkIndex: number;
  metadata: {
    category: string;
    department?: string;
    confidentiality: string;
    language: string;
    pageNumber?: number;
    tokenCount: number;
    entities?: Array<{
      type: string;
      value: string;
      confidence: number;
    }>;
  };
}

export interface ScoredChunk {
  id: string;
  content: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  score: number;
  metadata: VectorChunkData['metadata'];
}

// ── FirestoreVectorStore ─────────────────────────────────────────────────────

export class FirestoreVectorStore {
  private collectionPath(companyId: string): string {
    return `companies/${companyId}/vectorChunks`;
  }

  /**
   * Upsert a chunk with its embedding vector into Firestore.
   */
  async upsertChunk(
    companyId: string,
    chunkId: string,
    chunk: VectorChunkData,
    embedding: number[]
  ): Promise<void> {
    const db = getFirestore();
    const ref = db.collection(this.collectionPath(companyId)).doc(chunkId);

    await ref.set({
      ...chunk,
      embedding: FieldValue.vector(embedding),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.debug(`[FirestoreVectorStore] Upserted chunk ${chunkId} for company ${companyId}`);
  }

  /**
   * Batch-upsert multiple chunks.
   */
  async upsertChunks(
    companyId: string,
    chunks: Array<{ id: string; data: VectorChunkData; embedding: number[] }>
  ): Promise<void> {
    const db = getFirestore();
    const colRef = db.collection(this.collectionPath(companyId));

    // Firestore batch writes max 500 per batch
    const BATCH_SIZE = 400;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const slice = chunks.slice(i, i + BATCH_SIZE);

      for (const { id, data, embedding } of slice) {
        const ref = colRef.doc(id);
        batch.set(ref, {
          ...data,
          embedding: FieldValue.vector(embedding),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();
      logger.debug(`[FirestoreVectorStore] Batch upserted ${slice.length} chunks (offset ${i})`);
    }
  }

  /**
   * Find nearest chunks using Firestore vector search (findNearest).
   * Requires a vector index on the `embedding` field — see firestore.indexes.json.
   */
  async findNearest(
    companyId: string,
    queryVector: number[],
    options: {
      limit?: number;
      filters?: Record<string, string>;
    } = {}
  ): Promise<ScoredChunk[]> {
    const db = getFirestore();
    const { limit = 10, filters = {} } = options;

    try {
      let colRef: FirebaseFirestore.Query = db.collection(this.collectionPath(companyId));

      // Apply any equality filters (e.g. category, confidentiality)
      for (const [field, value] of Object.entries(filters)) {
        colRef = colRef.where(`metadata.${field}`, '==', value);
      }

      // Cast to CollectionReference to access findNearest (admin SDK v12+)
      const vectorQuery = (
        db.collection(this.collectionPath(companyId)) as FirebaseFirestore.CollectionReference
      ).findNearest('embedding', FieldValue.vector(queryVector), {
        limit,
        distanceMeasure: 'COSINE',
      });

      const snapshot = await vectorQuery.get();

      return snapshot.docs.map((doc, idx) => {
        const data = doc.data() as VectorChunkData & { [key: string]: unknown };
        // Firestore does not yet return similarity scores natively in all SDKs;
        // use rank-based score as fallback (1.0 for rank 0)
        const score = typeof data['_distance'] === 'number'
          ? 1 - (data['_distance'] as number)
          : 1 - idx / Math.max(snapshot.docs.length, 1);

        return {
          id: doc.id,
          content: data.content ?? '',
          documentId: data.documentId ?? '',
          documentName: data.documentName ?? 'Unknown',
          chunkIndex: data.chunkIndex ?? 0,
          score,
          metadata: data.metadata ?? { category: '', confidentiality: 'internal', language: 'en', tokenCount: 0 },
        };
      });
    } catch (error) {
      logger.error('[FirestoreVectorStore] findNearest failed', { error, companyId });
      return [];
    }
  }

  /**
   * Delete all vector chunks associated with a specific document.
   */
  async deleteByDocument(companyId: string, documentId: string): Promise<void> {
    const db = getFirestore();
    const colRef = db.collection(this.collectionPath(companyId));
    const snapshot = await colRef.where('documentId', '==', documentId).get();

    if (snapshot.empty) return;

    const BATCH_SIZE = 400;
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const slice = docs.slice(i, i + BATCH_SIZE);
      for (const doc of slice) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }

    logger.info(
      `[FirestoreVectorStore] Deleted ${docs.length} chunks for document ${documentId} in company ${companyId}`
    );
  }

  /**
   * Return the total number of stored chunks for a company.
   */
  async getChunkCount(companyId: string): Promise<number> {
    const db = getFirestore();
    const snapshot = await db
      .collection(this.collectionPath(companyId))
      .count()
      .get();

    return snapshot.data().count;
  }
}

// Singleton instance
export const firestoreVectorStore = new FirestoreVectorStore();
