/**
 * Orlode Influenceurs — read-only client for the public influencer marketplace.
 *
 * Same Firebase project as Orlode + Talents. Influencers live under
 * `influencers_profiles` so the schema is similar (one collection per
 * vertical, indexed by status + lastActiveAt).
 *
 * Surfaced on orlode.com under /influenceurs (landing) and
 * /influenceurs/feed. Full hub (deal flow, messaging, admin) would live
 * at influenceurs.orlode.com once the standalone app is built.
 */
import {
  collection, getDocs, query, where, orderBy, limit as fbLimit,
  doc, getDoc, Timestamp, type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';

export interface InfluencerAudience {
  total?: number;
  instagram?: number;
  tiktok?: number;
  youtube?: number;
  twitter?: number;
  facebook?: number;
}

export interface InfluencerSocialLink {
  url: string;
  followers: number;
  lastUpdatedAt?: string | null;
}

export interface Influencer {
  id: string;
  displayName: string;
  handle?: string;            // @aissatou.styles
  verified?: boolean;
  bio?: string;
  city?: string;
  country?: string;
  categories?: string[];      // ['Mode', 'Lifestyle']
  audience?: InfluencerAudience;
  /** Creator-managed direct links per platform — brands click to verify
   *  themselves on the actual platform. Source of truth lives in
   *  InfluencersLinksPage. */
  socialLinks?: Record<string, InfluencerSocialLink>;
  engagement?: number;        // % engagement rate
  rating?: number;
  completedDeals?: number;
  responseTime?: string;      // "< 2h"
  collabTypes?: string[];     // ['Post Instagram', 'Story', 'Reels']
  languages?: string[];
  avatarUrl?: string;
  coverUrl?: string;
  status?: 'active' | 'busy' | 'paused' | 'hired';
  createdAt?: string;
  lastActiveAt?: string;
}

const COLLECTION = 'influencers_profiles';

function tsToIso(v: unknown): string | undefined {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === 'string') return v;
  return undefined;
}

function fromFirestore(id: string, data: DocumentData): Influencer {
  return {
    ...(data as Influencer),
    id,
    createdAt: tsToIso(data['createdAt']),
    lastActiveAt: tsToIso(data['lastActiveAt']),
  };
}

/** List active influencers, most recently active first. Public, no auth. */
export async function listActiveInfluencers(max = 60): Promise<Influencer[]> {
  const q = query(
    collection(db, COLLECTION),
    where('status', '==', 'active'),
    orderBy('lastActiveAt', 'desc'),
    fbLimit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => fromFirestore(d.id, d.data()));
}

/** Single influencer by id. */
export async function getInfluencer(id: string): Promise<Influencer | null> {
  const ref = doc(db, COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return fromFirestore(snap.id, snap.data());
}

/** Pretty-print large audience numbers: 145000 → "145k", 1200000 → "1.2M". */
export function formatAudience(n?: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}k`;
  return n.toString();
}
