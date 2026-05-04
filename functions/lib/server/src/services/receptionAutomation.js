"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onVIPVisitorArrived = onVIPVisitorArrived;
exports.notifyHostVisitorArrived = notifyHostVisitorArrived;
exports.flagSuspiciousVisitor = flagSuspiciousVisitor;
exports.onDeliveryReceived = onDeliveryReceived;
/**
 * Reception Automation — Cross-Agent Linking
 *
 * VIP visitor → CRM lead (Sales)
 * Delivery → Accounting notification
 * Suspicious visitor → Security incident
 * Host notification → real-time push
 */
const firebase_config_1 = require("../config/firebase.config");
const helpers_1 = require("../utils/helpers");
const notificationService_1 = require("./notificationService");
const logger_1 = require("../utils/logger");
/** Reception → Sales: VIP visitor auto-creates CRM lead */
async function onVIPVisitorArrived(companyId, visitor) {
    const db = (0, firebase_config_1.getFirestore)();
    // Check if lead already exists
    if (visitor.email) {
        const existing = await db.collection(`companies/${companyId}/leads`).where('email', '==', visitor.email).limit(1).get();
        if (!existing.empty)
            return;
    }
    const id = (0, helpers_1.generateId)();
    await db.collection(`companies/${companyId}/leads`).doc(id).set({
        id, name: visitor.name, email: visitor.email ?? '', company: visitor.company ?? '',
        source: 'visitor_vip', status: 'new', score: 60,
        notes: `VIP visiteur arrive — hote: ${visitor.host}. Motif: ${visitor.purpose ?? 'non specifie'}`,
        assignedTo: null, createdAt: new Date(), updatedAt: new Date(),
    });
    logger_1.logger.info(`[ReceptionAutomation] VIP visitor ${visitor.name} → CRM lead ${id}`);
}
/** Reception → Host: notify host when visitor arrives */
async function notifyHostVisitorArrived(companyId, hostName, visitorName, visitorCompany, badgeNumber) {
    const db = (0, firebase_config_1.getFirestore)();
    // Find host user
    const snap = await db.collection('users').where('companyId', '==', companyId).limit(200).get();
    const host = snap.docs.find(d => {
        const name = (d.data()['displayName'] ?? '').toLowerCase();
        return name.includes(hostName.toLowerCase()) || hostName.toLowerCase().includes(name);
    });
    if (host) {
        (0, notificationService_1.createNotification)({
            companyId, userId: host.id, type: 'visitor_arrived',
            title: `Visiteur arrive: ${visitorName}`,
            message: `${visitorName}${visitorCompany ? ` (${visitorCompany})` : ''} est arrive a la reception. Badge: ${badgeNumber}.`,
            actionUrl: '/reception/visitors', icon: 'UserCheck', severity: 'info',
        }).catch(() => { });
    }
    logger_1.logger.info(`[ReceptionAutomation] Host ${hostName} notified: visitor ${visitorName}`);
}
/** Reception → Security: flag suspicious visitor */
async function flagSuspiciousVisitor(companyId, visitor) {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    await db.collection(`companies/${companyId}/securityIncidents`).doc(id).set({
        id, type: 'unauthorized_access', priority: 'P3_medium', status: 'detected',
        description: `Visiteur suspect signale a la reception: ${visitor.name}. Raison: ${visitor.reason}`,
        source: 'reception', affectedSystems: ['Reception'],
        detectedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    });
    // Notify security admins
    const admins = await db.collection('users').where('companyId', '==', companyId).where('role', 'in', ['admin', 'superadmin']).limit(10).get();
    for (const admin of admins.docs) {
        (0, notificationService_1.createNotification)({
            companyId, userId: admin.id, type: 'security_alert',
            title: 'Visiteur suspect',
            message: `${visitor.name}: ${visitor.reason}`,
            actionUrl: '/security/incidents', icon: 'ShieldAlert', severity: 'warning',
        }).catch(() => { });
    }
    logger_1.logger.info(`[ReceptionAutomation] Suspicious visitor ${visitor.name} → security incident ${id}`);
}
/** Reception → Accounting: notify delivery for invoice matching */
async function onDeliveryReceived(companyId, delivery) {
    (0, notificationService_1.createNotification)({
        companyId, type: 'system',
        title: `Livraison recue: ${delivery.carrier}`,
        message: `${delivery.itemCount} colis pour ${delivery.recipientName}.${delivery.trackingNumber ? ` Tracking: ${delivery.trackingNumber}` : ''}`,
        actionUrl: '/reception/deliveries', icon: 'Package', severity: 'info',
    }).catch(() => { });
    logger_1.logger.info(`[ReceptionAutomation] Delivery notification: ${delivery.carrier} → ${delivery.recipientName}`);
}
//# sourceMappingURL=receptionAutomation.js.map