"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmployees = getEmployees;
exports.createEmployee = createEmployee;
exports.bulkCreateEmployees = bulkCreateEmployees;
exports.updateEmployee = updateEmployee;
exports.deleteEmployee = deleteEmployee;
exports.uploadEmployeePhoto = uploadEmployeePhoto;
exports.saveEmployeeDescriptor = saveEmployeeDescriptor;
exports.getVisionSettings = getVisionSettings;
exports.saveVisionSettings = saveVisionSettings;
exports.enrollEmployeeFace = enrollEmployeeFace;
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const helpers_1 = require("../utils/helpers");
const firestore_1 = require("firebase-admin/firestore");
const logger_1 = require("../utils/logger");
// GET /api/faces/employees
async function getEmployees(req, res) {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    // Composite index (companyId + name ASC) may not exist yet — fall back to
    // simple where + JS sort to avoid 500s on fresh deploys.
    let docs = [];
    try {
        const snapshot = await db
            .collection('employees')
            .where('companyId', '==', companyId)
            .orderBy('name', 'asc')
            .get();
        docs = snapshot.docs;
    }
    catch (err) {
        const snapshot = await db
            .collection('employees')
            .where('companyId', '==', companyId)
            .get()
            .catch(() => null);
        if (!snapshot) {
            res.json({ success: true, data: [] });
            return;
        }
        docs = [...snapshot.docs].sort((a, b) => String(a.data().name ?? '').localeCompare(String(b.data().name ?? '')));
    }
    const employees = docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, data: employees });
}
// Internal helper — shared by single and bulk create. Persists one employee to Firestore.
async function writeEmployee(companyId, body) {
    const name = body.name?.trim();
    if (!name || name.length < 2) {
        throw new error_middleware_1.AppError('Employee name required (min 2 chars)', 400);
    }
    const id = (0, helpers_1.generateId)();
    const now = new Date();
    const employee = {
        companyId,
        name,
        role: body.role?.trim() ?? '',
        department: body.department?.trim() ?? '',
        phone: body.phone?.trim() ?? '',
        email: body.email?.trim() ?? '',
        createdAt: now,
        updatedAt: now,
    };
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('employees').doc(id).set(employee);
    return { id, employee };
}
// POST /api/faces/employees
async function createEmployee(req, res) {
    if (!req.user)
        throw new error_middleware_1.AppError('Not authenticated', 401);
    const companyId = req.user.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const { id, employee } = await writeEmployee(companyId, body);
    res.status(201).json({ success: true, data: { id, ...employee } });
}
// POST /api/faces/employees/bulk
// Body: { employees: Array<{ name, role?, department?, phone?, email? }> }
// Returns: { created, failed: [{ row, name, reason }], total }
async function bulkCreateEmployees(req, res) {
    if (!req.user)
        throw new error_middleware_1.AppError('Not authenticated', 401);
    const companyId = req.user.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const list = Array.isArray(body.employees) ? body.employees : [];
    if (list.length === 0)
        throw new error_middleware_1.AppError('employees array required', 400);
    const MAX = 200;
    if (list.length > MAX) {
        throw new error_middleware_1.AppError(`Too many employees (max ${MAX} per call)`, 400);
    }
    const total = list.length;
    // Validate first (cheap), then run inserts in parallel via Promise.allSettled.
    const results = await Promise.allSettled(list.map(async (entry, idx) => {
        const name = entry?.name?.trim() ?? '';
        if (name.length < 2) {
            throw new error_middleware_1.AppError(`Row ${idx + 1}: name must be at least 2 chars`, 400);
        }
        return writeEmployee(companyId, {
            name,
            role: entry?.role?.trim() ?? '',
            department: entry?.department?.trim() ?? '',
            phone: entry?.phone?.trim() ?? '',
            email: entry?.email?.trim() ?? '',
        });
    }));
    let created = 0;
    const failed = [];
    results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
            created += 1;
        }
        else {
            const reason = r.reason instanceof error_middleware_1.AppError ? r.reason.message
                : r.reason instanceof Error ? r.reason.message
                    : 'Unknown error';
            failed.push({
                row: idx + 1,
                name: list[idx]?.name?.trim() ?? '',
                reason,
            });
        }
    });
    logger_1.logger.info(`[FacesController] Bulk import: ${created}/${total} created, ${failed.length} failed`);
    res.status(201).json({ success: true, data: { created, failed, total } });
}
// PUT /api/faces/employees/:id
async function updateEmployee(req, res) {
    const { id } = req.params;
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('employees').doc(id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Employee not found', 404);
    const body = req.body;
    const updates = {
        ...(body.name && { name: body.name.trim() }),
        ...(body.role !== undefined && { role: body.role.trim() }),
        ...(body.department !== undefined && { department: body.department.trim() }),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    await db.collection('employees').doc(id).update(updates);
    res.json({ success: true, data: { id, ...doc.data(), ...updates } });
}
// DELETE /api/faces/employees/:id
async function deleteEmployee(req, res) {
    const { id } = req.params;
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('employees').doc(id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Employee not found', 404);
    await db.collection('employees').doc(id).delete();
    res.json({ success: true, message: 'Employee deleted' });
}
// POST /api/faces/employees/:id/photo
// Upload photo to Firebase Storage, update photoURL in Firestore
async function uploadEmployeePhoto(req, res) {
    if (!req.user)
        throw new error_middleware_1.AppError('Not authenticated', 401);
    const { id } = req.params;
    const file = req.file;
    if (!file)
        throw new error_middleware_1.AppError('No image file uploaded', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('employees').doc(id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Employee not found', 404);
    const employee = doc.data();
    // Upload to Firebase Storage
    const storage = (0, firebase_config_1.getStorage)();
    const bucket = storage.bucket();
    const filename = `employees/${employee.companyId}/${id}/${(0, helpers_1.sanitizeFilename)(file.originalname)}`;
    const fileRef = bucket.file(filename);
    await fileRef.save(file.buffer, {
        metadata: { contentType: file.mimetype },
    });
    await fileRef.makePublic();
    const photoURL = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    await db.collection('employees').doc(id).update({
        photoURL,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    logger_1.logger.info(`[FacesController] Photo uploaded for employee ${id}`);
    res.json({ success: true, data: { photoURL } });
}
// POST /api/faces/employees/:id/descriptor
// Receives face descriptor (Float32Array as plain number[]) computed client-side
async function saveEmployeeDescriptor(req, res) {
    const { id } = req.params;
    const body = req.body;
    if (!body.descriptor || !Array.isArray(body.descriptor)) {
        throw new error_middleware_1.AppError('Face descriptor array required', 400);
    }
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('employees').doc(id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Employee not found', 404);
    await db.collection('employees').doc(id).update({
        faceDescriptor: body.descriptor,
        enrolledAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    logger_1.logger.info(`[FacesController] Face descriptor saved for employee ${id} (${body.descriptor.length} dims)`);
    res.json({ success: true, message: 'Face descriptor saved' });
}
const DEFAULT_VISION_SETTINGS = {
    confidenceThreshold: 0.7,
    notifyOnRecognition: true,
    photoRetentionDays: 365,
    allowExternalApi: false,
};
// GET /api/faces/settings
async function getVisionSettings(req, res) {
    if (!req.user)
        throw new error_middleware_1.AppError('Not authenticated', 401);
    const companyId = req.user.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db
        .collection('companies').doc(companyId)
        .collection('settings').doc('vision')
        .get();
    if (!doc.exists) {
        res.json({ success: true, data: DEFAULT_VISION_SETTINGS });
        return;
    }
    const data = doc.data();
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
async function saveVisionSettings(req, res) {
    if (!req.user)
        throw new error_middleware_1.AppError('Not authenticated', 401);
    const companyId = req.user.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    // Clamp + validate
    const confidence = Math.max(0.5, Math.min(0.95, typeof body.confidenceThreshold === 'number' ? body.confidenceThreshold : DEFAULT_VISION_SETTINGS.confidenceThreshold));
    const retention = [30, 90, 365, 0].includes(body.photoRetentionDays)
        ? body.photoRetentionDays
        : DEFAULT_VISION_SETTINGS.photoRetentionDays;
    const next = {
        confidenceThreshold: confidence,
        notifyOnRecognition: typeof body.notifyOnRecognition === 'boolean' ? body.notifyOnRecognition : DEFAULT_VISION_SETTINGS.notifyOnRecognition,
        photoRetentionDays: retention,
        allowExternalApi: typeof body.allowExternalApi === 'boolean' ? body.allowExternalApi : DEFAULT_VISION_SETTINGS.allowExternalApi,
    };
    const db = (0, firebase_config_1.getFirestore)();
    await db
        .collection('companies').doc(companyId)
        .collection('settings').doc('vision')
        .set({ ...next, updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
    logger_1.logger.info(`[FacesController] Vision settings saved for company ${companyId}`);
    res.json({ success: true, data: next });
}
// POST /api/faces/employees/:id/enroll
// Unified enroll endpoint: receives photo as base64 + face descriptor in one shot.
// Body: { photoBase64: string, photoMimeType: string, faceDescriptor: number[] }
async function enrollEmployeeFace(req, res) {
    if (!req.user)
        throw new error_middleware_1.AppError('Not authenticated', 401);
    const { id } = req.params;
    const body = req.body;
    if (!body.photoBase64 || typeof body.photoBase64 !== 'string') {
        throw new error_middleware_1.AppError('photoBase64 required', 400);
    }
    if (!Array.isArray(body.faceDescriptor) || body.faceDescriptor.length === 0) {
        throw new error_middleware_1.AppError('faceDescriptor required', 400);
    }
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('employees').doc(id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Employee not found', 404);
    const employee = doc.data();
    const mimeType = body.photoMimeType || 'image/jpeg';
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    // Strip any "data:image/...;base64," prefix just in case.
    const rawBase64 = body.photoBase64.replace(/^data:image\/[^;]+;base64,/, '');
    const buffer = Buffer.from(rawBase64, 'base64');
    const storage = (0, firebase_config_1.getStorage)();
    const bucket = storage.bucket();
    const filename = `employees/${employee.companyId}/${id}/enroll-${Date.now()}.${ext}`;
    const fileRef = bucket.file(filename);
    await fileRef.save(buffer, { metadata: { contentType: mimeType } });
    await fileRef.makePublic();
    const photoURL = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    await db.collection('employees').doc(id).update({
        photoURL,
        faceDescriptor: body.faceDescriptor,
        enrolledAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    logger_1.logger.info(`[FacesController] Unified enroll done for ${id} (${body.faceDescriptor.length} dims)`);
    res.json({ success: true, data: { photoURL } });
}
//# sourceMappingURL=faces.controller.js.map