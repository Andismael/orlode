import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getFirestore, getStorage } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { generateId, sanitizeFilename } from '../utils/helpers';
import { FieldValue } from 'firebase-admin/firestore';
import admin from 'firebase-admin';
import { logger } from '../utils/logger';

export interface Employee {
  id: string;
  companyId: string;
  name: string;
  role: string;
  department: string;
  phone?: string;
  email?: string;
  photoURL?: string;
  faceDescriptor?: number[]; // Float32Array serialized as plain array
  enrolledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// GET /api/faces/employees
export async function getEmployees(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  // Composite index (companyId + name ASC) may not exist yet — fall back to
  // simple where + JS sort to avoid 500s on fresh deploys.
  let docs: Array<{ id: string; data: () => Record<string, unknown> }> = [];
  try {
    const snapshot = await db
      .collection('employees')
      .where('companyId', '==', companyId)
      .orderBy('name', 'asc')
      .get();
    docs = snapshot.docs;
  } catch (err) {
    const snapshot = await db
      .collection('employees')
      .where('companyId', '==', companyId)
      .get()
      .catch(() => null);
    if (!snapshot) { res.json({ success: true, data: [] }); return; }
    docs = [...snapshot.docs].sort((a, b) =>
      String((a.data() as { name?: string }).name ?? '').localeCompare(
        String((b.data() as { name?: string }).name ?? ''),
      ),
    );
  }
  const employees = docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  res.json({ success: true, data: employees });
}

// Internal helper — shared by single and bulk create. Persists one employee to Firestore.
async function writeEmployee(
  companyId: string,
  body: Partial<Employee> & { phone?: string; email?: string },
): Promise<{ id: string; employee: Record<string, unknown> }> {
  const name = body.name?.trim();
  if (!name || name.length < 2) {
    throw new AppError('Employee name required (min 2 chars)', 400);
  }

  const id = generateId();
  const now = new Date();

  const employee: Record<string, unknown> = {
    companyId,
    name,
    role: body.role?.trim() ?? '',
    department: body.department?.trim() ?? '',
    phone: body.phone?.trim() ?? '',
    email: body.email?.trim() ?? '',
    createdAt: now,
    updatedAt: now,
  };

  const db = getFirestore();
  await db.collection('employees').doc(id).set(employee);

  return { id, employee };
}

// POST /api/faces/employees
export async function createEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) throw new AppError('Not authenticated', 401);
  const companyId = req.user.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const body = req.body as Partial<Employee> & { phone?: string; email?: string };
  const { id, employee } = await writeEmployee(companyId, body);

  res.status(201).json({ success: true, data: { id, ...employee } });
}

// POST /api/faces/employees/bulk
// Body: { employees: Array<{ name, role?, department?, phone?, email? }> }
// Returns: { created, failed: [{ row, name, reason }], total }
export async function bulkCreateEmployees(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError('Not authenticated', 401);
  const companyId = req.user.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const body = req.body as {
    employees?: Array<{ name?: string; role?: string; department?: string; phone?: string; email?: string }>;
  };
  const list = Array.isArray(body.employees) ? body.employees : [];
  if (list.length === 0) throw new AppError('employees array required', 400);

  const MAX = 200;
  if (list.length > MAX) {
    throw new AppError(`Too many employees (max ${MAX} per call)`, 400);
  }

  const total = list.length;

  // Validate first (cheap), then run inserts in parallel via Promise.allSettled.
  const results = await Promise.allSettled(
    list.map(async (entry, idx) => {
      const name = entry?.name?.trim() ?? '';
      if (name.length < 2) {
        throw new AppError(`Row ${idx + 1}: name must be at least 2 chars`, 400);
      }
      return writeEmployee(companyId, {
        name,
        role: entry?.role?.trim() ?? '',
        department: entry?.department?.trim() ?? '',
        phone: entry?.phone?.trim() ?? '',
        email: entry?.email?.trim() ?? '',
      });
    }),
  );

  let created = 0;
  const failed: Array<{ row: number; name: string; reason: string }> = [];
  results.forEach((r, idx) => {
    if (r.status === 'fulfilled') {
      created += 1;
    } else {
      const reason =
        r.reason instanceof AppError ? r.reason.message
        : r.reason instanceof Error  ? r.reason.message
        : 'Unknown error';
      failed.push({
        row: idx + 1,
        name: list[idx]?.name?.trim() ?? '',
        reason,
      });
    }
  });

  logger.info(`[FacesController] Bulk import: ${created}/${total} created, ${failed.length} failed`);
  res.status(201).json({ success: true, data: { created, failed, total } });
}

