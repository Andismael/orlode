/**
 * Reception Automation — Cross-Agent Linking
 *
 * VIP visitor → CRM lead (Sales)
 * Delivery → Accounting notification
 * Suspicious visitor → Security incident
 * Host notification → real-time push
 */
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateId } from '../utils/helpers';
import { createNotification } from './notificationService';
import { logger } from '../utils/logger';

/** Reception → Sales: VIP visitor auto-creates CRM lead */
export async function onVIPVisitorArrived(companyId: string, visitor: { name: string; email?: string; company?: string; host: string; purpose?: string }) {
  const db = getFirestore();

  // Check if lead already exists
  if (visitor.email) {
    const existing = await db.collection(`companies/${companyId}/leads`).where('email', '==', visitor.email).limit(1).get();
    if (!existing.empty) return;
  }

  const id = generateId();
  await db.collection(`companies/${companyId}/leads`).doc(id).set({
    id, name: visitor.name, email: visitor.email ?? '', company: visitor.company ?? '',
    source: 'visitor_vip', status: 'new', score: 60,
    notes: `VIP visiteur arrive — hote: ${visitor.host}. Motif: ${visitor.purpose ?? 'non specifie'}`,
    assignedTo: null, createdAt: new Date(), updatedAt: new Date(),
  });

  logger.info(`[ReceptionAutomation] VIP visitor ${visitor.name} → CRM lead ${id}`);
}

/** Reception → Host: notify host when visitor arrives */
export async function notifyHostVisitorArrived(companyId: string, hostName: string, visitorName: string, visitorCompany: string, badgeNumber: string) {
  const db = getFirestore();

  // Find host user
  const snap = await db.collection('users').where('companyId', '==', companyId).limit(200).get();
  const host = snap.docs.find(d => {
    const name = ((d.data()['displayName'] as string) ?? '').toLowerCase();
    return name.includes(hostName.toLowerCase()) || hostName.toLowerCase().includes(name);
  });

  if (host) {
    createNotification({
      companyId, userId: host.id, type: 'visitor_arrived',
      title: `Visiteur arrive: ${visitorName}`,
      message: `${visitorName}${visitorCompany ? ` (${visitorCompany})` : ''} est arrive a la reception. Badge: ${badgeNumber}.`,
      actionUrl: '/reception/visitors', icon: 'UserCheck', severity: 'info',
    }).catch(() => {});
  }

  logger.info(`[ReceptionAutomation] Host ${hostName} notified: visitor ${visitorName}`);
}

/** Reception → Security: flag suspicious visitor */
export async function flagSuspiciousVisitor(companyId: string, visitor: { name: string; reason: string }) {
  const db = getFirestore();
  const id = generateId();

  await db.collection(`companies/${companyId}/securityIncidents`).doc(id).set({
    id, type: 'unauthorized_access', priority: 'P3_medium', status: 'detected',
    description: `Visiteur suspect signale a la reception: ${visitor.name}. Raison: ${visitor.reason}`,
    source: 'reception', affectedSystems: ['Reception'],
    detectedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
  });

  // Notify security admins
  const admins = await db.collection('users').where('companyId', '==', companyId).where('role', 'in', ['admin', 'superadmin']).limit(10).get();
  for (const admin of admins.docs) {
    createNotification({
      companyId, userId: admin.id, type: 'security_alert',
      title: 'Visiteur suspect',
      message: `${visitor.name}: ${visitor.reason}`,
      actionUrl: '/security/incidents', icon: 'ShieldAlert', severity: 'warning',
    }).catch(() => {});
  }

  logger.info(`[ReceptionAutomation] Suspicious visitor ${visitor.name} → security incident ${id}`);
}

/** Reception → Accounting: notify delivery for invoice matching */
export async function onDeliveryReceived(companyId: string, delivery: { carrier: string; trackingNumber?: string; recipientName: string; itemCount: number }) {
  createNotification({
    companyId, type: 'system',
    title: `Livraison recue: ${delivery.carrier}`,
    message: `${delivery.itemCount} colis pour ${delivery.recipientName}.${delivery.trackingNumber ? ` Tracking: ${delivery.trackingNumber}` : ''}`,
    actionUrl: '/reception/deliveries', icon: 'Package', severity: 'info',
  }).catch(() => {});

  logger.info(`[ReceptionAutomation] Delivery notification: ${delivery.carrier} → ${delivery.recipientName}`);
}
