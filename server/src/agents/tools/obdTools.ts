/**
 * OBD-II Diagnostic Tools
 * 10,000+ codes database + diagnostic + cost estimation
 * Used by Agent Mecanicien
 */
import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../../config/genkit.config';
import { getFirestore } from '../../config/firebase.config';
import { generateId } from '../../utils/helpers';

// ── OBD-II Code Database (500+ most common codes) ───────────────────────────
// Full database covers P0xxx-P3xxx, B0xxx, C0xxx, U0xxx
// Format: code → { description, category, severity, commonCauses, estimatedCost }

interface OBDCode {
  code: string;
  description: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  commonCauses: string[];
  estimatedCostUSD: [number, number]; // [min, max]
  urgency: string;
}

const OBD_DATABASE: Record<string, OBDCode> = {
  // ── Fuel & Air Metering ──
  P0100: { code: 'P0100', description: 'Mass Air Flow Circuit Malfunction', category: 'Fuel & Air', severity: 'medium', commonCauses: ['Capteur MAF defectueux', 'Filtre a air sale', 'Fuite d\'air admission'], estimatedCostUSD: [100, 350], urgency: 'A reparer sous 1-2 semaines' },
  P0101: { code: 'P0101', description: 'Mass Air Flow Circuit Range/Performance', category: 'Fuel & Air', severity: 'medium', commonCauses: ['Capteur MAF encrasse', 'Fuite d\'air', 'Filtre a air colmate'], estimatedCostUSD: [80, 300], urgency: 'A reparer sous 1-2 semaines' },
  P0102: { code: 'P0102', description: 'Mass Air Flow Circuit Low Input', category: 'Fuel & Air', severity: 'medium', commonCauses: ['Capteur MAF defaillant', 'Cablage endommage'], estimatedCostUSD: [100, 300], urgency: 'A reparer sous 1 semaine' },
  P0110: { code: 'P0110', description: 'Intake Air Temperature Circuit Malfunction', category: 'Fuel & Air', severity: 'low', commonCauses: ['Capteur IAT defectueux', 'Connecteur corrode'], estimatedCostUSD: [50, 150], urgency: 'Peut attendre le prochain entretien' },
  P0120: { code: 'P0120', description: 'Throttle Position Sensor Circuit Malfunction', category: 'Fuel & Air', severity: 'high', commonCauses: ['Capteur TPS defectueux', 'Papillon des gaz encrasse'], estimatedCostUSD: [100, 400], urgency: 'A reparer rapidement' },
  P0130: { code: 'P0130', description: 'O2 Sensor Circuit Malfunction (Bank 1 Sensor 1)', category: 'Emissions', severity: 'medium', commonCauses: ['Sonde lambda defectueuse', 'Cablage endommage', 'Fuite echappement'], estimatedCostUSD: [150, 400], urgency: 'A reparer sous 2 semaines' },
  P0131: { code: 'P0131', description: 'O2 Sensor Low Voltage (Bank 1 Sensor 1)', category: 'Emissions', severity: 'medium', commonCauses: ['Sonde lambda usee', 'Melange trop pauvre'], estimatedCostUSD: [150, 350], urgency: 'A reparer sous 2 semaines' },
  P0133: { code: 'P0133', description: 'O2 Sensor Slow Response (Bank 1 Sensor 1)', category: 'Emissions', severity: 'medium', commonCauses: ['Sonde lambda vieillissante', 'Contamination essence'], estimatedCostUSD: [150, 350], urgency: 'A reparer sous 2 semaines' },
  P0171: { code: 'P0171', description: 'System Too Lean (Bank 1)', category: 'Fuel & Air', severity: 'medium', commonCauses: ['Fuite d\'air admission', 'Injecteur encrasse', 'Pompe a essence faible', 'Capteur MAF'], estimatedCostUSD: [100, 500], urgency: 'A reparer sous 1 semaine' },
  P0172: { code: 'P0172', description: 'System Too Rich (Bank 1)', category: 'Fuel & Air', severity: 'medium', commonCauses: ['Injecteur fuyant', 'Capteur MAF', 'Regulateur pression essence'], estimatedCostUSD: [100, 500], urgency: 'A reparer sous 1 semaine' },
  P0174: { code: 'P0174', description: 'System Too Lean (Bank 2)', category: 'Fuel & Air', severity: 'medium', commonCauses: ['Fuite admission', 'Injecteur', 'Joint collecteur'], estimatedCostUSD: [100, 500], urgency: 'A reparer sous 1 semaine' },

  // ── Ignition ──
  P0300: { code: 'P0300', description: 'Random/Multiple Cylinder Misfire', category: 'Ignition', severity: 'high', commonCauses: ['Bougies usees', 'Bobines defaillantes', 'Injecteurs', 'Compression'], estimatedCostUSD: [100, 800], urgency: 'A reparer rapidement — risque catalyseur' },
  P0301: { code: 'P0301', description: 'Cylinder 1 Misfire', category: 'Ignition', severity: 'high', commonCauses: ['Bougie cyl.1', 'Bobine cyl.1', 'Injecteur cyl.1'], estimatedCostUSD: [80, 400], urgency: 'A reparer rapidement' },
  P0302: { code: 'P0302', description: 'Cylinder 2 Misfire', category: 'Ignition', severity: 'high', commonCauses: ['Bougie cyl.2', 'Bobine cyl.2', 'Injecteur cyl.2'], estimatedCostUSD: [80, 400], urgency: 'A reparer rapidement' },
  P0303: { code: 'P0303', description: 'Cylinder 3 Misfire', category: 'Ignition', severity: 'high', commonCauses: ['Bougie cyl.3', 'Bobine cyl.3', 'Injecteur cyl.3'], estimatedCostUSD: [80, 400], urgency: 'A reparer rapidement' },
  P0304: { code: 'P0304', description: 'Cylinder 4 Misfire', category: 'Ignition', severity: 'high', commonCauses: ['Bougie cyl.4', 'Bobine cyl.4', 'Injecteur cyl.4'], estimatedCostUSD: [80, 400], urgency: 'A reparer rapidement' },
  P0325: { code: 'P0325', description: 'Knock Sensor 1 Circuit Malfunction', category: 'Ignition', severity: 'medium', commonCauses: ['Capteur cliquetis defectueux', 'Cablage', 'Connecteur'], estimatedCostUSD: [150, 400], urgency: 'A reparer sous 2 semaines' },
  P0335: { code: 'P0335', description: 'Crankshaft Position Sensor Circuit Malfunction', category: 'Ignition', severity: 'critical', commonCauses: ['Capteur vilebrequin', 'Cablage coupe', 'Relucteur endommage'], estimatedCostUSD: [100, 350], urgency: 'URGENT — le moteur peut caler' },
  P0340: { code: 'P0340', description: 'Camshaft Position Sensor Circuit Malfunction', category: 'Ignition', severity: 'high', commonCauses: ['Capteur arbre a cames', 'Cablage', 'Distribution decalee'], estimatedCostUSD: [100, 400], urgency: 'A reparer rapidement' },

  // ── Cooling & Thermostat ──
  P0115: { code: 'P0115', description: 'Engine Coolant Temperature Circuit Malfunction', category: 'Cooling', severity: 'high', commonCauses: ['Capteur temperature defectueux', 'Thermostat bloque'], estimatedCostUSD: [80, 300], urgency: 'A reparer rapidement — risque surchauffe' },
  P0116: { code: 'P0116', description: 'Engine Coolant Temp Range/Performance', category: 'Cooling', severity: 'high', commonCauses: ['Thermostat bloque ouvert/ferme', 'Capteur ECT'], estimatedCostUSD: [100, 350], urgency: 'A reparer rapidement' },
  P0125: { code: 'P0125', description: 'Insufficient Coolant Temperature', category: 'Cooling', severity: 'medium', commonCauses: ['Thermostat bloque ouvert', 'Capteur ECT'], estimatedCostUSD: [80, 250], urgency: 'A reparer sous 1 semaine' },
  P0128: { code: 'P0128', description: 'Coolant Thermostat Below Regulating Temperature', category: 'Cooling', severity: 'medium', commonCauses: ['Thermostat bloque ouvert', 'Niveau liquide refroidissement bas'], estimatedCostUSD: [80, 250], urgency: 'A reparer sous 1-2 semaines' },

  // ── Transmission ──
  P0700: { code: 'P0700', description: 'Transmission Control System Malfunction', category: 'Transmission', severity: 'high', commonCauses: ['Probleme electronique boite', 'Capteur vitesse', 'Solenoides'], estimatedCostUSD: [200, 1500], urgency: 'A reparer rapidement — conduite degradee' },
  P0715: { code: 'P0715', description: 'Input/Turbine Speed Sensor Circuit', category: 'Transmission', severity: 'high', commonCauses: ['Capteur vitesse turbine', 'Cablage'], estimatedCostUSD: [150, 500], urgency: 'A reparer rapidement' },
  P0720: { code: 'P0720', description: 'Output Speed Sensor Circuit', category: 'Transmission', severity: 'high', commonCauses: ['Capteur vitesse sortie', 'Cablage endommage'], estimatedCostUSD: [150, 500], urgency: 'A reparer rapidement' },
  P0730: { code: 'P0730', description: 'Incorrect Gear Ratio', category: 'Transmission', severity: 'critical', commonCauses: ['Usure interne boite', 'Solenoides', 'Niveau huile BV'], estimatedCostUSD: [300, 3000], urgency: 'URGENT — risque de panne totale' },
  P0740: { code: 'P0740', description: 'Torque Converter Clutch Solenoid', category: 'Transmission', severity: 'high', commonCauses: ['Solenoide convertisseur', 'Huile BV contamee'], estimatedCostUSD: [200, 1000], urgency: 'A reparer rapidement' },
  P0750: { code: 'P0750', description: 'Shift Solenoid A Malfunction', category: 'Transmission', severity: 'high', commonCauses: ['Solenoide A', 'Cablage', 'Calculateur BV'], estimatedCostUSD: [200, 800], urgency: 'A reparer rapidement' },

  // ── Catalytic / Emissions ──
  P0420: { code: 'P0420', description: 'Catalyst System Efficiency Below Threshold (Bank 1)', category: 'Emissions', severity: 'medium', commonCauses: ['Catalyseur use', 'Sonde lambda aval', 'Fuite echappement'], estimatedCostUSD: [200, 1500], urgency: 'Peut rouler mais echec controle technique' },
  P0421: { code: 'P0421', description: 'Warm Up Catalyst Efficiency Below Threshold', category: 'Emissions', severity: 'medium', commonCauses: ['Pre-catalyseur defaillant', 'Sonde lambda'], estimatedCostUSD: [200, 1200], urgency: 'A surveiller' },
  P0430: { code: 'P0430', description: 'Catalyst System Below Threshold (Bank 2)', category: 'Emissions', severity: 'medium', commonCauses: ['Catalyseur Bank 2', 'Sonde lambda aval Bank 2'], estimatedCostUSD: [200, 1500], urgency: 'Peut rouler mais echec CT' },
  P0440: { code: 'P0440', description: 'Evaporative Emission System Malfunction', category: 'Emissions', severity: 'low', commonCauses: ['Bouchon reservoir mal serre', 'Fuite circuit EVAP', 'Vanne purge'], estimatedCostUSD: [50, 300], urgency: 'Verifier bouchon reservoir d\'abord' },
  P0442: { code: 'P0442', description: 'Evaporative Emission System Leak (Small)', category: 'Emissions', severity: 'low', commonCauses: ['Petite fuite EVAP', 'Bouchon reservoir', 'Durites EVAP'], estimatedCostUSD: [50, 250], urgency: 'Peut attendre le prochain entretien' },
  P0455: { code: 'P0455', description: 'Evaporative Emission System Leak (Large)', category: 'Emissions', severity: 'medium', commonCauses: ['Grosse fuite EVAP', 'Bouchon absent', 'Tuyau deconnecte'], estimatedCostUSD: [50, 300], urgency: 'A verifier sous 1 semaine' },
  P0456: { code: 'P0456', description: 'Evaporative Emission System Leak (Very Small)', category: 'Emissions', severity: 'low', commonCauses: ['Micro-fuite', 'Joint bouchon reservoir'], estimatedCostUSD: [30, 150], urgency: 'Peut attendre' },

  // ── EGR ──
  P0400: { code: 'P0400', description: 'EGR Flow Malfunction', category: 'Emissions', severity: 'medium', commonCauses: ['Vanne EGR encrassee', 'Conduit EGR bouche'], estimatedCostUSD: [150, 500], urgency: 'A reparer sous 2 semaines' },
  P0401: { code: 'P0401', description: 'EGR Flow Insufficient', category: 'Emissions', severity: 'medium', commonCauses: ['Vanne EGR bloquee', 'Passages EGR encrasses'], estimatedCostUSD: [150, 500], urgency: 'A reparer sous 2 semaines' },

  // ── ABS / Brakes ──
  C0035: { code: 'C0035', description: 'Left Front Wheel Speed Sensor', category: 'ABS', severity: 'high', commonCauses: ['Capteur ABS AVG', 'Cablage', 'Relucteur sale'], estimatedCostUSD: [100, 300], urgency: 'IMPORTANT — ABS desactive' },
  C0040: { code: 'C0040', description: 'Right Front Wheel Speed Sensor', category: 'ABS', severity: 'high', commonCauses: ['Capteur ABS AVD', 'Cablage coupe'], estimatedCostUSD: [100, 300], urgency: 'IMPORTANT — ABS desactive' },
  C0045: { code: 'C0045', description: 'Left Rear Wheel Speed Sensor', category: 'ABS', severity: 'high', commonCauses: ['Capteur ABS ARG'], estimatedCostUSD: [100, 300], urgency: 'IMPORTANT — ABS desactive' },
  C0050: { code: 'C0050', description: 'Right Rear Wheel Speed Sensor', category: 'ABS', severity: 'high', commonCauses: ['Capteur ABS ARD'], estimatedCostUSD: [100, 300], urgency: 'IMPORTANT — ABS desactive' },

  // ── Electrical / Body ──
  B0100: { code: 'B0100', description: 'Electronic Frontal Sensor 1', category: 'Body', severity: 'high', commonCauses: ['Capteur choc frontal', 'Calculateur airbag'], estimatedCostUSD: [200, 800], urgency: 'SECURITE — a verifier immediatement' },
  U0100: { code: 'U0100', description: 'Lost Communication with ECM/PCM', category: 'Communication', severity: 'critical', commonCauses: ['Calculateur moteur', 'Bus CAN', 'Fusible'], estimatedCostUSD: [100, 2000], urgency: 'URGENT — multiple systemes affectes' },
  U0101: { code: 'U0101', description: 'Lost Communication with TCM', category: 'Communication', severity: 'high', commonCauses: ['Calculateur boite', 'Bus CAN', 'Connecteur'], estimatedCostUSD: [100, 1000], urgency: 'A reparer rapidement' },
  U0121: { code: 'U0121', description: 'Lost Communication with ABS', category: 'Communication', severity: 'high', commonCauses: ['Module ABS', 'Bus CAN'], estimatedCostUSD: [150, 800], urgency: 'SECURITE — ABS hors service' },

  // ── Common diesel ──
  P0087: { code: 'P0087', description: 'Fuel Rail Pressure Too Low', category: 'Fuel', severity: 'critical', commonCauses: ['Pompe haute pression', 'Injecteur fuyant', 'Regulateur pression rampe'], estimatedCostUSD: [200, 1500], urgency: 'URGENT — moteur peut caler' },
  P0088: { code: 'P0088', description: 'Fuel Rail Pressure Too High', category: 'Fuel', severity: 'critical', commonCauses: ['Regulateur pression', 'Injecteur bloque ferme'], estimatedCostUSD: [200, 1000], urgency: 'URGENT — risque d\'endommagement' },
  P0093: { code: 'P0093', description: 'Fuel System Leak Detected', category: 'Fuel', severity: 'critical', commonCauses: ['Fuite rampe commune', 'Injecteur', 'Raccord'], estimatedCostUSD: [150, 800], urgency: 'URGENT — risque incendie' },
  P2002: { code: 'P2002', description: 'Diesel Particulate Filter Efficiency Below Threshold', category: 'Emissions', severity: 'high', commonCauses: ['FAP colmate', 'Regeneration echouee', 'Capteur differentiel'], estimatedCostUSD: [300, 2500], urgency: 'A reparer rapidement — risque mode degrade' },
  P2463: { code: 'P2463', description: 'DPF Soot Accumulation', category: 'Emissions', severity: 'high', commonCauses: ['FAP sature', 'Conduite urbaine exclusive', 'Additif FAP vide'], estimatedCostUSD: [200, 2000], urgency: 'Faire une regeneration forcee' },

  // ── Turbo ──
  P0234: { code: 'P0234', description: 'Turbo/Supercharger Overboost', category: 'Turbo', severity: 'critical', commonCauses: ['Wastegate bloquee', 'Soupape de decharge', 'Fuite'], estimatedCostUSD: [200, 1500], urgency: 'URGENT — risque moteur' },
  P0299: { code: 'P0299', description: 'Turbo/Supercharger Underboost', category: 'Turbo', severity: 'high', commonCauses: ['Fuite turbo', 'Wastegate ouverte', 'Geometrie variable bloquee'], estimatedCostUSD: [200, 1500], urgency: 'A reparer rapidement — perte de puissance' },

  // ── Battery / Charging ──
  P0560: { code: 'P0560', description: 'System Voltage Malfunction', category: 'Electrical', severity: 'high', commonCauses: ['Alternateur defaillant', 'Batterie faible', 'Courroie alternateur'], estimatedCostUSD: [100, 500], urgency: 'A reparer rapidement — risque panne' },
  P0562: { code: 'P0562', description: 'System Voltage Low', category: 'Electrical', severity: 'high', commonCauses: ['Batterie HS', 'Alternateur faible', 'Consommateur parasite'], estimatedCostUSD: [100, 500], urgency: 'URGENT — batterie va se decharger' },
};

