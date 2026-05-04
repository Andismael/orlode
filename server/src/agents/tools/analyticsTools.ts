/**
 * Analytics Tools for marketplace agents
 * Level 2: Data aggregation from Firestore
 * Level 3: Image analysis via Gemini Vision
 * Level 5: ML analytics (regression, clustering, forecasting)
 */
import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../../config/genkit.config';
import { getFirestore } from '../../config/firebase.config';
import { logger } from '../../utils/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// LEVEL 2: DATA AGGREGATION
// ═══════════════════════════════════════════════════════════════════════════════

export const analyzeDataTool = ai.defineTool(
  {
    name: 'analyzeData',
    description: 'Aggregate and analyze real data from the company database. Returns statistics: totals, averages, trends, top items, distributions. Use this BEFORE giving any statistical insight.',
    inputSchema: z.object({
      companyId: z.string(),
      collection: z.enum([
        'appointments', 'clients', 'inventory', 'quotes', 'alerts',
        'securityChecks', 'installedAgents',
      ]).describe('Which data to analyze'),
      timeRange: z.enum(['today', 'week', 'month', 'quarter', 'year', 'all']).optional(),
      groupBy: z.string().optional().describe('Field to group by (e.g. "service", "status", "category")'),
    }),
    outputSchema: z.object({
      totalRecords: z.number(),
      summary: z.string(),
      stats: z.record(z.unknown()),
    }),
  },
  async (input) => {
    const db = getFirestore();
    const path = `companies/${input.companyId}/${input.collection}`;

    try {
      const snap = await db.collection(path).limit(500).get();
      if (snap.empty) return { totalRecords: 0, summary: `Aucune donnee dans ${input.collection}.`, stats: {} };

      const docs = snap.docs.map(d => d.data());
      const total = docs.length;

      // Time filtering
      let filtered = docs;
      if (input.timeRange && input.timeRange !== 'all') {
        const now = Date.now();
        const ranges: Record<string, number> = {
          today: 86400000, week: 7 * 86400000, month: 30 * 86400000,
          quarter: 90 * 86400000, year: 365 * 86400000,
        };
        const cutoff = now - (ranges[input.timeRange] ?? 0);
        filtered = docs.filter(d => {
          const ts = (d['createdAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ??
                     (d['installedAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
          return ts > cutoff;
        });
      }

      const stats: Record<string, unknown> = {
        total, filtered: filtered.length,
      };

      // Numeric field aggregation
      const numericFields = ['quantity', 'price', 'total', 'trustScore', 'priceUSD', 'amountUSD'];
      for (const field of numericFields) {
        const values = filtered.map(d => d[field] as number).filter(v => typeof v === 'number');
        if (values.length > 0) {
          const sum = values.reduce((a, b) => a + b, 0);
          stats[`${field}_sum`] = Math.round(sum * 100) / 100;
          stats[`${field}_avg`] = Math.round((sum / values.length) * 100) / 100;
          stats[`${field}_min`] = Math.min(...values);
          stats[`${field}_max`] = Math.max(...values);
        }
      }

      // Group by field
      if (input.groupBy) {
        const groups: Record<string, number> = {};
        for (const d of filtered) {
          const key = String(d[input.groupBy] ?? 'unknown');
          groups[key] = (groups[key] ?? 0) + 1;
        }
        stats['groupBy'] = groups;
        stats['topGroup'] = Object.entries(groups).sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'N/A';
      }

      // Status distribution
      const statusDist: Record<string, number> = {};
      for (const d of filtered) {
        const s = String(d['status'] ?? 'unknown');
        statusDist[s] = (statusDist[s] ?? 0) + 1;
      }
      if (Object.keys(statusDist).length > 1) stats['statusDistribution'] = statusDist;

      // Time distribution (by day of week)
      const dayDist: Record<string, number> = { Lun: 0, Mar: 0, Mer: 0, Jeu: 0, Ven: 0, Sam: 0, Dim: 0 };
      const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      for (const d of filtered) {
        const date = (d['createdAt'] as { toDate?: () => Date })?.toDate?.() ?? (d['date'] ? new Date(d['date'] as string) : null);
        if (date) dayDist[dayNames[date.getDay()]] = (dayDist[dayNames[date.getDay()]] ?? 0) + 1;
      }
      stats['byDayOfWeek'] = dayDist;

      const summary = `${input.collection}: ${filtered.length} enregistrements${input.timeRange ? ` (${input.timeRange})` : ''}. ` +
        (stats['total_sum'] ? `Total: $${stats['total_sum']}. ` : '') +
        (stats['topGroup'] ? `Top: ${stats['topGroup']}. ` : '');

      return { totalRecords: filtered.length, summary, stats };
    } catch (err) {
      logger.error('[analyzeData] Failed', { error: err });
      return { totalRecords: 0, summary: `Erreur: ${String(err)}`, stats: {} };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// LEVEL 3: IMAGE ANALYSIS (Gemini Vision)
// ═══════════════════════════════════════════════════════════════════════════════

export const analyzeImageTool = ai.defineTool(
  {
    name: 'analyzePhoto',
    description: 'Analyze a photo/image using AI vision. Use for: plant disease detection, skin analysis, car diagnostics, soil analysis, building inspection, food quality, etc. Pass the image URL or base64.',
    inputSchema: z.object({
      imageUrl: z.string().optional().describe('URL of the image to analyze'),
      imageBase64: z.string().optional().describe('Base64-encoded image data'),
      mimeType: z.string().optional().describe('Image MIME type (image/jpeg, image/png)'),
      analysisType: z.enum([
        'plant_disease', 'skin_analysis', 'car_diagnostic', 'soil_analysis',
        'building_inspection', 'food_quality', 'terrain_analysis', 'general',
      ]).describe('Type of analysis to perform'),
      question: z.string().optional().describe('Specific question about the image'),
    }),
    outputSchema: z.object({
      analysis: z.string(),
      confidence: z.number(),
      recommendations: z.array(z.string()),
    }),
  },
  async (input) => {
    const prompts: Record<string, string> = {
      plant_disease: 'Tu es un agronome expert. Analyse cette image de plante. Identifie: 1) L\'etat general de la plante 2) Toute maladie ou carence visible 3) Les symptomes observes 4) Le traitement recommande. Sois precis et pratique.',
      skin_analysis: 'Tu es un dermatologue expert. Analyse cette image de peau. Identifie: 1) Le type de peau 2) Les problemes visibles (acne, secheresse, taches, rides) 3) Les soins recommandes. Ne pose pas de diagnostic medical definitif.',
      car_diagnostic: 'Tu es un mecanicien expert. Analyse cette image. Identifie: 1) Le probleme visible 2) Les pieces potentiellement affectees 3) La gravite 4) L\'estimation du cout de reparation 5) L\'urgence. Sois technique et precis.',
      soil_analysis: 'Tu es un agronome expert en sols. Analyse cette image de sol. Identifie: 1) Le type de sol 2) La qualite apparente 3) L\'humidite 4) Les cultures adaptees 5) Les amendements recommandes.',
      building_inspection: 'Tu es un expert en batiment. Analyse cette image. Identifie: 1) L\'etat general de la structure 2) Les defauts ou fissures visibles 3) Les risques potentiels 4) Les reparations recommandees.',
      food_quality: 'Tu es un expert en restauration. Analyse cette image d\'aliment. Identifie: 1) La fraicheur 2) La qualite visuelle 3) Les defauts visibles 4) Si c\'est propre a la consommation.',
      terrain_analysis: 'Tu es un geometre expert. Analyse cette image de terrain. Identifie: 1) Le type de terrain 2) La pente approximative 3) La vegetation 4) L\'aptitude a la construction 5) Les contraintes visibles.',
      general: 'Analyse cette image en detail. Decris ce que tu vois et donne des recommandations pertinentes.',
    };

    const systemPrompt = prompts[input.analysisType] ?? prompts['general'];
    const userPrompt = input.question ?? 'Analyse cette image en detail.';

    try {
      // Build content parts
      const contentParts: Array<{ text: string } | { media: { url: string; contentType: string } }> = [];

      if (input.imageBase64) {
        contentParts.push({
          media: {
            url: `data:${input.mimeType ?? 'image/jpeg'};base64,${input.imageBase64}`,
            contentType: input.mimeType ?? 'image/jpeg',
          },
        });
      } else if (input.imageUrl) {
        contentParts.push({
          media: { url: input.imageUrl, contentType: input.mimeType ?? 'image/jpeg' },
        });
      }
      contentParts.push({ text: userPrompt });

      const response = await ai.generate({
        model: GEMINI_FLASH,
        system: systemPrompt,
        messages: [{ role: 'user', content: contentParts }],
        config: { temperature: 0.3 },
      });

      const text = response.text || 'Analyse non disponible.';

      // Extract recommendations (lines starting with - or numbers)
      const lines = text.split('\n');
      const recommendations = lines
        .filter(l => /^[-•\d]/.test(l.trim()))
        .map(l => l.replace(/^[-•\d.)\s]+/, '').trim())
        .filter(l => l.length > 10)
        .slice(0, 5);

      return {
        analysis: text,
        confidence: 0.85,
        recommendations: recommendations.length > 0 ? recommendations : ['Consulter un specialiste pour confirmation'],
      };
    } catch (err) {
      logger.error('[analyzePhoto] Failed', { error: err });
      return {
        analysis: `Erreur d'analyse: ${String(err)}`,
        confidence: 0,
        recommendations: ['Reessayer avec une image plus claire'],
      };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// LEVEL 5 PRO: ML ANALYTICS (pure TypeScript — no external service)
// ═══════════════════════════════════════════════════════════════════════════════

export const predictTrendTool = ai.defineTool(
  {
    name: 'predictTrend',
    description: 'Predict future values using linear regression on historical data. Use for: sales forecasting, demand prediction, growth projections, revenue estimates.',
    inputSchema: z.object({
      companyId: z.string(),
      collection: z.enum(['appointments', 'clients', 'quotes', 'inventory']),
      metric: z.enum(['count', 'total', 'quantity']).describe('What to predict'),
      periodsAhead: z.number().optional().describe('How many periods (days) to predict ahead'),
    }),
    outputSchema: z.object({
      historical: z.array(z.object({ period: z.string(), value: z.number() })),
      predictions: z.array(z.object({ period: z.string(), value: z.number(), confidence: z.number() })),
      trend: z.string(),
      growthRate: z.number(),
      summary: z.string(),
    }),
  },
  async (input) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${input.companyId}/${input.collection}`).limit(1000).get();

    if (snap.empty) {
      return { historical: [], predictions: [], trend: 'no_data', growthRate: 0, summary: 'Pas assez de donnees.' };
    }

    // Group data by day
    const dailyData: Record<string, number> = {};
    for (const doc of snap.docs) {
      const d = doc.data();
      const date = (d['createdAt'] as { toDate?: () => Date })?.toDate?.() ??
                   (d['date'] ? new Date(d['date'] as string) : null);
      if (!date) continue;
      const key = date.toISOString().slice(0, 10);

      if (input.metric === 'count') {
        dailyData[key] = (dailyData[key] ?? 0) + 1;
      } else if (input.metric === 'total') {
        dailyData[key] = (dailyData[key] ?? 0) + ((d['total'] as number) ?? (d['priceUSD'] as number) ?? 0);
      } else {
        dailyData[key] = (dailyData[key] ?? 0) + ((d['quantity'] as number) ?? 1);
      }
    }

    const sorted = Object.entries(dailyData).sort(([a], [b]) => a.localeCompare(b));
    if (sorted.length < 3) {
      return { historical: sorted.map(([p, v]) => ({ period: p, value: v })), predictions: [], trend: 'insufficient_data', growthRate: 0, summary: 'Pas assez de donnees pour predire.' };
    }

    const historical = sorted.map(([p, v]) => ({ period: p, value: v }));

    // ── Linear Regression ──
    const n = sorted.length;
    const xs = sorted.map((_, i) => i);
    const ys = sorted.map(([, v]) => v);
    const xMean = xs.reduce((a, b) => a + b, 0) / n;
    const yMean = ys.reduce((a, b) => a + b, 0) / n;

    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - xMean) * (ys[i] - yMean);
      den += (xs[i] - xMean) ** 2;
    }
    const slope = den !== 0 ? num / den : 0;
    const intercept = yMean - slope * xMean;

    // R² score
    const ssRes = ys.reduce((s, y, i) => s + (y - (slope * xs[i] + intercept)) ** 2, 0);
    const ssTot = ys.reduce((s, y) => s + (y - yMean) ** 2, 0);
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    // Predictions
    const ahead = input.periodsAhead ?? 7;
    const lastDate = new Date(sorted[n - 1][0]);
    const predictions = [];
    for (let i = 1; i <= ahead; i++) {
      const date = new Date(lastDate.getTime() + i * 86400000);
      const predicted = Math.max(0, Math.round((slope * (n + i - 1) + intercept) * 100) / 100);
      predictions.push({
        period: date.toISOString().slice(0, 10),
        value: predicted,
        confidence: Math.max(0.3, Math.min(0.95, r2 - i * 0.05)),
      });
    }

    // Growth rate
    const firstWeek = ys.slice(0, Math.min(7, Math.floor(n / 2)));
    const lastWeek = ys.slice(-Math.min(7, Math.floor(n / 2)));
    const firstAvg = firstWeek.reduce((a, b) => a + b, 0) / firstWeek.length;
    const lastAvg = lastWeek.reduce((a, b) => a + b, 0) / lastWeek.length;
    const growthRate = firstAvg > 0 ? Math.round(((lastAvg - firstAvg) / firstAvg) * 100) : 0;

    const trend = slope > 0.5 ? 'forte_hausse' : slope > 0.1 ? 'hausse' : slope > -0.1 ? 'stable' : slope > -0.5 ? 'baisse' : 'forte_baisse';

    const summary = `Tendance: ${trend} (${growthRate > 0 ? '+' : ''}${growthRate}%). ` +
      `Regression: y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)} (R²=${r2.toFixed(2)}). ` +
      `Prevision J+${ahead}: ${predictions[predictions.length - 1]?.value ?? 0}.`;

    return { historical, predictions, trend, growthRate, summary };
  }
);

export const clusterDataTool = ai.defineTool(
  {
    name: 'clusterData',
    description: 'Group/cluster similar items together using k-means. Use for: client segmentation, product categorization, risk grouping.',
    inputSchema: z.object({
      companyId: z.string(),
      collection: z.enum(['clients', 'inventory', 'quotes', 'appointments']),
      features: z.array(z.string()).describe('Fields to cluster by (e.g. ["totalSpent", "visits"])'),
      k: z.number().optional().describe('Number of clusters (default 3)'),
    }),
    outputSchema: z.object({
      clusters: z.array(z.object({
        id: z.number(),
        label: z.string(),
        size: z.number(),
        centroid: z.record(z.number()),
        items: z.array(z.string()),
      })),
      summary: z.string(),
    }),
  },
  async (input) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${input.companyId}/${input.collection}`).limit(500).get();

    if (snap.size < 3) {
      return { clusters: [], summary: 'Pas assez de donnees pour le clustering.' };
    }

    const k = input.k ?? 3;
    const features = input.features;

    // Extract feature vectors
    const items: { id: string; name: string; vector: number[] }[] = [];
    for (const doc of snap.docs) {
      const d = doc.data();
      const vector = features.map(f => (d[f] as number) ?? 0);
      items.push({ id: doc.id, name: (d['name'] as string) ?? (d['clientName'] as string) ?? doc.id, vector });
    }

    if (items.length < k) {
      return { clusters: [], summary: `Pas assez d'elements (${items.length}) pour ${k} clusters.` };
    }

    // Normalize features
    const mins = features.map((_, fi) => Math.min(...items.map(i => i.vector[fi])));
    const maxs = features.map((_, fi) => Math.max(...items.map(i => i.vector[fi])));
    const normalized = items.map(item => ({
      ...item,
      norm: item.vector.map((v, fi) => maxs[fi] - mins[fi] > 0 ? (v - mins[fi]) / (maxs[fi] - mins[fi]) : 0),
    }));

    // K-Means (simple implementation)
    let centroids = normalized.slice(0, k).map(i => [...i.norm]);
    let assignments = new Array(normalized.length).fill(0);

    for (let iter = 0; iter < 20; iter++) {
      // Assign to nearest centroid
      const newAssignments = normalized.map(item => {
        let minDist = Infinity, best = 0;
        for (let c = 0; c < k; c++) {
          const dist = item.norm.reduce((s, v, fi) => s + (v - centroids[c][fi]) ** 2, 0);
          if (dist < minDist) { minDist = dist; best = c; }
        }
        return best;
      });

      // Check convergence
      if (JSON.stringify(newAssignments) === JSON.stringify(assignments)) break;
      assignments = newAssignments;

      // Recalculate centroids
      for (let c = 0; c < k; c++) {
        const members = normalized.filter((_, i) => assignments[i] === c);
        if (members.length === 0) continue;
        centroids[c] = features.map((_, fi) =>
          members.reduce((s, m) => s + m.norm[fi], 0) / members.length
        );
      }
    }

    // Build cluster results
    const labels = ['Faible', 'Moyen', 'Eleve', 'Premium', 'VIP'];
    const clusters = Array.from({ length: k }, (_, c) => {
      const memberIndices = assignments.map((a, i) => a === c ? i : -1).filter(i => i >= 0);
      const centroidOriginal: Record<string, number> = {};
      features.forEach((f, fi) => {
        const avg = memberIndices.length > 0
          ? memberIndices.reduce((s, i) => s + items[i].vector[fi], 0) / memberIndices.length
          : 0;
        centroidOriginal[f] = Math.round(avg * 100) / 100;
      });

      return {
        id: c,
        label: labels[c] ?? `Groupe ${c + 1}`,
        size: memberIndices.length,
        centroid: centroidOriginal,
        items: memberIndices.slice(0, 10).map(i => items[i].name),
      };
    }).sort((a, b) => {
      const aVal = Object.values(a.centroid).reduce((s, v) => s + v, 0);
      const bVal = Object.values(b.centroid).reduce((s, v) => s + v, 0);
      return aVal - bVal;
    });

    // Relabel after sorting
    clusters.forEach((c, i) => { c.label = labels[i] ?? `Groupe ${i + 1}`; });

    const summary = clusters.map(c =>
      `${c.label} (${c.size} items): ${Object.entries(c.centroid).map(([k, v]) => `${k}=${v}`).join(', ')}`
    ).join(' | ');

    return { clusters, summary };
  }
);

export const detectAnomalTool = ai.defineTool(
  {
    name: 'detectAnomalies',
    description: 'Detect anomalies/outliers in data using statistical methods (z-score). Use for: fraud detection, unusual patterns, quality control.',
    inputSchema: z.object({
      companyId: z.string(),
      collection: z.enum(['appointments', 'clients', 'inventory', 'quotes', 'securityChecks']),
      field: z.string().describe('Numeric field to check for anomalies'),
      threshold: z.number().optional().describe('Z-score threshold (default 2.0)'),
    }),
    outputSchema: z.object({
      anomalies: z.array(z.object({ id: z.string(), value: z.number(), zScore: z.number(), name: z.string() })),
      mean: z.number(),
      stdDev: z.number(),
      summary: z.string(),
    }),
  },
  async (input) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${input.companyId}/${input.collection}`).limit(500).get();

    const values: { id: string; name: string; value: number }[] = [];
    for (const doc of snap.docs) {
      const d = doc.data();
      const v = d[input.field] as number;
      if (typeof v === 'number') {
        values.push({ id: doc.id, name: (d['name'] as string) ?? (d['clientName'] as string) ?? doc.id, value: v });
      }
    }

    if (values.length < 5) {
      return { anomalies: [], mean: 0, stdDev: 0, summary: 'Pas assez de donnees.' };
    }

    const mean = values.reduce((s, v) => s + v.value, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v.value - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const threshold = input.threshold ?? 2.0;
    const anomalies = values
      .map(v => ({ ...v, zScore: stdDev > 0 ? Math.round(((v.value - mean) / stdDev) * 100) / 100 : 0 }))
      .filter(v => Math.abs(v.zScore) > threshold)
      .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

    const summary = `${anomalies.length} anomalie(s) detectee(s) sur ${values.length} elements. ` +
      `Moyenne: ${mean.toFixed(2)}, Ecart-type: ${stdDev.toFixed(2)}. ` +
      (anomalies.length > 0 ? `Plus anormal: ${anomalies[0].name} (z=${anomalies[0].zScore}).` : '');

    return { anomalies: anomalies.slice(0, 10), mean: Math.round(mean * 100) / 100, stdDev: Math.round(stdDev * 100) / 100, summary };
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const ANALYTICS_TOOLS = [
  analyzeDataTool,
  analyzeImageTool,
  predictTrendTool,
  clusterDataTool,
  detectAnomalTool,
];

export const ANALYTICS_TOOL_NAMES = [
  'analyzeData', 'analyzePhoto', 'predictTrend', 'clusterData', 'detectAnomalies',
];
