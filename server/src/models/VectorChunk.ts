import type { firestore } from 'firebase-admin';

// ── Entity type shared across models ─────────────────────────────────────────

export interface ExtractedEntity {
  type: 'person' | 'organization' | 'date' | 'money' | 'location' | 'product';
  value: string;
  confidence: number;
}

// ── VectorChunk ───────────────────────────────────────────────────────────────
//
// Represents a single text chunk stored in a company's `vectorChunks`
// Firestore sub-collection (path: companies/{companyId}/vectorChunks/{chunkId}).
//
// The `embedding` field is stored as a Firestore VectorValue using
// FieldValue.vector(number[]) from firebase-admin/firestore.
// It is typed as `unknown` here because FirebaseFirestore.VectorValue is an
// opaque type that should not be serialised back to plain JSON.

export interface VectorChunk {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  chunkIndex: number;

  /**
   * The embedding vector.
   * Stored in Firestore as a VectorValue (FieldValue.vector(number[])).
   * Use FirestoreVectorStore.findNearest() to query this field.
   */
  embedding?: unknown;

  metadata: {
    /** Document classification category (e.g. "contract", "invoice") */
    category: string;
    /** Owning department, if detectable */
    department?: string;
    /** Access confidentiality level */
    confidentiality: 'public' | 'internal' | 'confidential' | 'secret';
    /** Named entities extracted from this chunk */
    entities: ExtractedEntity[];
    /** BCP-47 language code */
    language: string;
    /** Source page number (for PDFs) */
    pageNumber?: number;
    /** Approximate token count of this chunk */
    tokenCount: number;
    /** Keyword tags from classification */
    tags?: string[];
  };

  createdAt: firestore.Timestamp;
  updatedAt?: firestore.Timestamp;
}

// ── Scored variant (returned from vector search) ──────────────────────────────

export interface ScoredVectorChunk extends Omit<VectorChunk, 'embedding'> {
  /** Relevance score in the range [0, 1] where 1 is most similar */
  score: number;
}
