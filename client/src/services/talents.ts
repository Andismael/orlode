/**
 * Orlode Talents — read-only client for the public talents feed.
 *
 * Talents live in the SAME Firebase project as Orlode (mon-assistant-86bbd),
 * under the `talents_profiles` collection. This client reuses the existing
 * firebase init from services/firebase — no separate Firebase app instance.
 *
 * Surfaced on orlode.com under /talents (landing) and /talents/feed.
 * The full Talents app (signup, video upload, recorder, profile edit) lives
 * at talents.orlode.com (talents-app, separate React project, same backend).
 */
import {
  collection, getDocs, query, where, orderBy, limit as fbLimit,
  doc, getDoc, Timestamp, type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';

export interface Talent {
  id: string;
  displayName: string;
  city?: string;
  country?: string;
  sector?: string;
  skills?: string[];
  tagline?: string;
  videoUrl?: string;
  videoDuration?: number;
  thumbnailUrl?: string;
  status?: 'pending_video' | 'pending_analysis' | 'active' | 'paused' | 'hired';
  language?: string;
  availability?: 'immediate' | '1month' | '3months' | 'open';
  viewsCount?: number;
  contactsCount?: number;
  createdAt?: string;
  publishedAt?: string;
}

const COLLECTION = 'talents_profiles';

function tsToIso(v: unknown): string | undefined {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === 'string') return v;
  return undefined;
}

function fromFirestore(id: string, data: DocumentData): Talent {
  return {
    ...(data as Talent),
    id,
    createdAt: tsToIso(data['createdAt']),
    publishedAt: tsToIso(data['publishedAt']),
  };
}

/** List active talents, newest first. Public, no auth required. */
export async function listActiveTalents(max = 60): Promise<Talent[]> {
  const q = query(
    collection(db, COLLECTION),
    where('status', '==', 'active'),
    orderBy('publishedAt', 'desc'),
    fbLimit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => fromFirestore(d.id, d.data()));
}

/** Single talent by id. */
export async function getTalent(id: string): Promise<Talent | null> {
  const ref = doc(db, COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return fromFirestore(snap.id, snap.data());
}
