/**
 * CreatorRegisterPage — Become a Creator on Orlode
 * Separate from enterprise registration
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, Code, DollarSign, Zap, ArrowRight, Check } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

export default function CreatorRegisterPage() {
  const navigate = useNavigate();
  const { user, company, setCompany } = useAuthStore();
  const [portfolio, setPortfolio] = useState('');
  const [motivation, setMotivation] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const alreadyCreator = (company as Record<string, unknown> | null)?.['isCreator'] === true;

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      await api.post('/creator/register', { portfolio, motivation });
      if (company) setCompany({ ...company, plan: (company as Record<string, unknown>)['plan'] as string ?? 'creator' } as typeof company);
      setDone(true);
    } catch (err) {
      setError('Erreur lors de l\'inscription. Reessayez.');
    }
    setLoading(false);
  };

  if (alreadyCreator) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Vous etes deja Creator</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 24 }}>Accedez a votre portail pour creer et publier des agents.</p>
          <Link to="/creator" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: 'linear-gradient(135deg, #6c3ce0, #a855f7)', color: '#fff', borderRadius: 12, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
            Ouvrir le portail Creator <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: 'linear-gradient(135deg, #6c3ce0, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 8px 30px rgba(168,85,247,0.3)' }}>
            <Check size={36} style={{ color: '#fff' }} />
          </div>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, marginBottom: 8, fontFamily: 'Outfit, sans-serif' }}>Bienvenue Creator !</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>Votre compte Creator est active. Vous pouvez maintenant creer et publier des agents sur le marketplace Orlode.</p>
          <Link to="/creator" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', background: 'linear-gradient(135deg, #6c3ce0, #a855f7)', color: '#fff', borderRadius: 14, fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 20px rgba(168,85,247,0.4)' }}>
            Creer mon premier agent <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dark-ui" style={{ minHeight: '100vh', background: '#0a0a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Outfit, sans-serif' }}>
      {/* Background orbs */}
      <div style={{ position: 'fixed', width: 300, height: 300, borderRadius: '50%', background: '#a855f7', filter: 'blur(150px)', opacity: 0.08, top: '-10%', left: '-5%', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', width: 250, height: 250, borderRadius: '50%', background: '#06b6d4', filter: 'blur(120px)', opacity: 0.06, bottom: '10%', right: '-5%', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 520, width: '100%', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, #6c3ce0, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 30px rgba(168,85,247,0.3)' }}>
            <Code size={28} style={{ color: '#fff' }} />
          </div>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Devenir Creator</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Creez et vendez des agents IA sur Orlode</p>
        </div>

        {/* Benefits */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 28 }}>
          {[
            { icon: Code, label: 'Builder gratuit', desc: 'Creez sans code' },
            { icon: DollarSign, label: '70% revenus', desc: 'Commission genereuse' },
            { icon: Zap, label: 'AI Review', desc: 'Publication rapide' },
          ].map(b => (
            <div key={b.label} style={{ background: '#12122a', border: '1px solid rgba(168,85,247,0.12)', borderRadius: 14, padding: '16px 12px', textAlign: 'center' }}>
              <b.icon size={20} style={{ color: '#a855f7', margin: '0 auto 8px', display: 'block' }} />
              <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, margin: 0 }}>{b.label}</p>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: '4px 0 0' }}>{b.desc}</p>
            </div>
          ))}
        </div>

        {/* Plan card */}
        <div style={{ background: '#12122a', border: '1px solid rgba(168,85,247,0.15)', borderRadius: 16, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>Plan Creator</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '2px 0 0' }}>Tout ce qu'il faut pour creer et vendre</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: '#fff', fontSize: 24, fontWeight: 800, margin: 0 }}>$9.99<span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>/mois</span></p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              'Builder d\'agents illimite',
              'Publication sur marketplace',
              'Dashboard revenus',
              'AI review automatique',
              'Chat pour tester vos agents',
              '13 connecteurs disponibles',
              'Commission 70% sur ventes',
              'Support creator',
            ].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                <Check size={12} style={{ color: '#34d399', flexShrink: 0 }} /> {f}
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <div style={{ background: '#12122a', border: '1px solid rgba(168,85,247,0.12)', borderRadius: 16, padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Portfolio / Site web (optionnel)</label>
            <input value={portfolio} onChange={e => setPortfolio(e.target.value)}
              placeholder="https://monsite.com ou github.com/monprofil"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(168,85,247,0.15)', color: '#e2e8f0', fontSize: 13, outline: 'none' }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Quel type d'agents voulez-vous creer ?</label>
            <textarea value={motivation} onChange={e => setMotivation(e.target.value)}
              rows={3} placeholder="Ex: Je veux creer des agents pour le secteur immobilier en Afrique de l'Ouest..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(168,85,247,0.15)', color: '#e2e8f0', fontSize: 13, outline: 'none', resize: 'none' }} />
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}

          <button onClick={handleSubmit} disabled={loading}
            style={{ width: '100%', padding: '14px 0', borderRadius: 12, background: 'linear-gradient(135deg, #6c3ce0, #a855f7)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 20px rgba(168,85,247,0.3)', opacity: loading ? 0.6 : 1 }}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            Activer mon compte Creator — $9.99/mois
          </button>

          <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 12 }}>
            Annulable a tout moment · Pas de frais caches
          </p>
        </div>

        {/* Login link */}
        <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 20 }}>
          {user ? (
            <Link to="/creator" style={{ color: '#a855f7' }}>Retour au portail</Link>
          ) : (
            <>Deja un compte ? <Link to="/login" style={{ color: '#a855f7' }}>Se connecter</Link></>
          )}
        </p>
      </div>
    </div>
  );
}
