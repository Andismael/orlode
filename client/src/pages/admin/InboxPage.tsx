/**
 * InboxPage — /admin/inbox
 *
 * Unified WhatsApp + Telegram inbox accessible from anywhere in the admin.
 * Wraps the existing <InboxTab /> component (shared with each pack admin page)
 * with the AdminLayout chrome and a small header strip pointing to the
 * per-channel configuration pages.
 *
 * Why this page exists: the sidebar entries "WhatsApp" / "Telegram" used to
 * go straight to the configuration pages (tokens, webhooks, templates), which
 * is rarely what a merchant wants when they hear "open my inbox". This page
 * is the new front door — actual conversations and contacts. Configuration
 * stays one click away.
 */
import { Link } from 'react-router-dom';
import { Inbox, Settings, MessageCircle, Send } from 'lucide-react';
import { InboxTab } from '@/components/inbox/InboxTab';

const C = {
  cream: '#FFFAF0',
  creamDeep: '#F5EDD6',
  ink: '#1F2937',
  inkSoft: '#4B5563',
  inkLight: '#9CA3AF',
  greenDeep: '#0A4F3C',
  greenDark: '#063D2E',
  wa: '#25D366', waDeep: '#128C7E',
  tg: '#0088CC', tgDeep: '#006699',
  emerald: '#10B981',
};

export default function InboxPage() {
  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, minHeight: '100vh', background: '#FAF6EE' }}>
      {/* Header */}
      <div style={{
        position: 'relative',
        background: `linear-gradient(135deg, ${C.greenDeep} 0%, ${C.greenDark} 50%, ${C.waDeep} 130%)`,
        borderRadius: 20, padding: '20px 24px',
        overflow: 'hidden',
        border: `1px solid ${C.emerald}40`,
        boxShadow: `0 16px 40px -16px ${C.greenDeep}`,
      }}>
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#A8C9B8', letterSpacing: '0.08em', marginBottom: 4 }}>
              <Inbox size={11} style={{ display: 'inline', verticalAlign: -1, marginRight: 6 }} />
              MESSAGERIE UNIFIÉE
            </div>
            <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
              Tous tes messages <em style={{ fontStyle: 'italic', color: '#FCD34D' }}>en un seul endroit</em>
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,250,240,.85)', margin: '6px 0 0' }}>
              WhatsApp Business + Telegram Bot · réponds depuis l'app où le contact a écrit.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/admin/whatsapp" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 10,
              background: 'rgba(255,255,255,.12)', color: C.cream,
              border: '1px solid rgba(255,255,255,.2)',
              fontSize: 12, fontWeight: 700, textDecoration: 'none',
              backdropFilter: 'blur(10px)',
            }}>
              <Settings size={12} /> Config WhatsApp
            </Link>
            <Link to="/admin/telegram" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 10,
              background: 'rgba(255,255,255,.12)', color: C.cream,
              border: '1px solid rgba(255,255,255,.2)',
              fontSize: 12, fontWeight: 700, textDecoration: 'none',
              backdropFilter: 'blur(10px)',
            }}>
              <Settings size={12} /> Config Telegram
            </Link>
          </div>
        </div>
      </div>

      {/* The unified inbox (same component used inside every pack page) */}
      <InboxTab
        accent={C.greenDeep}
        accentDeep={C.greenDark}
        ink={C.ink} inkSoft={C.inkSoft} inkLight={C.inkLight}
        cream={C.cream} creamDeep={C.creamDeep}
        emptyHint="Dès qu'un contact t'écrit sur WhatsApp ou Telegram, sa conversation apparaît ici. Pas besoin de t'éparpiller entre 5 onglets."
      />
    </div>
  );
}
