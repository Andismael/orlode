import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../utils/asyncHandler';
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  uploadEmployeePhoto,
  saveEmployeeDescriptor,
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

router.get('/employees',         asyncHandler(getEmployees));
router.post('/employees',        asyncHandler(createEmployee));
router.put('/employees/:id',     asyncHandler(updateEmployee));
router.delete('/employees/:id',  asyncHandler(deleteEmployee));

// Upload photo → store in Firebase Storage → return URL
router.post('/employees/:id/photo', upload.single('photo'), asyncHandler(uploadEmployeePhoto));

// Save face descriptor (computed client-side by face-api.js)
router.post('/employees/:id/descriptor', asyncHandler(saveEmployeeDescriptor));

export default router;
