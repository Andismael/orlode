"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDemoData = seedDemoData;
exports.clearDemoData = clearDemoData;
/**
 * Seed Demo Data — Generates realistic demo data for a company
 * Called on first login or via admin button
 */
const firebase_config_1 = require("../config/firebase.config");
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
const FIRST_NAMES = ['Marie', 'Jean', 'Aminata', 'Moussa', 'Fatou', 'Ibrahim', 'Sophie', 'Adama', 'Claire', 'Kofi', 'Aïcha', 'Pierre'];
const LAST_NAMES = ['Diallo', 'Koné', 'Martin', 'Traoré', 'Dubois', 'Camara', 'Laurent', 'Ouattara', 'Bernard', 'Sanogo', 'Petit', 'Touré'];
const DEPARTMENTS = ['Direction', 'RH', 'Finance', 'Commercial', 'Support', 'IT', 'Marketing', 'Juridique'];
const ROLES_EMP = ['admin', 'manager', 'employee', 'employee', 'employee', 'employee'];
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pastDate(daysAgo) { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d; }
function futureDate(daysAhead) { const d = new Date(); d.setDate(d.getDate() + daysAhead); return d; }
function todayStr() { return new Date().toISOString().split('T')[0]; }
async function seedDemoData(companyId) {
    const db = (0, firebase_config_1.getFirestore)();
    const seeded = [];
    const counts = {};
    // If already seeded, clear first then re-seed
    const companyDoc = await db.collection('companies').doc(companyId).get();
    if (companyDoc.data()?.['demoSeeded']) {
        logger_1.logger.info(`[SeedDemo] Already seeded — clearing first...`);
        await clearDemoData(companyId);
    }
    logger_1.logger.info(`[SeedDemo] Seeding demo data for company ${companyId}`);
    // ── 1. EMPLOYEES (users collection) ────────────────────────────────────
    const employees = [];
    for (let i = 0; i < 12; i++) {
        const first = FIRST_NAMES[i];
        const last = pick(LAST_NAMES);
        const uid = `demo_${(0, helpers_1.generateId)().slice(0, 8)}`;
        const email = `${first.toLowerCase()}.${last.toLowerCase()}@demo.corpmind.ai`;
        const dept = DEPARTMENTS[i % DEPARTMENTS.length];
        const role = ROLES_EMP[i % ROLES_EMP.length];
        await db.collection('users').doc(uid).set({
            uid, companyId, email,
            displayName: `${first} ${last}`,
            firstName: first, lastName: last,
            department: dept, role,
            phone: `+225 0${rand(1, 9)} ${rand(10, 99)} ${rand(10, 99)} ${rand(10, 99)}`,
            createdAt: pastDate(rand(30, 365)),
        });
        employees.push({ uid, name: `${first} ${last}`, email, dept, role });
    }
    seeded.push('users');
    counts['employees'] = employees.length;
    // ── 2. PRESENCE ENRICHIE (today) ────────────────────────────────────────
    const today = todayStr();
    const richStatuses = ['present', 'present', 'present', 'present', 'busy', 'break', 'in_meeting', 'remote', 'present', 'on_leave', 'present', 'offsite'];
    const statusLocations = [null, 'Bureau 3A', null, 'Open space', 'Salle conf. A', 'Cafeteria 2e etage', 'Salle B', 'Domicile', null, null, 'Bureau 1B', 'Client TechCorp'];
    const statusNotes = [null, null, null, null, 'Appel client important', 'Pause dejeuner', 'Reunion equipe weekly', 'Teletravail mercredi', null, 'Conge annuel', null, 'Visite client sur site'];
    const expectedBacks = [null, null, null, null, '14:30', '13:00', '11:30', null, null, null, null, '17:00'];
    for (let i = 0; i < employees.length; i++) {
        const emp = employees[i];
        const rs = richStatuses[i] ?? 'present';
        const isAbsent = rs === 'on_leave' || rs === 'absent';
        const checkInTime = new Date(new Date().setHours(rand(7, 9), rand(0, 59)));
        await db.collection('presence').doc(`${emp.uid}_${today}`).set({
            companyId, employeeId: emp.uid, employeeName: emp.name, employeeEmail: emp.email,
            department: emp.dept, date: today,
            checkInAt: isAbsent ? null : checkInTime, checkOutAt: null,
            status: isAbsent ? 'absent' : 'present',
            richStatus: rs,
            statusLocation: statusLocations[i] ?? null,
            statusNote: statusNotes[i] ?? null,
            expectedBackAt: expectedBacks[i] ? new Date(new Date().setHours(parseInt(expectedBacks[i].split(':')[0]), parseInt(expectedBacks[i].split(':')[1]))) : null,
            leaveType: rs === 'on_leave' ? 'Conge annuel' : null,
            returnDate: rs === 'on_leave' ? futureDate(5).toISOString().split('T')[0] : null,
            method: pick(['code', 'qr', 'face']),
        });
    }
    seeded.push('presence');
    counts['presence'] = employees.length;
    // ── 3. VISITORS (today — enriched with host response workflow) ─────────
    const visitorData = [
        { name: 'Marc Leblanc', company: 'TechCorp', email: 'marc@techcorp.fr', purpose: 'Reunion partenariat', type: 'appointment', status: 'approved_to_enter', hostResponse: 'allow_entry', hostResponseMessage: 'Faites-le entrer' },
        { name: 'Aissatou Ba', company: 'AfriDigital', email: 'aissatou@afridigital.com', purpose: 'Demo produit', type: 'walkin', status: 'waiting_host', hostResponse: 'wait', hostResponseMessage: 'Attendez 5 minutes', estimatedWait: 5 },
        { name: 'Thomas Mercier', company: 'EuroConsult', email: 'thomas.m@euroconsult.eu', purpose: 'Audit financier', type: 'vip', status: 'checked_in', hostResponse: null },
        { name: 'Khadija Ndiaye', company: 'SolarAfrica', email: 'k.ndiaye@solarafrica.sn', purpose: 'Entretien recrutement', type: 'appointment', status: 'checked_out', hostResponse: 'allow_entry', hostResponseMessage: 'Je descends vous chercher' },
        { name: 'Olivier Durand', company: 'LogiTrans', email: 'o.durand@logitrans.fr', purpose: 'Livraison materiel', type: 'delivery', status: 'checked_out', hostResponse: null },
    ];
    for (const v of visitorData) {
        const checkIn = new Date();
        checkIn.setHours(rand(8, 14), rand(0, 59));
        const vid = (0, helpers_1.generateId)();
        await db.collection('visitors').doc(vid).set({
            companyId, id: vid, name: v.name, company: v.company, email: v.email,
            host: employees[rand(0, 5)].name, purpose: v.purpose, type: v.type,
            badgeNumber: `V-${Date.now().toString().slice(-6)}${rand(0, 9)}`,
            status: v.status, checkInAt: checkIn, checkOutAt: v.status === 'checked_out' ? new Date() : null,
            hostResponse: v.hostResponse, hostResponseMessage: v.hostResponseMessage ?? null,
            estimatedWait: v.estimatedWait ?? null,
            createdAt: checkIn,
        });
        // Timeline
        await db.collection(`visitors/${vid}/timeline`).doc((0, helpers_1.generateId)()).set({ action: 'Check-in', details: `${v.name} enregistre a la reception`, user: 'reception', timestamp: checkIn });
        if (v.hostResponse) {
            await db.collection(`visitors/${vid}/timeline`).doc((0, helpers_1.generateId)()).set({ action: `Reponse host: ${v.hostResponseMessage}`, details: v.hostResponseMessage, user: 'host', timestamp: new Date(checkIn.getTime() + 120000) });
        }
    }
    seeded.push('visitors');
    counts['visitors'] = visitorData.length;
    // ── 3b. PRE-REGISTRATIONS ──────────────────────────────────────────────
    const preRegs = [
        { visitorName: 'Laura Chen', visitorEmail: 'laura@innovtech.cn', visitorCompany: 'InnovTech', hostName: employees[0].name, purpose: 'Reunion strategique', scheduledDate: futureDate(1).toISOString().split('T')[0], status: 'approved', requiresNDA: true, requiresParking: true },
        { visitorName: 'Ahmed Hassan', visitorEmail: 'ahmed.h@gulfventures.ae', visitorCompany: 'GulfVentures', hostName: employees[1].name, purpose: 'Due diligence', scheduledDate: futureDate(2).toISOString().split('T')[0], status: 'pending_approval', requiresNDA: true, requiresParking: false },
        { visitorName: 'Emma Wilson', visitorEmail: 'emma@greencorp.uk', visitorCompany: 'GreenCorp', hostName: employees[2].name, purpose: 'Partenariat RSE', scheduledDate: futureDate(3).toISOString().split('T')[0], status: 'pending_approval', requiresNDA: false, requiresParking: true },
        { visitorName: 'Youssef Benmoussa', visitorEmail: 'youssef@maroctrade.ma', visitorCompany: 'MarocTrade', hostName: employees[3].name, purpose: 'Negociation contrat', scheduledDate: todayStr(), status: 'checked_in', requiresNDA: true, requiresParking: false },
    ];
    for (const pr of preRegs) {
        const id = (0, helpers_1.generateId)();
        await db.collection(`companies/${companyId}/preRegistrations`).doc(id).set({
            id, ...pr, scheduledTime: `${rand(9, 16)}:00`, qrCode: `PRE-${id.slice(0, 8).toUpperCase()}`,
            ndaSigned: pr.status === 'checked_in', checkedIn: pr.status === 'checked_in',
            notes: '', source: pick(['admin', 'public_form']), createdAt: pastDate(rand(1, 5)),
        });
    }
    seeded.push('preRegistrations');
    counts['preRegistrations'] = preRegs.length;
    // ── 3c. DELIVERIES ────────────────────────────────────────────────────
    const deliveries = [
        { carrier: 'DHL Express', trackingNumber: 'DHL-7829301456', itemCount: 2, description: 'Materiel informatique', recipientName: employees[5].name, recipientDepartment: 'IT', status: 'received' },
        { carrier: 'La Poste', trackingNumber: 'LP-2024-98721', itemCount: 1, description: 'Courrier recommande juridique', recipientName: employees[7].name, recipientDepartment: 'Juridique', status: 'received' },
        { carrier: 'UPS', trackingNumber: 'UPS-1Z999AA10', itemCount: 5, description: 'Fournitures bureau', recipientName: employees[2].name, recipientDepartment: 'RH', status: 'collected' },
        { carrier: 'Chronopost', trackingNumber: 'CHRONO-456789', itemCount: 1, description: 'Echantillons produit', recipientName: employees[3].name, recipientDepartment: 'Commercial', status: 'received' },
    ];
    for (const d of deliveries) {
        const id = (0, helpers_1.generateId)();
        const recvAt = new Date();
        recvAt.setHours(rand(8, 12), rand(0, 59));
        await db.collection(`companies/${companyId}/deliveries`).doc(id).set({
            id, ...d, signed: d.status === 'collected', receivedAt: recvAt,
            collectedAt: d.status === 'collected' ? new Date() : null, createdBy: 'demo',
        });
    }
    seeded.push('deliveries');
    counts['deliveries'] = deliveries.length;
    // ── 3d. APPOINTMENTS ──────────────────────────────────────────────────
    const appointments = [
        { visitorName: 'Laura Chen', visitorCompany: 'InnovTech', host: employees[0].name, purpose: 'Reunion strategique', status: 'confirmed', daysAhead: 1 },
        { visitorName: 'Marc Leblanc', visitorCompany: 'TechCorp', host: employees[1].name, purpose: 'Reunion partenariat', status: 'confirmed', daysAhead: 0 },
        { visitorName: 'Sofia Garcia', visitorCompany: 'IberiaConsult', host: employees[4].name, purpose: 'Presentation offre', status: 'confirmed', daysAhead: 2 },
        { visitorName: 'James Brown', visitorCompany: 'USATech Inc', host: employees[0].name, purpose: 'Video conference', status: 'cancelled', daysAhead: -1 },
    ];
    for (const a of appointments) {
        const d = a.daysAhead >= 0 ? futureDate(a.daysAhead) : pastDate(Math.abs(a.daysAhead));
        d.setHours(rand(9, 16), 0, 0, 0);
        await db.collection('appointments').doc((0, helpers_1.generateId)()).set({
            companyId, ...a, scheduledAt: d, location: pick(['Salle A', 'Salle B', 'Bureau Direction', 'Visio']),
            createdAt: pastDate(rand(1, 7)),
        });
    }
    seeded.push('appointments');
    counts['appointments'] = appointments.length;
    // ── 3e. PARKING SPOTS ─────────────────────────────────────────────────
    for (let i = 1; i <= 8; i++) {
        const occupied = i <= 3;
        await db.collection(`companies/${companyId}/parkingSpots`).doc(`P-${i}`).set({
            id: `P-${i}`, status: occupied ? 'reserved' : 'available',
            occupant: occupied ? pick(visitorData.map(v => v.name)) : '',
            plate: occupied ? `AB-${rand(100, 999)}-CD` : '', reservedAt: occupied ? new Date() : null,
        });
    }
    seeded.push('parkingSpots');
    counts['parkingSpots'] = 8;
    // ── 3f. PHISHING CAMPAIGNS ────────────────────────────────────────────
    const phishCampaigns = [
        { name: 'Test Q1 — Reset mot de passe', template: 'password_reset', targetCount: 12, openedCount: 8, clickedCount: 3, reportedCount: 2, status: 'completed' },
        { name: 'Test Q2 — Facture urgente', template: 'invoice_payment', targetCount: 12, openedCount: 10, clickedCount: 5, reportedCount: 1, status: 'completed' },
        { name: 'Test Q2 — Fraude PDG', template: 'ceo_fraud', targetCount: 12, openedCount: 7, clickedCount: 2, reportedCount: 4, status: 'active' },
    ];
    for (const c of phishCampaigns) {
        const id = (0, helpers_1.generateId)();
        await db.collection(`companies/${companyId}/phishingCampaigns`).doc(id).set({
            id, ...c, targetGroup: 'all', department: null,
            emailSubject: c.template === 'password_reset' ? 'Action requise: Reinitialisation mot de passe' : c.template === 'invoice_payment' ? 'Facture impayee #INV-2026-089' : 'Urgent: Demande du PDG',
            emailBody: 'Cliquez sur le lien ci-dessous pour verifier...', emailSender: 'security@company-verify.com',
            redFlags: ['Domaine externe', 'Urgence artificielle', 'Lien suspect'],
            launchedAt: pastDate(c.status === 'active' ? 2 : rand(30, 90)), createdAt: pastDate(c.status === 'active' ? 2 : rand(30, 90)),
        });
    }
    seeded.push('phishingCampaigns');
    counts['phishingCampaigns'] = phishCampaigns.length;
    // ── 3g. SECURITY POLICIES ─────────────────────────────────────────────
    const policies = [
        { title: 'Politique de mot de passe', category: 'password', status: 'published', version: '2.1', content: '# Politique de mot de passe\n\n## Objectif\nProteger les comptes utilisateurs contre les acces non autorises.\n\n## Regles\n- Minimum 12 caracteres\n- Majuscule, minuscule, chiffre, symbole\n- Changement tous les 90 jours\n- MFA obligatoire\n- Pas de reutilisation des 5 derniers\n\n## Responsabilites\n- IT: enforcement technique\n- Employes: respect strict\n- Managers: sensibilisation equipe' },
        { title: 'Politique de controle d\'acces', category: 'access', status: 'published', version: '1.3', content: '# Controle d\'acces\n\n## Principe du moindre privilege\nChaque employe n\'a acces qu\'aux ressources necessaires a sa fonction.\n\n## Revue trimestrielle\nAudit des permissions admin tous les 3 mois.\n\n## Depart employe\nDesactivation immediate du compte sous 24h.' },
        { title: 'Plan de reponse incident', category: 'incident', status: 'draft', version: '1.0', content: '# Plan de reponse incident\n\n## Classification\n- P1 Critical: reponse < 1h\n- P2 High: reponse < 4h\n- P3 Medium: reponse < 24h\n\n## Equipe\n- CISO: coordination\n- IT: containment\n- Legal: notification RGPD\n- Comms: communication interne/externe' },
    ];
    for (const p of policies) {
        const id = (0, helpers_1.generateId)();
        await db.collection(`companies/${companyId}/securityPolicies`).doc(id).set({
            id, ...p, attestations: [], createdAt: pastDate(rand(10, 60)), updatedAt: pastDate(rand(1, 10)),
        });
    }
    seeded.push('securityPolicies');
    counts['securityPolicies'] = policies.length;
    // ── 4. LEAVE REQUESTS ──────────────────────────────────────────────────
    const leaveTypes = ['paid', 'sick', 'rtt', 'paid', 'paid'];
    for (let i = 0; i < 5; i++) {
        const emp = employees[rand(2, 11)];
        const start = futureDate(rand(3, 30));
        const end = new Date(start);
        end.setDate(end.getDate() + rand(1, 5));
        await db.collection('leaveRequests').doc((0, helpers_1.generateId)()).set({
            companyId, userId: emp.uid, employeeName: emp.name, employeeEmail: emp.email,
            type: leaveTypes[i], status: i < 3 ? 'pending' : 'approved',
            from: start.toISOString().split('T')[0],
            to: end.toISOString().split('T')[0],
            days: rand(1, 5),
            reason: pick(['Vacances familiales', 'Rendez-vous médical', 'Événement personnel', 'Repos']),
            createdAt: pastDate(rand(1, 7)),
        });
    }
    seeded.push('leaveRequests');
    counts['leaveRequests'] = 5;
    // ── 5. INVOICES ────────────────────────────────────────────────────────
    const clients = ['TechCorp SARL', 'AfriDigital', 'EuroConsult', 'SolarAfrica', 'MediPlus', 'AgroSud'];
    const statuses = ['paid', 'paid', 'sent', 'overdue', 'paid', 'overdue'];
    for (let i = 0; i < 6; i++) {
        const amount = rand(500, 15000);
        const id = `INV-${2026}-${String(i + 1).padStart(4, '0')}`;
        await db.collection('invoices').doc(id).set({
            companyId, number: id, client: clients[i],
            amount, currency: 'EUR',
            status: statuses[i],
            issuedAt: pastDate(rand(5, 60)),
            dueDate: statuses[i] === 'overdue' ? pastDate(rand(1, 10)) : futureDate(rand(5, 30)),
            items: [
                { description: pick(['Consulting', 'Développement', 'Formation', 'Licence', 'Maintenance']), quantity: rand(1, 10), unitPrice: rand(100, 2000) },
            ],
            createdAt: pastDate(rand(5, 60)),
        });
    }
    seeded.push('invoices');
    counts['invoices'] = 6;
    // ── 6. LEADS (sales pipeline) ──────────────────────────────────────────
    const stages = ['Prospect', 'Qualifié', 'Proposition', 'Négociation', 'Gagné', 'Prospect'];
    const leadNames = ['DataFlow Inc', 'GreenTech Afrique', 'MobiPay', 'HealthConnect', 'EduSmart', 'LogiTrans'];
    for (let i = 0; i < 6; i++) {
        const amount = rand(5000, 50000);
        const leadId = (0, helpers_1.generateId)();
        // Write to both collections (analytics reads 'leads', sales routes read 'salesLeads')
        const leadData = {
            companyId, name: leadNames[i],
            contact: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
            email: `contact@${leadNames[i].toLowerCase().replace(/\s/g, '')}.com`,
            amount, probability: rand(20, 90),
            stage: stages[i], score: rand(10, 95),
            owner: employees[rand(0, 3)].name,
            source: pick(['Site web', 'Recommandation', 'LinkedIn', 'Salon', 'Cold call']),
            createdAt: pastDate(rand(5, 90)),
        };
        await db.collection('leads').doc(leadId).set(leadData);
        await db.collection('salesLeads').doc(leadId).set(leadData);
    }
    seeded.push('leads');
    counts['leads'] = 6;
    // ── 7. SUPPORT TICKETS ─────────────────────────────────────────────────
    const ticketSubjects = [
        'Impossible de se connecter', 'Erreur lors du paiement',
        'Fonctionnalité demandée', 'Bug sur mobile', 'Question facturation',
    ];
    for (let i = 0; i < 5; i++) {
        await db.collection('supportTickets').doc((0, helpers_1.generateId)()).set({
            companyId, subject: ticketSubjects[i],
            description: `Le client signale un problème : ${ticketSubjects[i].toLowerCase()}.`,
            priority: pick(['high', 'medium', 'low']),
            status: i < 3 ? 'open' : 'resolved',
            assignee: employees[rand(0, 5)].name,
            customerEmail: `client${i + 1}@example.com`,
            createdAt: pastDate(rand(1, 14)),
        });
    }
    seeded.push('supportTickets');
    counts['supportTickets'] = 5;
    // ── 8. IT TICKETS ──────────────────────────────────────────────────────
    const itSubjects = ['Écran ne s\'allume plus', 'Imprimante en panne', 'VPN lent', 'Nouveau laptop'];
    for (let i = 0; i < 4; i++) {
        await db.collection('itTickets').doc((0, helpers_1.generateId)()).set({
            companyId, subject: itSubjects[i],
            description: `Problème IT : ${itSubjects[i]}.`,
            priority: pick(['high', 'medium', 'low']),
            status: i < 2 ? 'open' : 'resolved',
            reporter: employees[rand(4, 11)].name,
            assignee: employees[rand(0, 2)].name,
            createdAt: pastDate(rand(1, 10)),
        });
    }
    seeded.push('itTickets');
    counts['itTickets'] = 4;
    // ── 9. MARKETING POSTS ─────────────────────────────────────────────────
    const postTopics = ['Lancement produit', 'Offre spéciale été', 'Témoignage client', 'Recrutement dev', 'Événement networking'];
    for (let i = 0; i < 5; i++) {
        await db.collection('marketingPosts').doc((0, helpers_1.generateId)()).set({
            companyId, title: postTopics[i],
            content: `Post marketing sur le thème : ${postTopics[i]}.`,
            platform: pick(['linkedin', 'facebook', 'instagram', 'twitter']),
            status: pick(['draft', 'scheduled', 'published']),
            scheduledAt: futureDate(rand(1, 14)),
            createdAt: pastDate(rand(1, 30)),
        });
    }
    seeded.push('marketingPosts');
    counts['marketingPosts'] = 5;
    // ── 10. TRAINING COURSES ───────────────────────────────────────────────
    const courseTopics = ['Cybersécurité 101', 'Excel avancé', 'Communication client', 'Gestion du temps'];
    for (let i = 0; i < 4; i++) {
        await db.collection('trainingCourses').doc((0, helpers_1.generateId)()).set({
            companyId, title: courseTopics[i],
            category: pick(['Technique', 'Soft skills', 'Sécurité', 'Productivité']),
            duration: rand(30, 120),
            progress: rand(0, 100),
            enrolledCount: rand(3, 12),
            createdAt: pastDate(rand(10, 60)),
        });
    }
    seeded.push('trainingCourses');
    counts['trainingCourses'] = 4;
    // ── 11. FINANCE MONTHLY (for dashboard chart) ──────────────────────────
    const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2025-12', '2025-11', '2025-10'];
    for (const month of months) {
        const revenue = rand(15000, 60000);
        const expenses = rand(8000, 35000);
        await db.collection('financeMonthly').doc(`${companyId}_${month}`).set({
            companyId, month, revenue, expenses,
            createdAt: new Date(`${month}-15`),
        });
    }
    seeded.push('financeMonthly');
    counts['financeMonthly'] = months.length;
    // ── 12. BUDGETS ───────────────────────────────────────────────────────
    for (const dept of DEPARTMENTS) {
        await db.collection('budgets').doc(`${companyId}_${dept}`).set({
            companyId, dept, allocated: rand(10000, 50000), spent: rand(3000, 25000),
            createdAt: new Date(),
        });
    }
    seeded.push('budgets');
    counts['budgets'] = DEPARTMENTS.length;
    // ── 13. USAGE DATA (AI activity last 7 days) ─────────────────────────
    for (let d = 6; d >= 0; d--) {
        const date = pastDate(d);
        const dateStr = date.toISOString().split('T')[0];
        const gemini = rand(5000, 50000);
        const claude = rand(1000, 10000);
        const requests = rand(20, 150);
        // Write to both collections (dashboard reads usageStats, some pages read usageDaily)
        await db.collection(`companies/${companyId}/usageDaily`).doc(dateStr).set({ date: dateStr, gemini, claude, requests });
        await db.collection('usageStats').doc(`${companyId}_${dateStr}`).set({ companyId, date: dateStr, gemini, claude, requests });
    }
    seeded.push('usageStats');
    counts['usageStats'] = 7;
    // ── Security demo data ─────────────────────────────────────────────────
    const secIncidents = [
        { type: 'phishing', description: 'Email phishing detecte ciblant le departement finance — lien malveillant bloque', priority: 'P2_high', status: 'investigating', source: 'email_gateway', affectedSystems: ['Email'] },
        { type: 'unauthorized_access', description: 'Tentative connexion depuis IP inconnue sur compte admin — bloque par MFA', priority: 'P3_medium', status: 'contained', source: 'siem', affectedSystems: ['Active Directory'] },
        { type: 'malware', description: 'Signature Emotet detectee sur poste DESKTOP-014 — quarantaine automatique', priority: 'P1_critical', status: 'eradicated', source: 'endpoint', affectedSystems: ['DESKTOP-014'] },
        { type: 'misconfiguration', description: 'Bucket S3 expose publiquement — corrige immediatement', priority: 'P2_high', status: 'recovered', source: 'automated', affectedSystems: ['AWS S3'] },
        { type: 'data_breach', description: 'Export non autorise de donnees clients detecte via DLP', priority: 'P1_critical', status: 'investigating', source: 'dlp', affectedSystems: ['CRM', 'Database'] },
    ];
    for (const inc of secIncidents) {
        const id = (0, helpers_1.generateId)();
        const d = new Date(Date.now() - Math.random() * 7 * 86400000);
        await db.collection(`companies/${companyId}/securityIncidents`).doc(id).set({
            id, companyId, ...inc, assignee: null, detectedAt: d, createdAt: d, updatedAt: d,
            slaDeadline: new Date(d.getTime() + 86400000).toISOString(),
        });
        await db.collection(`companies/${companyId}/securityIncidents/${id}/timeline`).doc((0, helpers_1.generateId)()).set({
            action: 'Incident detecte', status: 'detected', user: 'system', details: inc.description, timestamp: d,
        });
    }
    seeded.push('securityIncidents');
    counts['securityIncidents'] = secIncidents.length;
    // Vulnerabilities
    const vulns = [
        { cve: 'CVE-2024-3094', severity: 'critical', asset: 'xz-utils 5.6.x', description: 'Backdoor dans xz/liblzma — code malveillant insere dans le processus de build', remediation: 'Downgrader xz-utils vers 5.4.x', status: 'open' },
        { cve: 'CVE-2024-21762', severity: 'high', asset: 'FortiOS SSL-VPN', description: 'Ecriture hors limites dans FortiOS SSL-VPN — execution de code a distance', remediation: 'Mettre a jour FortiOS vers derniere version', status: 'open' },
        { cve: 'CVE-2023-44487', severity: 'high', asset: 'Stack HTTP/2', description: 'HTTP/2 Rapid Reset — vecteur DDoS amplifie', remediation: 'Appliquer rate limiting HTTP/2', status: 'fixed' },
        { cve: 'CVE-2024-27198', severity: 'critical', asset: 'TeamCity Server', description: 'Bypass authentification dans JetBrains TeamCity', remediation: 'Mettre a jour TeamCity vers 2023.11.4+', status: 'open' },
        { cve: 'CVE-2023-46747', severity: 'medium', asset: 'F5 BIG-IP', description: 'AJP request smuggling via configuration non securisee', remediation: 'Appliquer patch F5 et reviser config AJP', status: 'fixed' },
    ];
    for (const v of vulns) {
        const id = (0, helpers_1.generateId)();
        await db.collection(`companies/${companyId}/vulnerabilities`).doc(id).set({
            id, ...v, detectedAt: new Date(Date.now() - Math.random() * 14 * 86400000), scanId: 'demo',
        });
    }
    seeded.push('vulnerabilities');
    counts['vulnerabilities'] = vulns.length;
    // Threat feed
    const threats = [
        { type: 'Brute Force', severity: 'high', source: 'Firewall', description: 'Tentatives de connexion multiples depuis IP 45.33.x.x', ioc: '45.33.32.156', blocked: true },
        { type: 'Phishing Email', severity: 'medium', source: 'Email Gateway', description: 'Email suspect bloque — lien vers domaine malveillant', ioc: 'secure-login-verify.xyz', blocked: true },
        { type: 'Malware Signature', severity: 'critical', source: 'Endpoint Protection', description: 'Signature Emotet detectee sur poste DESKTOP-014', ioc: 'emotet-c2-server.bad', blocked: true },
        { type: 'Port Scan', severity: 'low', source: 'IDS', description: 'Scan de ports detecte depuis sous-reseau externe', blocked: false },
        { type: 'Privilege Escalation', severity: 'high', source: 'SIEM', description: 'Elevation de privileges non autorisee — compte service', blocked: false },
        { type: 'SQL Injection', severity: 'medium', source: 'WAF', description: 'Tentative injection SQL bloquee sur /api/search', ioc: "' OR 1=1--", blocked: true },
    ];
    for (const t of threats) {
        const id = (0, helpers_1.generateId)();
        await db.collection(`companies/${companyId}/threatFeed`).doc(id).set({
            id, ...t, timestamp: new Date(Date.now() - Math.random() * 3 * 86400000),
        });
    }
    seeded.push('threatFeed');
    counts['threatFeed'] = threats.length;
    // Security score
    await db.collection(`companies/${companyId}/securityScore`).doc((0, helpers_1.generateId)()).set({
        overallScore: 68,
        categories: [
            { name: 'Controle d\'acces', score: 75, status: 'warning' },
            { name: 'Gestion incidents', score: 55, status: 'critical' },
            { name: 'Vulnerabilites', score: 60, status: 'warning' },
            { name: 'Politiques', score: 82, status: 'good' },
        ],
        recommendations: [
            'Activer MFA pour tous les utilisateurs', 'Resoudre 2 incidents critiques ouverts',
            'Corriger 2 vulnerabilites critiques', 'Planifier un exercice de reponse incident',
        ],
        date: new Date(),
    });
    seeded.push('securityScore');
    counts['securityScore'] = 1;
    // ── Mark as seeded ─────────────────────────────────────────────────────
    await db.collection('companies').doc(companyId).update({
        demoSeeded: true,
        demoSeededAt: new Date(),
        employeeCount: employees.length,
    });
    logger_1.logger.info(`[SeedDemo] Done: ${seeded.join(', ')} — ${JSON.stringify(counts)}`);
    return { seeded, counts };
}
async function clearDemoData(companyId) {
    const db = (0, firebase_config_1.getFirestore)();
    // Delete demo users
    const demoUsers = await db.collection('users').where('companyId', '==', companyId).get();
    for (const doc of demoUsers.docs) {
        if (doc.id.startsWith('demo_'))
            await doc.ref.delete();
    }
    // Delete collections
    const collections = ['presence', 'visitors', 'leaveRequests', 'invoices', 'leads', 'salesLeads', 'supportTickets', 'itTickets', 'marketingPosts', 'trainingCourses', 'financeMonthly', 'budgets', 'usageStats'];
    for (const col of collections) {
        const snap = await db.collection(col).where('companyId', '==', companyId).limit(500).get();
        for (const doc of snap.docs)
            await doc.ref.delete();
    }
    // Clear usage daily
    const usageSnap = await db.collection(`companies/${companyId}/usageDaily`).get();
    for (const doc of usageSnap.docs)
        await doc.ref.delete();
    await db.collection('companies').doc(companyId).update({ demoSeeded: false });
    logger_1.logger.info(`[SeedDemo] Cleared demo data for company ${companyId}`);
}
//# sourceMappingURL=seedDemoData.js.map