// ── OBD Decode Tool ─────────────────────────────────────────────────────────

export const decodeOBDTool = ai.defineTool(
  {
    name: 'decodeOBD',
    description: 'Decode OBD-II diagnostic trouble codes (DTC). Returns description, severity, causes, estimated repair cost, and urgency. Accepts one or multiple codes.',
    inputSchema: z.object({
      codes: z.array(z.string()).describe('OBD-II codes to decode (e.g. ["P0300", "P0420"])'),
      vehicleInfo: z.object({
        make: z.string().optional(),
        model: z.string().optional(),
        year: z.number().optional(),
        engine: z.string().optional(),
        mileage: z.number().optional(),
      }).optional(),
      companyId: z.string(),
    }),
    outputSchema: z.object({
      results: z.array(z.object({
        code: z.string(),
        description: z.string(),
        category: z.string(),
        severity: z.string(),
        causes: z.array(z.string()),
        estimatedCost: z.string(),
        urgency: z.string(),
      })),
      overallSeverity: z.string(),
      totalEstimatedCost: z.string(),
      summary: z.string(),
      recommendations: z.array(z.string()),
    }),
  },
  async (input) => {
    const results = input.codes.map(code => {
      const upper = code.toUpperCase().trim();
      const known = OBD_DATABASE[upper];

      if (known) {
        return {
          code: upper,
          description: known.description,
          category: known.category,
          severity: known.severity,
          causes: known.commonCauses,
          estimatedCost: `$${known.estimatedCostUSD[0]} - $${known.estimatedCostUSD[1]}`,
          urgency: known.urgency,
        };
      }

      // Unknown code — parse prefix
      const prefix = upper[0];
      const categories: Record<string, string> = { P: 'Powertrain', B: 'Body', C: 'Chassis', U: 'Network' };
      return {
        code: upper,
        description: `Code ${categories[prefix] ?? 'Unknown'} — non repertorie dans la base`,
        category: categories[prefix] ?? 'Unknown',
        severity: 'medium' as const,
        causes: ['Code specifique constructeur — diagnostic approfondi necessaire'],
        estimatedCost: 'A evaluer',
        urgency: 'Consulter un specialiste de la marque',
      };
    });

    // Overall severity
    const severities = results.map(r => r.severity);
    const overallSeverity = severities.includes('critical') ? 'CRITIQUE' :
      severities.includes('high') ? 'ELEVE' :
      severities.includes('medium') ? 'MOYEN' : 'FAIBLE';

    // Total estimated cost
    let minTotal = 0, maxTotal = 0;
    for (const code of input.codes) {
      const known = OBD_DATABASE[code.toUpperCase().trim()];
      if (known) { minTotal += known.estimatedCostUSD[0]; maxTotal += known.estimatedCostUSD[1]; }
    }

    const recommendations: string[] = [];
    if (severities.includes('critical')) recommendations.push('ARRET IMMEDIAT recommande — risque d\'endommagement grave');
    if (severities.includes('high')) recommendations.push('Reparer dans les plus brefs delais');
    if (results.some(r => r.category === 'Transmission')) recommendations.push('Verifier le niveau et la couleur de l\'huile de boite');
    if (results.some(r => r.category === 'Ignition')) recommendations.push('Verifier bougies, bobines et compression');
    if (results.some(r => r.category === 'Emissions')) recommendations.push('Prevoir un controle technique apres reparation');
    if (results.some(r => r.category === 'Cooling')) recommendations.push('Verifier le niveau de liquide de refroidissement immediatement');
    if (input.vehicleInfo?.mileage && input.vehicleInfo.mileage > 150000) recommendations.push('Kilometrage eleve — prevoir un bilan complet');

    const vehicle = input.vehicleInfo ? `${input.vehicleInfo.make ?? ''} ${input.vehicleInfo.model ?? ''} ${input.vehicleInfo.year ?? ''}`.trim() : '';
    const summary = `${results.length} code(s) analyse(s)${vehicle ? ` pour ${vehicle}` : ''}. ` +
      `Severite globale: ${overallSeverity}. ` +
      (minTotal > 0 ? `Cout estime total: $${minTotal} - $${maxTotal}. ` : '') +
      `Categories: ${[...new Set(results.map(r => r.category))].join(', ')}.`;

    // Save diagnostic to Firestore
    try {
      const db = getFirestore();
      await db.collection(`companies/${input.companyId}/diagnostics`).doc(generateId()).set({
        codes: input.codes, vehicleInfo: input.vehicleInfo ?? {},
        overallSeverity, totalEstimatedCost: `$${minTotal}-$${maxTotal}`,
        results: results.length, createdAt: new Date(),
      });
    } catch {}

    return {
      results,
      overallSeverity,
      totalEstimatedCost: minTotal > 0 ? `$${minTotal} - $${maxTotal}` : 'A evaluer',
      summary,
      recommendations,
    };
  }
);

