"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.singleMediaUpload = exports.mediaUploadMiddleware = void 0;
/**
 * Media upload middleware — for marketplace agent covers, screenshots, demo
 * videos, and 3D models. Stored in memory then streamed to Firebase Storage.
 */
const multer_1 = __importDefault(require("multer"));
const ALLOWED_MIME = new Set([
    // Images
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
    // Videos
    'video/mp4',
    'video/webm',
    'video/quicktime',
    // 3D
    'model/gltf-binary',
    'model/gltf+json',
    'application/octet-stream', // glb sometimes lands as octet-stream
]);
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB max
function fileFilter(_req, file, cb) {
    // Accept by extension when MIME is generic
    const ext = (file.originalname.split('.').pop() ?? '').toLowerCase();
    const ok = ALLOWED_MIME.has(file.mimetype) || ['glb', 'gltf', 'obj'].includes(ext);
    if (ok)
        cb(null, true);
    else
        cb(new Error(`Format '${file.mimetype}' non supporté. Accepté : PNG, JPG, WEBP, MP4, WEBM, GLB.`));
}
exports.mediaUploadMiddleware = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});
exports.singleMediaUpload = exports.mediaUploadMiddleware.single('file');
//# sourceMappingURL=mediaUpload.middleware.js.map