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
  const snapshot = await db
    .collection('employees')
    .where('companyId', '==', companyId)
    .orderBy('name', 'asc')
    .get();

  const employees = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  res.json({ success: true, data: employees });
}

// POST /api/faces/employees
export async function createEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) throw new AppError('Not authenticated', 401);
  const companyId = req.user.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const body = req.body as Partial<Employee>;
  if (!body.name?.trim()) throw new AppError('Employee name required', 400);

  const id = generateId();
  const now = new Date();

  const employee: Omit<Employee, 'id'> = {
    companyId,
    name: body.name.trim(),
    role: body.role?.trim() ?? '',
    department: body.department?.trim() ?? '',
    createdAt: now,
    updatedAt: now,
  };

  const db = getFirestore();
  await db.collection('employees').doc(id).set(employee);

  res.status(201).json({ success: true, data: { id, ...employee } });
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
