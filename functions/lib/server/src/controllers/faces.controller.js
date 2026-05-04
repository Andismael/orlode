"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmployees = getEmployees;
exports.createEmployee = createEmployee;
exports.updateEmployee = updateEmployee;
exports.deleteEmployee = deleteEmployee;
exports.uploadEmployeePhoto = uploadEmployeePhoto;
exports.saveEmployeeDescriptor = saveEmployeeDescriptor;
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
    const snapshot = await db
        .collection('employees')
        .where('companyId', '==', companyId)
        .orderBy('name', 'asc')
        .get();
    const employees = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, data: employees });
}
// POST /api/faces/employees
async function createEmployee(req, res) {
    if (!req.user)
        throw new error_middleware_1.AppError('Not authenticated', 401);
    const companyId = req.user.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    if (!body.name?.trim())
        throw new error_middleware_1.AppError('Employee name required', 400);
    const id = (0, helpers_1.generateId)();
    const now = new Date();
    const employee = {
        companyId,
        name: body.name.trim(),
        role: body.role?.trim() ?? '',
        department: body.department?.trim() ?? '',
        createdAt: now,
        updatedAt: now,
    };
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('employees').doc(id).set(employee);
    res.status(201).json({ success: true, data: { id, ...employee } });
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
//# sourceMappingURL=faces.controller.js.map