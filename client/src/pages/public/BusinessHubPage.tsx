/**
 * BusinessHubPage — Public landing/home for a company's installable PWA.
 *
 * URL : /business/:companyId
 *
 * This is what customers see when they tap the installed app icon on their
 * home screen. Aggregates every customer-facing service the merchant has
 * configured (chat IA, shop, menu, hotel, salon, cabinet, immobilier,
 * résidence, WhatsApp direct, adresse) into a single beautiful grid.
 *
 * Loads /api/business/:companyId to know which services are active for
 * this specific company. Wires PerCompanyPWAHead so installing FROM the
 * hub registers the per-company PWA with start_url back to /business/:id
 * (= self).
 */
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Loader2, AlertCircle, MapPin, ArrowRight, ExternalLink, Sparkles,
} from 'lucide-react';
import PerCompanyPWAHead from '@/components/common/PerCompanyPWAHead';

const publicApi = axios.create({ baseURL: '/api', timeout: 20000 });

interface Service {
  type: string;
  emoji: string;
  label: string;
  description?: string | null;
  url?: string | null;
  external?: boolean;
  primary?: boolean;
  storeName?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
}

interface BusinessData {
  company: {
    id: string;
    name: string;
    logoUrl: string | null;
    pwaLogoUrl: string | null;
    primaryColor: string;
    tagline: string | null;
    city: string | null;
    country: string | null;
  };
  services: Service[];
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');
  .biz { font-family: 'Inter', system-ui, sans-serif; color: #0A1410; -webkit-font-smoothing: antialiased; }
  .biz-serif { font-family: 'Fraunces', serif; letter-spacing: -0.025em; }
  .biz-mono { font-family: 'JetBrains Mono', monospace; }
  @keyframes biz-fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  .biz-fade { animation: biz-fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) backwards; }
  .biz-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .biz-card:hover { transform: translateY(-4px); }
  @media (max-width: 700px) {
    .biz-grid { grid-template-columns: 1fr !important; }
  }
`;

export default function BusinessHubPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [data, setData] = useState<BusinessData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    publicApi.get<{ success: boolean; company: BusinessData['company']; services: Service[] }>(`/business/${companyId}`)
      .then(r => setData({ company: r.data.company, services: r.data.services ?? [] }))
      .catch((e: unknown) => {
        const err = e as { response?: { status?: number }; message?: string };
        setError(err.response?.status === 404 ? 'Entreprise introuvable' : (err.message ?? 'Erreur de chargement'));
      });
  }, [companyId]);

  if (error) {
    return (
      <div className="biz" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF7F2', padding: 24 }}>
        <style>{STYLES}</style>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <AlertCircle size={32} color="#DC2626" style={{ marginBottom: 12 }} />
          <div className="biz-serif" style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
            {error}
          </div>
          <p style={{ fontSize: 13, color: '#5C6B62', margin: 0 }}>
            Vérifie le lien ou contacte l'entreprise directement.
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="biz" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF7F2' }}>
        <style>{STYLES}</style>
        <Loader2 className="animate-spin" size={26} color="#0F5C3F" />
      </div>
    );
  }

  const { company, services } = data;
  const primary = company.primaryColor || '#0F5C3F';
  const logo = company.pwaLogoUrl || company.logoUrl;
  const initial = (company.name.charAt(0) || '?').toUpperCase();

  return (
    <div className="biz" style={{ minHeight: '100vh', background: '#FAF7F2' }}>
      <style>{STYLES}</style>

      <PerCompanyPWAHead
        companyId={companyId!}
        companyName={company.name}
        logoUrl={logo ?? undefined}
        primaryColor={primary}
      />

      {/* Hero */}
      <section style={{
        background: `linear-gradient(155deg, ${primary} 0%, ${primary}cc 60%, ${primary}aa 100%)`,
        color: '#FFFFFF',
        padding: '60px 24px 80px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`,
          opacity: 0.06, mixBlendMode: 'overlay', pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative', zIndex: 2, textAlign: 'center' }}>
          {logo ? (
            <img
              src={logo}
              alt={company.name}
              style={{
                width: 96, height: 96, borderRadius: 24,
                objectFit: 'cover',
                border: '3px solid rgba(255,255,255,0.25)',
                boxShadow: '0 12px 40px -8px rgba(0,0,0,0.3)',
                margin: '0 auto 20px', display: 'block',
              }}
            />
          ) : (
            <div style={{
              width: 96, height: 96, borderRadius: 24,
              background: 'rgba(255,255,255,0.2)',
              border: '3px solid rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Fraunces, serif',
              fontSize: 48, fontWeight: 800, fontStyle: 'italic',
              margin: '0 auto 20px',
            }}>
              {initial}
            </div>
          )}