// PUT /api/faces/employees/:id
export async function updateEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const db = getFirestore();

  const doc = await db.collection('employees').doc(id).get();
  if (!doc.exists) throw new AppError('Employee not found', 404);

  const body = req.body as Partial<Employee>;
  const updates: Record<string, unknown> = {
    ...(body.name && { name: body.name.trim() }),
    ...(body.role !== undefined && { role: body.role.trim() }),
    ...(body.department !== undefined && { department: body.department.trim() }),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.collection('employees').doc(id).update(updates as admin.firestore.UpdateData<Employee>);
  res.json({ success: true, data: { id, ...doc.data(), ...updates } });
}

// DELETE /api/faces/employees/:id
export async function deleteEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const db = getFirestore();

  const doc = await db.collection('employees').doc(id).get();
  if (!doc.exists) throw new AppError('Employee not found', 404);

  await db.collection('employees').doc(id).delete();
  res.json({ success: true, message: 'Employee deleted' });
}

// POST /api/faces/employees/:id/photo
// Upload photo to Firebase Storage, update photoURL in Firestore
export async function uploadEmployeePhoto(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) throw new AppError('Not authenticated', 401);

  const { id } = req.params as { id: string };
  const file = (req as unknown as { file?: Express.Multer.File }).file;
  if (!file) throw new AppError('No image file uploaded', 400);

  const db = getFirestore();
  const doc = await db.collection('employees').doc(id).get();
  if (!doc.exists) throw new AppError('Employee not found', 404);

  const employee = doc.data() as Employee;

  // Upload to Firebase Storage
  const storage = getStorage();
  const bucket = storage.bucket();
  const filename = `employees/${employee.companyId}/${id}/${sanitizeFilename(file.originalname)}`;
  const fileRef = bucket.file(filename);

  await fileRef.save(file.buffer, {
    metadata: { contentType: file.mimetype },
  });

  await fileRef.makePublic();
  const photoURL = `https://storage.googleapis.com/${bucket.name}/${filename}`;

  await db.collection('employees').doc(id).update({
    photoURL,
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info(`[FacesController] Photo uploaded for employee ${id}`);
  res.json({ success: true, data: { photoURL } });
}

// POST /api/faces/employees/:id/descriptor
// Receives face descriptor (Float32Array as plain number[]) computed client-side
export async function saveEmployeeDescriptor(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const body = req.body as { descriptor: number[] };

  if (!body.descriptor || !Array.isArray(body.descriptor)) {
    throw new AppError('Face descriptor array required', 400);
  }

  const db = getFirestore();
  const doc = await db.collection('employees').doc(id).get();
  if (!doc.exists) throw new AppError('Employee not found', 404);

  await db.collection('employees').doc(id).update({
    faceDescriptor: body.descriptor,
    enrolledAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info(`[FacesController] Face descriptor saved for employee ${id} (${body.descriptor.length} dims)`);
  res.json({ success: true, message: 'Face descriptor saved' });
}

// ── Vision settings (per-company) ─────────────────────────────────────────
export interface VisionSettings {
  confidenceThreshold: number;     // 0.5 → 0.95
  notifyOnRecognition: boolean;
  photoRetentionDays: number;      // 30, 90, 365, 0 (= unlimited)
  allowExternalApi: boolean;
}

const DEFAULT_VISION_SETTINGS: VisionSettings = {
  confidenceThreshold: 0.7,
  notifyOnRecognition: true,
  photoRetentionDays: 365,
  allowExternalApi: false,
};

// GET /api/faces/settings
export async function getVisionSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) throw new AppError('Not authenticated', 401);
  const companyId = req.user.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  const doc = await db
    .collection('companies').doc(companyId)
    .collection('settings').doc('vision')
    .get();

  if (!doc.exists) {
    res.json({ success: true, data: DEFAULT_VISION_SETTINGS });
    return;
  }
  const data = doc.data() as Partial<VisionSettings>;
  res.json({
    success: true,
    data: {
      confidenceThreshold: typeof data.confidenceThreshold === 'number'
        ? data.confidenceThreshold : DEFAULT_VISION_SETTINGS.confidenceThreshold,
      notifyOnRecognition: typeof data.notifyOnRecognition === 'boolean'
        ? data.notifyOnRecognition : DEFAULT_VISION_SETTINGS.notifyOnRecognition,
      photoRetentionDays: typeof data.photoRetentionDays === 'number'
        ? data.photoRetentionDays : DEFAULT_VISION_SETTINGS.photoRetentionDays,
      allowExternalApi: typeof data.allowExternalApi === 'boolean'
        ? data.allowExternalApi : DEFAULT_VISION_SETTINGS.allowExternalApi,
    },
  });
}

// POST /api/faces/settings
export async function saveVisionSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) throw new AppError('Not authenticated', 401);
  const companyId = req.user.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const body = req.body as Partial<VisionSettings>;

  // Clamp + validate
  const confidence = Math.max(0.5, Math.min(0.95,
    typeof body.confidenceThreshold === 'number' ? body.confidenceThreshold : DEFAULT_VISION_SETTINGS.confidenceThreshold,
  ));
  const retention = [30, 90, 365, 0].includes(body.photoRetentionDays as number)
    ? (body.photoRetentionDays as number)
    : DEFAULT_VISION_SETTINGS.photoRetentionDays;

  const next: VisionSettings = {
    confidenceThreshold: confidence,
    notifyOnRecognition: typeof body.notifyOnRecognition === 'boolean' ? body.notifyOnRecognition : DEFAULT_VISION_SETTINGS.notifyOnRecognition,
    photoRetentionDays: retention,
    allowExternalApi: typeof body.allowExternalApi === 'boolean' ? body.allowExternalApi : DEFAULT_VISION_SETTINGS.allowExternalApi,
  };

  const db = getFirestore();
  await db
    .collection('companies').doc(companyId)
    .collection('settings').doc('vision')
    .set({ ...next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  logger.info(`[FacesController] Vision settings saved for company ${companyId}`);
  res.json({ success: true, data: next });
}

// POST /api/faces/employees/:id/enroll
// Unified enroll endpoint: receives photo as base64 + face descriptor in one shot.
// Body: { photoBase64: string, photoMimeType: string, faceDescriptor: number[] }
export async function enrollEmployeeFace(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) throw new AppError('Not authenticated', 401);
  const { id } = req.params as { id: string };
  const body = req.body as {
    photoBase64?: string;
    photoMimeType?: string;
    faceDescriptor?: number[];
  };

  if (!body.photoBase64 || typeof body.photoBase64 !== 'string') {
    throw new AppError('photoBase64 required', 400);
  }
  if (!Array.isArray(body.faceDescriptor) || body.faceDescriptor.length === 0) {
    throw new AppError('faceDescriptor required', 400);
  }

  const db = getFirestore();
  const doc = await db.collection('employees').doc(id).get();
  if (!doc.exists) throw new AppError('Employee not found', 404);

  const employee = doc.data() as Employee;
  const mimeType = body.photoMimeType || 'image/jpeg';
  const ext = mimeType.includes('png') ? 'png' : 'jpg';

  // Strip any "data:image/...;base64," prefix just in case.
  const rawBase64 = body.photoBase64.replace(/^data:image\/[^;]+;base64,/, '');
  const buffer = Buffer.from(rawBase64, 'base64');

  const storage = getStorage();
  const bucket = storage.bucket();
  const filename = `employees/${employee.companyId}/${id}/enroll-${Date.now()}.${ext}`;
  const fileRef = bucket.file(filename);

  await fileRef.save(buffer, { metadata: { contentType: mimeType } });
  await fileRef.makePublic();
  const photoURL = `https://storage.googleapis.com/${bucket.name}/${filename}`;

  await db.collection('employees').doc(id).update({
    photoURL,
    faceDescriptor: body.faceDescriptor,
    enrolledAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info(`[FacesController] Unified enroll done for ${id} (${body.faceDescriptor.length} dims)`);
  res.json({ success: true, data: { photoURL } });
}
