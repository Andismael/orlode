/**
 * Contract PDF generator — produces employment contracts, certificates, and payslips
 * with company letterhead (logo + address + legal info).
 */
import PDFDocument from 'pdfkit';
import { getFirestore } from '../../config/firebase.config';

interface ContractCompany {
  name: string;
  legalForm?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  taxId?: string;
}

interface ContractEmployee {
  name: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  baseSalary?: number;
  currency?: string;
  startDate?: string;
  contractType?: 'CDI' | 'CDD' | 'Stage' | 'Freelance';
  endDate?: string; // for CDD
  trialPeriodMonths?: number;
  workHours?: string;
}

export async function loadCompany(companyId: string): Promise<ContractCompany> {
  try {
    const doc = await getFirestore().collection('companies').doc(companyId).get();
    const d = doc.data() ?? {};
    return {
      name: (d['name'] as string) ?? 'Entreprise',
      legalForm: d['legalForm'] as string | undefined,
      address: d['address'] as string | undefined,
      phone: d['phone'] as string | undefined,
      email: d['email'] as string | undefined,
      logoUrl: d['logoUrl'] as string | undefined,
      taxId: d['taxId'] as string | undefined,
    };
  } catch {
    return { name: 'Entreprise' };
  }
}

async function fetchLogo(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}

/**
 * Renders a full employment contract PDF as Buffer.
 */