          <h1 className="biz-serif biz-fade" style={{
            fontSize: 'clamp(32px, 6vw, 48px)', fontWeight: 800,
            margin: '0 0 10px', letterSpacing: '-0.025em', lineHeight: 1.05,
          }}>
            {company.name}
          </h1>

          {company.tagline && (
            <p className="biz-fade" style={{
              fontSize: 15, color: 'rgba(255,255,255,0.85)',
              margin: '0 0 16px', lineHeight: 1.55, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto',
              fontStyle: 'italic',
              animationDelay: '0.05s',
            }}>
              « {company.tagline} »
            </p>
          )}

          {(company.city || company.country) && (
            <div className="biz-fade" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '6px 14px', borderRadius: 100,
              fontSize: 12, fontWeight: 600,
              animationDelay: '0.1s',
            }}>
              <MapPin size={11} />
              {[company.city, company.country].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      </section>

      {/* Services grid */}
      <section style={{ padding: '40px 24px 60px', marginTop: -32, position: 'relative', zIndex: 5 }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 14,
          }} className="biz-grid">
            {services.map((s, i) => (
              <ServiceTile
                key={`${s.type}-${i}`}
                service={s}
                primary={primary}
                delay={`${0.06 + i * 0.04}s`}
              />
            ))}
          </div>

          {services.length === 0 && (
            <div style={{
              background: '#FFFFFF',
              border: '1.5px dashed rgba(10,20,16,0.15)',
              borderRadius: 18,
              padding: 36, textAlign: 'center',
              color: '#5C6B62',
            }}>
              <Sparkles size={26} color={primary} style={{ marginBottom: 10 }} />
              <p style={{ fontSize: 13, margin: 0 }}>
                Aucun service configuré pour l'instant.
              </p>
            </div>
          )}

          <div className="biz-mono" style={{
            textAlign: 'center', marginTop: 40, fontSize: 10,
            color: '#94A39A', letterSpacing: '0.1em', fontWeight: 600,
          }}>
            POWERED BY ORLODE
          </div>
        </div>
      </section>
    </div>
  );
}

function ServiceTile({ service, primary, delay }: { service: Service; primary: string; delay: string }) {
  const baseStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: 18,
    background: service.primary ? `linear-gradient(135deg, ${primary}, ${primary}d0)` : '#FFFFFF',
    color: service.primary ? '#FFFFFF' : '#0A1410',
    border: service.primary ? 'none' : '1px solid rgba(10,20,16,0.08)',
    borderRadius: 18,
    textDecoration: 'none',
    boxShadow: service.primary ? `0 16px 40px -12px ${primary}80` : '0 8px 22px -10px rgba(0,0,0,0.1)',
    animation: `biz-fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) backwards`,
    animationDelay: delay,
  };

  const content = (
    <>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: service.primary
          ? 'rgba(255,255,255,0.18)'
          : `${primary}12`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26,
        flexShrink: 0,
      }}>
        {service.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="biz-serif" style={{
          fontSize: 17, fontWeight: 700,
          letterSpacing: '-0.015em', lineHeight: 1.1,
          marginBottom: service.description || service.storeName ? 4 : 0,
        }}>
          {service.label}
        </div>
        {(service.description || service.storeName) && (
          <div style={{
            fontSize: 12,
            color: service.primary ? 'rgba(255,255,255,0.82)' : '#5C6B62',
            lineHeight: 1.45,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2 as unknown as number,
            WebkitBoxOrient: 'vertical' as const,
          }}>
            {service.storeName ? <strong>{service.storeName}</strong> : null}
            {service.storeName && service.description ? ' · ' : null}
            {service.description}
          </div>
        )}
      </div>
      {service.external ? <ExternalLink size={14} opacity={0.7} /> : <ArrowRight size={14} opacity={0.7} />}
    </>
  );

  if (!service.url) {
    return <div className="biz-card" style={baseStyle}>{content}</div>;
  }

  if (service.external) {
    return (
      <a href={service.url} target="_blank" rel="noopener noreferrer" className="biz-card" style={baseStyle}>
        {content}
      </a>
    );
  }

  return (
    <Link to={service.url} className="biz-card" style={baseStyle}>
      {content}
    </Link>
  );
}
