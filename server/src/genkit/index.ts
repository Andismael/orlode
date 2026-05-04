/**
 * Orlode AI — Genkit flows registry
 *
 * Importing this module registers all flows with the Genkit runtime so they
 * can be discovered by the Genkit Dev UI and invoked programmatically.
 */

export { ingestDocumentFlow } from './flows/ingestDocumentFlow';
export type { IngestDocumentInput, IngestDocumentOutput } from './flows/ingestDocumentFlow';

export { ragRetrievalFlow } from './flows/ragRetrievalFlow';
export type { RAGRetrievalInput, RAGRetrievalOutput, RetrievedChunk } from './flows/ragRetrievalFlow';

export { meetingAnalysisFlow } from './flows/meetingAnalysisFlow';
export type { MeetingAnalysisInput, MeetingAnalysisOutput } from './flows/meetingAnalysisFlow';

export { documentClassifyFlow } from './flows/documentClassifyFlow';
export type { DocumentClassifyInput, DocumentClassifyOutput } from './flows/documentClassifyFlow';

export { ocrExtractionFlow } from './flows/ocrExtractionFlow';
export type { OCRExtractionInput, OCRExtractionOutput } from './flows/ocrExtractionFlow';

export { insightGenerationFlow } from './flows/insightGenerationFlow';
export type { InsightGenerationInput, InsightGenerationOutput } from './flows/insightGenerationFlow';

export { commercialAgentFlow } from '../agents/commercial/commercialAgent';
