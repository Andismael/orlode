/**
 * ReferralPage — /ref/:creatorId — tracks click and redirects to register
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function ReferralPage() {
  const { creatorId } = useParams<{ creatorId: string }>();
  const [searchParams] = useSearchParams();
  const agentId = searchParams.get('agent');
  const navigate = useNavigate();
  const [tracking, setTracking] = useState(true);

  useEffect(() => {
    if (!creatorId) { navigate('/register'); return; }

    // Track the click
    fetch(`/api/referral/track/${creatorId}${agentId ? `?agent=${agentId}` : ''}`)
      .then(r => r.json())
      .then(() => {
        // Save in localStorage for 30 days
        localStorage.setItem('cm_referral', JSON.stringify({
          creatorId,
          agentId: agentId ?? null,
          clickedAt: Date.now(),
          expiresAt: Date.now() + 30 * 24 * 3600000,
        }));
      })
      .catch(() => {})
      .finally(() => {
        setTracking(false);
        // Redirect to register
        navigate('/register');
      });
  }, [creatorId, agentId, navigate]);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <Loader2 className="animate-spin" size={32} style={{ color: '#a855f7', margin: '0 auto 16px' }} />
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Redirection en cours...</p>
      </div>
    </div>
  );
}
