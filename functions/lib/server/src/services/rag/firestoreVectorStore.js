"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.firestoreVectorStore = exports.FirestoreVectorStore = void 0;
const firestore_1 = require("firebase-admin/firestore");
const firebase_config_1 = require("../../config/firebase.config");
const logger_1 = require("../../utils/logger");
// ── FirestoreVectorStore ─────────────────────────────────────────────────────
class FirestoreVectorStore {
    collectionPath(companyId) {
        return `companies/${companyId}/vectorChunks`;
    }
    /**
     * Upsert a chunk with its embedding vector into Firestore.
     */
    async upsertChunk(companyId, chunkId, chunk, embedding) {
        const db = (0, firebase_config_1.getFirestore)();
        const ref = db.collection(this.collectionPath(companyId)).doc(chunkId);
        await ref.set({
            ...chunk,
            embedding: firestore_1.FieldValue.vector(embedding),
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        logger_1.logger.debug(`[FirestoreVectorStore] Upserted chunk ${chunkId} for company ${companyId}`);
    }
    /**
     * Batch-upsert multiple chunks.
     */
    async upsertChunks(companyId, chunks) {
        const db = (0, firebase_config_1.getFirestore)();
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
                    embedding: firestore_1.FieldValue.vector(embedding),
                    createdAt: firestore_1.FieldValue.serverTimestamp(),
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                });
            }
            await batch.commit();
            logger_1.logger.debug(`[FirestoreVectorStore] Batch upserted ${slice.length} chunks (offset ${i})`);
        }
    }
    /**
     * Find nearest chunks using Firestore vector search (findNearest).
     * Requires a vector index on the `embedding` field — see firestore.indexes.json.
     */
    async findNearest(companyId, queryVector, options = {}) {
        const db = (0, firebase_config_1.getFirestore)();
        const { limit = 10, filters = {} } = options;
        try {
            let colRef = db.collection(this.collectionPath(companyId));
            // Apply any equality filters (e.g. category, confidentiality)
            for (const [field, value] of Object.entries(filters)) {
                colRef = colRef.where(`metadata.${field}`, '==', value);
            }
            // Cast to CollectionReference to access findNearest (admin SDK v12+)
            const vectorQuery = db.collection(this.collectionPath(companyId)).findNearest('embedding', firestore_1.FieldValue.vector(queryVector), {
                limit,
                distanceMeasure: 'COSINE',
            });
            const snapshot = await vectorQuery.get();
            return snapshot.docs.map((doc, idx) => {
                const data = doc.data();
                // Firestore does not yet return similarity scores natively in all SDKs;
                // use rank-based score as fallback (1.0 for rank 0)
                const score = typeof data['_distance'] === 'number'
                    ? 1 - data['_distance']
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
        }
        catch (error) {
            logger_1.logger.error('[FirestoreVectorStore] findNearest failed', { error, companyId });
            return [];
        }
    }
    /**
     * Delete all vector chunks associated with a specific document.
     */
    async deleteByDocument(companyId, documentId) {
        const db = (0, firebase_config_1.getFirestore)();
        const colRef = db.collection(this.collectionPath(companyId));
        const snapshot = await colRef.where('documentId', '==', documentId).get();
        if (snapshot.empty)
            return;
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
        logger_1.logger.info(`[FirestoreVectorStore] Deleted ${docs.length} chunks for document ${documentId} in company ${companyId}`);
    }
    /**
     * Return the total number of stored chunks for a company.
     */
    async getChunkCount(companyId) {
        const db = (0, firebase_config_1.getFirestore)();
        const snapshot = await db
            .collection(this.collectionPath(companyId))
            .count()
            .get();
        return snapshot.data().count;
    }
}
exports.FirestoreVectorStore = FirestoreVectorStore;
// Singleton instance
exports.firestoreVectorStore = new FirestoreVectorStore();
//# sourceMappingURL=firestoreVectorStore.js.map