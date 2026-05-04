"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappAdapter = exports.getAdapter = exports.handleMessage = void 0;
var MessagingOrchestrator_1 = require("./MessagingOrchestrator");
Object.defineProperty(exports, "handleMessage", { enumerable: true, get: function () { return MessagingOrchestrator_1.handleMessage; } });
Object.defineProperty(exports, "getAdapter", { enumerable: true, get: function () { return MessagingOrchestrator_1.getAdapter; } });
var whatsapp_1 = require("./adapters/whatsapp");
Object.defineProperty(exports, "whatsappAdapter", { enumerable: true, get: function () { return whatsapp_1.whatsappAdapter; } });
//# sourceMappingURL=index.js.map