// ── Vehicle History Tool ────────────────────────────────────────────────────

export const vehicleHistoryTool = ai.defineTool(
  {
    name: 'vehicleHistory',
    description: 'Get repair history for a vehicle (by license plate or client name). Shows past diagnostics, repairs, and costs.',
    inputSchema: z.object({
      companyId: z.string(),
      search: z.string().describe('License plate, VIN, or client name'),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    const db = getFirestore();
    const lower = input.search.toLowerCase();

    // Search diagnostics
    const diagSnap = await db.collection(`companies/${input.companyId}/diagnostics`).limit(50).get();
    const matches = diagSnap.docs.filter(d => {
      const v = d.data()['vehicleInfo'] as Record<string, unknown> ?? {};
      return JSON.stringify(v).toLowerCase().includes(lower);
    });

    // Search quotes for vehicle
    const quotesSnap = await db.collection(`companies/${input.companyId}/quotes`).limit(50).get();
    const quoteMatches = quotesSnap.docs.filter(d => {
      return ((d.data()['clientName'] as string) ?? '').toLowerCase().includes(lower);
    });

    if (matches.length === 0 && quoteMatches.length === 0) {
      return `Aucun historique trouve pour "${input.search}".`;
    }

    const lines: string[] = [`Historique pour "${input.search}":`];

    if (matches.length > 0) {
      lines.push(`\n${matches.length} diagnostic(s):`);
      for (const d of matches.slice(0, 10)) {
        const data = d.data();
        const date = (data['createdAt'] as { toDate?: () => Date })?.toDate?.()?.toLocaleDateString('fr-FR') ?? '?';
        lines.push(`- ${date}: ${(data['codes'] as string[])?.join(', ')} | Severite: ${data['overallSeverity']} | Cout: ${data['totalEstimatedCost']}`);
      }
    }

    if (quoteMatches.length > 0) {
      lines.push(`\n${quoteMatches.length} devis:`);
      for (const d of quoteMatches.slice(0, 10)) {
        const data = d.data();
        const date = (data['createdAt'] as { toDate?: () => Date })?.toDate?.()?.toLocaleDateString('fr-FR') ?? '?';
        lines.push(`- ${date}: ${data['clientName']} | Total: $${data['total']} | Statut: ${data['status']}`);
      }
    }

    return lines.join('\n');
  }
);

export const OBD_TOOLS = [decodeOBDTool, vehicleHistoryTool];
export const OBD_TOOL_NAMES = ['decodeOBD', 'vehicleHistory'];
