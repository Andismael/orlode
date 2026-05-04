"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const asyncHandler_1 = require("../utils/asyncHandler");
const faces_controller_1 = require("../controllers/faces.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/'))
            cb(null, true);
        else
            cb(new Error('Only image files are allowed'));
    },
});
router.use(auth_middleware_1.authMiddleware);
router.get('/employees', (0, asyncHandler_1.asyncHandler)(faces_controller_1.getEmployees));
router.post('/employees', (0, asyncHandler_1.asyncHandler)(faces_controller_1.createEmployee));
router.put('/employees/:id', (0, asyncHandler_1.asyncHandler)(faces_controller_1.updateEmployee));
router.delete('/employees/:id', (0, asyncHandler_1.asyncHandler)(faces_controller_1.deleteEmployee));
// Upload photo → store in Firebase Storage → return URL
router.post('/employees/:id/photo', upload.single('photo'), (0, asyncHandler_1.asyncHandler)(faces_controller_1.uploadEmployeePhoto));
// Save face descriptor (computed client-side by face-api.js)
router.post('/employees/:id/descriptor', (0, asyncHandler_1.asyncHandler)(faces_controller_1.saveEmployeeDescriptor));
exports.default = router;
//# sourceMappingURL=faces.routes.js.map