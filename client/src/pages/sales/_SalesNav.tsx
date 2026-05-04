/**
 * Shared sales navigation (used across all sales pages)
 * Premium green/orange palette + Fraunces serif
 */
import { useNavigate, useLocation } from 'react-router-dom';

const C = {
  greenDark: '#063D2E', cream: '#FFFAF0',
  orange: '#FF6B1A', onGreenSoft: '#A8C9B8',
};

const TABS = [
  { label: 'Pipeline', path: '/sales/pipeline' },
  { label: 'Leads', path: '/sales/leads' },
  { label: 'Devis', path: '/sales/quotes' },
  { label: 'Factures', path: '/sales/invoices' },
  { label: 'Clients', path: '/sales/clients' },
  { label: 'Activités', path: '/sales/activities' },
  { label: 'Relances', path: '/sales/followups' },
  { label: 'Rapports', path: '/sales/reports' },
  { label: 'AI Chat', path: '/sales/ai-chat' },
];

export default function SalesNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <>
      <style>{`
        .sn-tabs{display:flex;gap:4px;background:${C.greenDark};padding:4px;border-radius:14px;border:1px solid rgba(255,250,240,.06);flex-wrap:wrap}
        .sn-tab{padding:10px 16px;font-size:13px;font-weight:500;color:${C.onGreenSoft};cursor:pointer;border-radius:10px;transition:all .2s;background:transparent;border:none;font-family:inherit;white-space:nowrap}
        .sn-tab:hover{color:${C.cream}}
        .sn-tab.active{background:${C.orange};color:${C.cream};box-shadow:0 4px 14px -4px rgba(255,107,26,.5)}
      `}</style>
      <div style={{ marginTop: 24 }}>
        <div className="sn-tabs">
          {TABS.map(tab => {
            const isActive = location.pathname === tab.path || location.pathname.startsWith(tab.path + '/');
            return (
              <button
                key={tab.path}
                className={`sn-tab ${isActive ? 'active' : ''}`}
                onClick={() => navigate(tab.path)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
