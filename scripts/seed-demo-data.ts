/**
 * Seed demo data for Orlode AI
 * Run: cd scripts && npx ts-node seed-demo-data.ts
 *
 * This creates a demo company with sample documents metadata in Firestore.
 * It does NOT create actual vector embeddings (upload real files for that).
 */

import dotenv from 'dotenv';
import path from 'path';
import admin from 'firebase-admin';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const serviceAccountKey = process.env['FIREBASE_SERVICE_ACCOUNT_KEY'];
if (!serviceAccountKey) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is required');
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(serviceAccountKey) as admin.ServiceAccount),
});

const db = admin.firestore();

const DEMO_COMPANY_ID = 'demo-company-001';

async function seedDemoData(): Promise<void> {
  console.log('Seeding demo data...');

  // 1. Create demo company
  await db.collection('companies').doc(DEMO_COMPANY_ID).set({
    name: 'Acme Corporation',
    ownerId: 'demo-user-001',
    plan: 'professional',
    createdAt: new Date(),
    settings: {
      language: 'fr',
      aiPersonality: 'professional',
      systemContext: 'Acme Corporation is a leading technology company founded in 2010, specializing in enterprise software solutions.',
      timezone: 'Europe/Paris',
      maxTokens: 2000,
      temperature: 0.3,
    },
    logoUrl: null,
    website: 'https://acme-corp.example.com',
    industry: 'Technology',
    employeeCount: 250,
  });
  console.log('Created demo company: Acme Corporation');

  // 2. Create demo user
  await db.collection('users').doc('demo-user-001').set({
    uid: 'demo-user-001',
    email: 'admin@acme-corp.example.com',
    displayName: 'Marie Dupont',
    companyId: DEMO_COMPANY_ID,
    role: 'admin',
    department: 'Executive',
    jobTitle: 'CEO',
    isActive: true,
    createdAt: new Date(),
  });
  console.log('Created demo user: Marie Dupont');

  // 3. Create sample document records
  const sampleDocuments = [
    {
      id: 'doc-001',
      companyId: DEMO_COMPANY_ID,
      originalName: 'Q4-2024-Financial-Report.pdf',
      storagePath: `companies/${DEMO_COMPANY_ID}/documents/doc-001/Q4-2024-Financial-Report.pdf`,
      fileType: 'application/pdf',
      fileSize: 2_456_789,
      status: 'completed',
      chunksCreated: 142,
      uploadedBy: 'demo-user-001',
      uploadedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      processedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 30000),
      metadata: { pageCount: 45, wordCount: 12300 },
    },
    {
      id: 'doc-002',
      companyId: DEMO_COMPANY_ID,
      originalName: 'HR-Policy-2024.docx',
      storagePath: `companies/${DEMO_COMPANY_ID}/documents/doc-002/HR-Policy-2024.docx`,
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: 856_234,
      status: 'completed',
      chunksCreated: 87,
      uploadedBy: 'demo-user-001',
      uploadedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      processedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 + 20000),
      metadata: { wordCount: 8750 },
    },
    {
      id: 'doc-003',
      companyId: DEMO_COMPANY_ID,
      originalName: 'Product-Roadmap-2025.xlsx',
      storagePath: `companies/${DEMO_COMPANY_ID}/documents/doc-003/Product-Roadmap-2025.xlsx`,
      fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileSize: 345_678,
      status: 'completed',
      chunksCreated: 45,
      uploadedBy: 'demo-user-001',
      uploadedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      processedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 15000),
      metadata: { sheetNames: ['Q1', 'Q2', 'Q3', 'Q4', 'Summary'], wordCount: 3200 },
    },
    {
      id: 'doc-004',
      companyId: DEMO_COMPANY_ID,
      originalName: 'Client-Database.csv',
      storagePath: `companies/${DEMO_COMPANY_ID}/documents/doc-004/Client-Database.csv`,
      fileType: 'text/csv',
      fileSize: 128_456,
      status: 'processing',
      uploadedBy: 'demo-user-001',
      uploadedAt: new Date(),
      metadata: {},
    },
  ];

  const batch = db.batch();
  for (const doc of sampleDocuments) {
    const { id, ...data } = doc;
    batch.set(db.collection('documents').doc(id), data);
  }
  await batch.commit();
  console.log(`Created ${sampleDocuments.length} demo documents`);

  // 4. Create a demo conversation
  const convId = 'demo-conv-001';
  await db.collection('conversations').doc(convId).set({
    companyId: DEMO_COMPANY_ID,
    userId: 'demo-user-001',
    title: 'Q4 Financial Performance Review',
    messageCount: 4,
    lastMessage: "Based on the Q4 report, net revenue grew 23% YoY.",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  });

  // Sample messages
  const messages = [
    {
      id: 'msg-001',
      conversationId: convId,
      role: 'user',
      content: 'What were our Q4 2024 financial results?',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'msg-002',
      conversationId: convId,
      role: 'assistant',
      content: 'Based on the Q4 2024 Financial Report, Acme Corporation achieved:\n\n- **Net Revenue**: €12.4M (+23% YoY)\n- **EBITDA**: €2.8M (22.6% margin)\n- **New Clients**: 47 enterprise accounts\n\n[Source: Q4-2024-Financial-Report.pdf]',
      sources: [
        { documentId: 'doc-001', documentName: 'Q4-2024-Financial-Report.pdf', excerpt: 'Net revenue for Q4 2024 reached €12.4 million...', score: 0.94 },
      ],
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 5000),
    },
  ];

  const msgBatch = db.batch();
  for (const msg of messages) {
    msgBatch.set(
      db.collection('conversations').doc(convId).collection('messages').doc(msg.id),
      msg
    );
  }
  await msgBatch.commit();
  console.log('Created demo conversation with messages');

  // 5. Create demo meetings
  const meetings = [
    {
      companyId: DEMO_COMPANY_ID,
      title: 'Q1 2025 Board Review',
      date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      duration: 90,
      participants: ['Marie Dupont', 'Jean Martin', 'Sophie Laurent'],
      status: 'scheduled',
      hasTranscript: false,
      createdBy: 'demo-user-001',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      companyId: DEMO_COMPANY_ID,
      title: 'Product Strategy Meeting',
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      duration: 60,
      participants: ['Jean Martin', 'Thomas Petit'],
      status: 'completed',
      hasTranscript: true,
      summary: 'Discussed 2025 roadmap priorities. Agreed to focus on AI features in Q1.',
      createdBy: 'demo-user-001',
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  ];

  const meetingsBatch = db.batch();
  meetings.forEach((meeting, i) => {
    meetingsBatch.set(db.collection('meetings').doc(`demo-meeting-${i + 1}`), meeting);
  });
  await meetingsBatch.commit();
  console.log(`Created ${meetings.length} demo meetings`);

  console.log('\nDemo data seeded successfully!');
  console.log(`Company ID: ${DEMO_COMPANY_ID}`);
  console.log('Note: This demo company is separate from your actual workspace.');
  console.log('Sign up in the app to create your own workspace.');

  process.exit(0);
}

seedDemoData().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
