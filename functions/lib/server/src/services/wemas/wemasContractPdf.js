"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderWemasContractPdf = renderWemasContractPdf;
/**
 * Wemas contract PDF renderer — turns the markdown/text contractContent
 * stored in Firestore into a printable PDF that gets attached to emails.
 *
 * Layout: company letterhead, contract title, body (markdown-ish formatting
 * preserved at line level), signing CTA + verification code at the end.
 */
const pdfkit_1 = __importDefault(require("pdfkit"));
const contractPdfService_1 = require("../hr/contractPdfService");
const TYPE_LABELS = {
    cdi: 'Contrat à durée indéterminée (CDI)',
    cdd: 'Contrat à durée déterminée (CDD)',
    freelance: 'Contrat freelance',
    prestation_services: 'Contrat de prestation de services',
    nda: 'Accord de confidentialité (NDA)',
    partenariat: 'Accord de partenariat',
    fournisseur: 'Contrat fournisseur',
};
async function fetchLogo(url) {
    try {
        const res = await fetch(url);
        if (!res.ok)
            return null;
        return Buffer.from(await res.arrayBuffer());
    }
    catch {
        return null;
    }
}
async function renderWemasContractPdf(companyId, data) {
    const company = await (0, contractPdfService_1.loadCompany)(companyId);
    return await new Promise(async (resolve, reject) => {
        try {
            const doc = new pdfkit_1.default({ size: 'A4', margin: 50 });
            const chunks = [];
            doc.on('data', (c) => chunks.push(c));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
            // ── Header — letterhead with logo + company info ──────────────────────
            if (company.logoUrl) {
                const logo = await fetchLogo(company.logoUrl);
                if (logo) {
                    try {
                        doc.image(logo, 50, 45, { width: 70 });
                    }
                    catch { /* skip */ }
                }
            }
            doc.fontSize(14).fillColor('#0A4F3C').font('Helvetica-Bold').text(company.name, 140, 50);
            doc.fontSize(9).fillColor('#5A6B62').font('Helvetica');
            let y = 68;
            if (company.legalForm) {
                doc.text(company.legalForm, 140, y);
                y += 11;
            }
            if (company.address) {
                doc.text(company.address, 140, y);
                y += 11;
            }
            const contactLine = [company.phone, company.email].filter(Boolean).join(' · ');
            if (contactLine) {
                doc.text(contactLine, 140, y);
                y += 11;
            }
            doc.moveTo(50, 130).lineTo(545, 130).strokeColor('#D1D5DB').stroke();
            // ── Title ─────────────────────────────────────────────────────────────
            const typeLabel = TYPE_LABELS[(data.contractType ?? 'prestation_services').toLowerCase()]
                ?? 'Contrat';
            doc.moveDown(2);
            doc.fontSize(20).fillColor('#0A2A20').font('Helvetica-Bold')
                .text(typeLabel, { align: 'center' });
            doc.moveDown(0.3);
            doc.fontSize(10).fillColor('#5A6B62').font('Helvetica')
                .text(`Destinataire : ${data.signatoryName}  ·  ${data.signatoryEmail}`, { align: 'center' });
            doc.moveDown(1.5);
            // ── Body — render content line by line, preserving simple markdown ────
            doc.fontSize(11).fillColor('#0A2A20');
            const lines = data.contractContent.split(/\r?\n/);
            for (const raw of lines) {
                const line = raw.trimEnd();
                if (!line) {
                    doc.moveDown(0.5);
                    continue;
                }
                // Markdown-ish heading (## / ###)
                const heading = /^(#{1,6})\s+(.*)$/.exec(line);
                if (heading) {
                    const level = heading[1].length;
                    const text = heading[2];
                    doc.moveDown(0.3);
                    doc.font('Helvetica-Bold').fontSize(level === 1 ? 15 : level === 2 ? 13 : 12)
                        .fillColor('#0A4F3C').text(text);
                    doc.moveDown(0.2);
                    doc.font('Helvetica').fontSize(11).fillColor('#0A2A20');
                    continue;
                }
                // Bullet
                if (/^\s*[-*•]\s+/.test(line)) {
                    const text = line.replace(/^\s*[-*•]\s+/, '');
                    doc.text(`• ${text}`, { paragraphGap: 2 });
                    continue;
                }
                // Bold inline (very loose) — just render plain text
                doc.text(line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1'), {
                    paragraphGap: 2,
                });
            }
            // ── Signature block ───────────────────────────────────────────────────
            doc.moveDown(2);
            doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#D1D5DB').stroke();
            doc.moveDown(0.8);
            doc.fontSize(10).fillColor('#0A4F3C').font('Helvetica-Bold').text('Signature électronique');
            doc.fontSize(9).fillColor('#5A6B62').font('Helvetica').moveDown(0.3);
            if (data.signingUrl) {
                doc.fillColor('#0891B2').text('Signez en ligne : ', { continued: true })
                    .fillColor('#0891B2').text(data.signingUrl, { link: data.signingUrl, underline: true });
            }
            if (data.verificationCode) {
                doc.fillColor('#5A6B62').moveDown(0.3)
                    .text(`Code de vérification : ${data.verificationCode}`);
            }
            if (data.expiresAt) {
                doc.fillColor('#5A6B62').moveDown(0.3)
                    .text(`Lien valide jusqu'au : ${new Date(data.expiresAt).toLocaleDateString('fr-FR')}`);
            }
            // ── Footer ────────────────────────────────────────────────────────────
            doc.fontSize(8).fillColor('#94A3A0').moveDown(2)
                .text('Document généré par Orlode AI · Signature sécurisée via Wemas', { align: 'center' });
            doc.end();
        }
        catch (err) {
            reject(err);
        }
    });
}
//# sourceMappingURL=wemasContractPdf.js.map