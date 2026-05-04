"use strict";
/**
 * Orlode AI — Genkit flows registry
 *
 * Importing this module registers all flows with the Genkit runtime so they
 * can be discovered by the Genkit Dev UI and invoked programmatically.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.commercialAgentFlow = exports.insightGenerationFlow = exports.ocrExtractionFlow = exports.documentClassifyFlow = exports.meetingAnalysisFlow = exports.ragRetrievalFlow = exports.ingestDocumentFlow = void 0;
var ingestDocumentFlow_1 = require("./flows/ingestDocumentFlow");
Object.defineProperty(exports, "ingestDocumentFlow", { enumerable: true, get: function () { return ingestDocumentFlow_1.ingestDocumentFlow; } });
var ragRetrievalFlow_1 = require("./flows/ragRetrievalFlow");
Object.defineProperty(exports, "ragRetrievalFlow", { enumerable: true, get: function () { return ragRetrievalFlow_1.ragRetrievalFlow; } });
var meetingAnalysisFlow_1 = require("./flows/meetingAnalysisFlow");
Object.defineProperty(exports, "meetingAnalysisFlow", { enumerable: true, get: function () { return meetingAnalysisFlow_1.meetingAnalysisFlow; } });
var documentClassifyFlow_1 = require("./flows/documentClassifyFlow");
Object.defineProperty(exports, "documentClassifyFlow", { enumerable: true, get: function () { return documentClassifyFlow_1.documentClassifyFlow; } });
var ocrExtractionFlow_1 = require("./flows/ocrExtractionFlow");
Object.defineProperty(exports, "ocrExtractionFlow", { enumerable: true, get: function () { return ocrExtractionFlow_1.ocrExtractionFlow; } });
var insightGenerationFlow_1 = require("./flows/insightGenerationFlow");
Object.defineProperty(exports, "insightGenerationFlow", { enumerable: true, get: function () { return insightGenerationFlow_1.insightGenerationFlow; } });
var commercialAgent_1 = require("../agents/commercial/commercialAgent");
Object.defineProperty(exports, "commercialAgentFlow", { enumerable: true, get: function () { return commercialAgent_1.commercialAgentFlow; } });
//# sourceMappingURL=index.js.map