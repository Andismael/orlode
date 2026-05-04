"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.multiFileUpload = exports.singleFileUpload = exports.uploadMiddleware = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const helpers_1 = require("../utils/helpers");
const UPLOAD_DIR = path_1.default.resolve(__dirname, '../../uploads');
if (!fs_1.default.existsSync(UPLOAD_DIR)) {
    fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'text/plain',
    'text/tab-separated-values',
]);
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        const base = (0, helpers_1.sanitizeFilename)(file.originalname.replace(ext, ''));
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        cb(null, `${base}-${unique}${ext}`);
    },
});
function fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error(`File type '${file.mimetype}' is not supported. Allowed: PDF, DOCX, XLSX, CSV, TXT`));
    }
}
exports.uploadMiddleware = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 10,
    },
});
exports.singleFileUpload = exports.uploadMiddleware.single('file');
exports.multiFileUpload = exports.uploadMiddleware.array('files', 10);
//# sourceMappingURL=upload.middleware.js.map