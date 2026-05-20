import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../utils/asyncHandler';
import {
  getEmployees,
  createEmployee,
  bulkCreateEmployees,
  updateEmployee,
  deleteEmployee,
  uploadEmployeePhoto,
  saveEmployeeDescriptor,
  enrollEmployeeFace,
  getVisionSettings,
  saveVisionSettings,
} from '../controllers/faces.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.use(authMiddleware);

// Vision settings (per-company)
router.get('/settings',          asyncHandler(getVisionSettings));
router.post('/settings',         asyncHandler(saveVisionSettings));

router.get('/employees',         asyncHandler(getEmployees));
router.post('/employees',        asyncHandler(createEmployee));
router.post('/employees/bulk',   asyncHandler(bulkCreateEmployees));
router.put('/employees/:id',     asyncHandler(updateEmployee));
router.delete('/employees/:id',  asyncHandler(deleteEmployee));

// Upload photo → store in Firebase Storage → return URL
router.post('/employees/:id/photo', upload.single('photo'), asyncHandler(uploadEmployeePhoto));

// Save face descriptor (computed client-side by face-api.js)
router.post('/employees/:id/descriptor', asyncHandler(saveEmployeeDescriptor));

// Unified enroll: photo (base64) + descriptor in one shot. Used by bulk enrollment.
// Body: { photoBase64, photoMimeType, faceDescriptor }
// Global express.json() limit is 10mb — sufficient for typical enrollment photos.
router.post('/employees/:id/enroll', asyncHandler(enrollEmployeeFace));

export default router;