export async function renderContractPdf(company: ContractCompany, employee: ContractEmployee): Promise<Buffer> {
  const logoBuf = company.logoUrl ? await fetchLogo(company.logoUrl) : null;
  const contractType = employee.contractType ?? 'CDI';
  const trialMonths = employee.trialPeriodMonths ?? (contractType === 'CDI' ? 3 : 1);
  const workHours = employee.workHours ?? '40 heures hebdomadaires';
  const currency = employee.currency ?? 'XOF';
  const salary = employee.baseSalary ?? 0;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── HEADER BAND — violet letterhead
      doc.rect(0, 0, 595, 90).fill('#7c3aed');

      if (logoBuf) {
        try { doc.image(logoBuf, 40, 22, { width: 46, height: 46 }); }
        catch { /* fallback */ }
      } else {
        doc.circle(63, 45, 23).fill('#ffffff');
        doc.fillColor('#7c3aed').fontSize(16).font('Helvetica-Bold');
        doc.text(company.name.slice(0, 2).toUpperCase(), 40, 38, { width: 46, align: 'center' });
      }

      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16);
      doc.text(company.name, 100, 22);
      doc.font('Helvetica').fontSize(8);
      let line = 40;
      if (company.legalForm) { doc.text(company.legalForm, 100, line); line += 11; }
      if (company.address) { doc.text(company.address, 100, line); line += 11; }
      const contact = [company.phone, company.email].filter(Boolean).join('  ·  ');
      if (contact) doc.text(contact, 100, line);

      doc.fontSize(9).text('CONTRAT DE TRAVAIL', 0, 22, { width: 555, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(15);
      doc.text(contractType, 0, 36, { width: 555, align: 'right' });
      doc.font('Helvetica').fontSize(8);
      doc.text(new Date().toLocaleDateString('fr-FR'), 0, 56, { width: 555, align: 'right' });

      doc.fillColor('#111827').y = 110;

      // ── TITLE
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#111827');
      doc.text(`CONTRAT DE TRAVAIL À DURÉE ${contractType === 'CDI' ? 'INDÉTERMINÉE' : contractType === 'CDD' ? 'DÉTERMINÉE' : contractType.toUpperCase()}`, 50, doc.y, { width: 495, align: 'center' });
      doc.moveDown(1.5);

      // ── ENTRE LES SOUSSIGNÉS
      doc.fontSize(10).font('Helvetica').fillColor('#374151');
      doc.text('Entre les soussignés :', 50, doc.y);
      doc.moveDown(0.5);

      // Employeur
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827');
      doc.text(`L'EMPLOYEUR : ${company.name}`, 50, doc.y);
      doc.font('Helvetica').fontSize(10).fillColor('#374151');
      if (company.legalForm) doc.text(company.legalForm, 50, doc.y);
      if (company.address) doc.text(company.address, 50, doc.y);
      if (company.taxId) doc.text(`N° ${company.taxId}`, 50, doc.y);
      doc.text('Ci-après dénommé "l\'Employeur",', 50, doc.y);
      doc.moveDown(0.5);
      doc.text("D'une part,", 50, doc.y);
      doc.moveDown(1);

      doc.text('Et', 50, doc.y);
      doc.moveDown(0.5);

      // Employé
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827');
      doc.text(`LE/LA SALARIÉ(E) : ${employee.name}`, 50, doc.y);
      doc.font('Helvetica').fontSize(10).fillColor('#374151');
      if (employee.email) doc.text(employee.email, 50, doc.y);
      if (employee.phone) doc.text(employee.phone, 50, doc.y);
      doc.text('Ci-après dénommé(e) "le/la Salarié(e)",', 50, doc.y);
      doc.moveDown(0.5);
      doc.text("D'autre part,", 50, doc.y);
      doc.moveDown(1.5);

      doc.font('Helvetica-Bold').fillColor('#111827');
      doc.text('IL A ÉTÉ CONVENU CE QUI SUIT :', 50, doc.y);
      doc.moveDown(1);

      // ── ARTICLE 1 — Engagement
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#7c3aed');
      doc.text('Article 1 — Engagement', 50, doc.y);
      doc.font('Helvetica').fontSize(10).fillColor('#374151');
      doc.text(`L'Employeur engage le/la Salarié(e) en qualité de "${employee.jobTitle ?? 'Collaborateur'}"${employee.department ? `, au sein du département ${employee.department}` : ''}, à compter du ${employee.startDate ?? 'date à définir'}.`, 50, doc.y, { width: 495, align: 'justify' });
      doc.moveDown(1);

      // ── ARTICLE 2 — Période d'essai
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#7c3aed');
      doc.text('Article 2 — Période d\'essai', 50, doc.y);
      doc.font('Helvetica').fontSize(10).fillColor('#374151');
      doc.text(`Le présent contrat est conclu avec une période d'essai de ${trialMonths} mois, renouvelable une fois par accord écrit. Durant cette période, chacune des parties peut rompre le contrat sans indemnité moyennant un préavis de 7 jours.`, 50, doc.y, { width: 495, align: 'justify' });
      doc.moveDown(1);

      // ── ARTICLE 3 — Durée du travail
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#7c3aed');
      doc.text('Article 3 — Durée du travail', 50, doc.y);
      doc.font('Helvetica').fontSize(10).fillColor('#374151');
      doc.text(`Le/la Salarié(e) effectuera ${workHours}, selon les horaires en vigueur dans l'entreprise.`, 50, doc.y, { width: 495, align: 'justify' });
      doc.moveDown(1);

      // ── ARTICLE 4 — Rémunération
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#7c3aed');
      doc.text('Article 4 — Rémunération', 50, doc.y);
      doc.font('Helvetica').fontSize(10).fillColor('#374151');
      doc.text(`La rémunération mensuelle brute est fixée à ${salary.toLocaleString()} ${currency}, versée au plus tard le 5 du mois suivant. Le/la Salarié(e) bénéficiera également des avantages sociaux en vigueur dans l'entreprise.`, 50, doc.y, { width: 495, align: 'justify' });
      doc.moveDown(1);

      // New page if needed for remaining articles
      if (doc.y > 650) doc.addPage();

      // ── ARTICLE 5 — Congés payés
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#7c3aed');
      doc.text('Article 5 — Congés payés', 50, doc.y);
      doc.font('Helvetica').fontSize(10).fillColor('#374151');
      doc.text("Le/la Salarié(e) a droit à des congés payés conformément à la réglementation du travail en vigueur, soit 2,5 jours ouvrables par mois de travail effectif.", 50, doc.y, { width: 495, align: 'justify' });
      doc.moveDown(1);

      // ── ARTICLE 6 — Confidentialité
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#7c3aed');
      doc.text('Article 6 — Obligation de confidentialité', 50, doc.y);
      doc.font('Helvetica').fontSize(10).fillColor('#374151');
      doc.text("Le/la Salarié(e) s'engage à observer la plus stricte confidentialité sur toutes les informations commerciales, financières, techniques ou stratégiques dont il/elle aura connaissance dans l'exercice de ses fonctions, pendant toute la durée du contrat et après sa rupture.", 50, doc.y, { width: 495, align: 'justify' });
      doc.moveDown(1);

      // ── ARTICLE 7 — Rupture
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#7c3aed');
      doc.text('Article 7 — Rupture du contrat', 50, doc.y);
      doc.font('Helvetica').fontSize(10).fillColor('#374151');
      if (contractType === 'CDI') {
        doc.text('Chacune des parties peut mettre fin au contrat dans les conditions prévues par la loi, moyennant le respect des préavis légaux (1 mois pour les employés, 3 mois pour les cadres, sauf dispositions conventionnelles plus favorables).', 50, doc.y, { width: 495, align: 'justify' });
      } else if (contractType === 'CDD' && employee.endDate) {
        doc.text(`Le présent contrat prend fin automatiquement le ${employee.endDate}, sans préavis ni indemnité de rupture, sauf dispositions légales contraires.`, 50, doc.y, { width: 495, align: 'justify' });
      } else {
        doc.text("Les conditions de rupture sont régies par la législation applicable à ce type de contrat.", 50, doc.y, { width: 495, align: 'justify' });
      }
      doc.moveDown(1);

      // ── ARTICLE 8 — Droit applicable
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#7c3aed');
      doc.text('Article 8 — Droit applicable', 50, doc.y);
      doc.font('Helvetica').fontSize(10).fillColor('#374151');
      doc.text("Le présent contrat est régi par le Code du travail en vigueur. Tout différend non résolu à l'amiable sera soumis aux juridictions compétentes.", 50, doc.y, { width: 495, align: 'justify' });
      doc.moveDown(2);

      // ── SIGNATURES
      if (doc.y > 680) doc.addPage();
      doc.font('Helvetica').fontSize(10).fillColor('#374151');
      doc.text(`Fait à ${company.address?.split(',')[0] ?? '____________'}, le ${new Date().toLocaleDateString('fr-FR')}, en deux exemplaires originaux.`, 50, doc.y, { width: 495 });
      doc.moveDown(2);

      const sigY = doc.y;
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('Pour l\'Employeur', 50, sigY, { width: 240, align: 'center' });
      doc.text('Le/la Salarié(e)', 305, sigY, { width: 240, align: 'center' });
      doc.moveTo(70, sigY + 40).lineTo(270, sigY + 40).strokeColor('#9ca3af').stroke();
      doc.moveTo(325, sigY + 40).lineTo(525, sigY + 40).strokeColor('#9ca3af').stroke();
      doc.font('Helvetica').fontSize(8).fillColor('#9ca3af');
      doc.text('(Signature + cachet)', 50, sigY + 45, { width: 240, align: 'center' });
      doc.text(`(Signature précédée de "Lu et approuvé")`, 305, sigY + 45, { width: 240, align: 'center' });

      // ── FOOTER
      const pageH = 842; // A4 height in points
      doc.moveTo(50, pageH - 40).lineTo(545, pageH - 40).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
      doc.fontSize(7).font('Helvetica').fillColor('#9ca3af');
      const legal = [company.name, company.address, company.taxId ? `N° ${company.taxId}` : null].filter(Boolean).join(' · ');
      doc.text(legal, 50, pageH - 34, { width: 350 });
      doc.text('Powered by Orlode', 50, pageH - 34, { width: 495, align: 'right' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
