/**
 * Boutique WhatsApp — activation wizard.
 *
 * Pitch: "Crée ta boutique en envoyant une photo sur WhatsApp."
 *
 * 3-field provisioning modal. Idempotent: the server returns the existing
 * store if one already exists, so it's safe to retry.
 */
import React, { useState } from 'react';
import { X, Store, Phone, CreditCard, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import { useAuthStore } from '@/store/authStore';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (storeId: string) => void;
}

export default function BoutiqueActivationWizard({ open, onClose, onSuccess }: Props) {
  const { company } = useAuthStore();
  // Read company currency setting (set in /settings or company config). Fall
  // back to XOF for African default. The user expects this to be respected
  // everywhere, so we prefill the new store with it.
  const companyCurrency =
    ((company as Record<string, unknown> | null)?.['settings'] as Record<string, string> | undefined)?.['currency']
    ?? (company as Record<string, unknown> | null)?.['currency'] as string
    ?? 'XOF';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+225');
  const [paymentInstructions, setPaymentInstructions] = useState('Paiement à la livraison · ou Wave +225 XX XX XX XX');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ storeId: string } | null>(null);

  if (!open) return null;

  const phoneOk = /^\+\d{8,15}$/.test(phone.replace(/\s/g, ''));
  const nameOk = name.trim().length >= 2;
  const canSubmit = nameOk && phoneOk && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const r: any = await api.post('/commerce/stores', {
        name: name.trim(),
        ownerPhone: phone.replace(/\s/g, ''),
        paymentInstructions: paymentInstructions.trim(),
        currency: companyCurrency,
      });
      const data = r?.data;
      const storeId = data?.storeId ?? data?.store?.id;
      if (!storeId) throw new Error('Pas de storeId retourné par le serveur.');
      setDone({ storeId });
      toast.success(
        data?.alreadyExisted ? 'Boutique déjà active' : '🛍️ Boutique créée',
        'Envoie une photo sur WhatsApp pour ajouter ton premier produit.',
      );
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Réessaie.';
      toast.error('Création impossible', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = () => {
    if (!done) return;
    onSuccess(done.storeId);
    // Reset for next open
    setDone(null);
    setName('');
    setPhone('+225');
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(10, 42, 32, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FFFAF0',
          borderRadius: 24, maxWidth: 540, width: '100%',
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 30px 80px -20px rgba(10, 42, 32, 0.5)',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #10B981, #059669)',
          color: '#FFFAF0',
          padding: '24px 28px', borderRadius: '24px 24px 0 0',
          position: 'relative',
        }}>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(255,250,240,0.2)', color: '#FFFAF0',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(255,250,240,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24,
            }}>🛒</div>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', opacity: 0.9,
            }}>
              Boutique WhatsApp · Activation
            </div>
          </div>
          <h2 style={{
            fontFamily: 'Fraunces, serif', fontSize: 26, fontWeight: 800,
            margin: 0, lineHeight: 1.15, letterSpacing: '-0.02em',
          }}>
            Crée ta boutique en envoyant une <em style={{ fontStyle: 'italic', fontWeight: 500 }}>photo sur WhatsApp.</em>
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.92 }}>
            3 infos suffisent. Tu pourras tout modifier après.
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px' }}>
          {!done ? (
            <>
              {/* Field 1 — Name */}
              <Field
                icon={<Store size={16} />}
                label="Nom de la boutique"
                hint="Ex: Cuir Noir Boutique, Maquis Chez Tantie"
              >
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Mon enseigne"
                  autoFocus
                  style={inputStyle}
                />
              </Field>

              {/* Field 2 — WhatsApp owner phone */}
              <Field
                icon={<Phone size={16} />}
                label="Numéro WhatsApp du propriétaire"
                hint="Format international, commence par + (ex: +225 07 07 07 07 07)"
              >
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+2250707070707"
                  style={{
                    ...inputStyle,
                    fontFamily: 'JetBrains Mono, monospace',
                    borderColor: phone.length > 4 && !phoneOk ? '#EF4444' : '#E5E5E5',
                  }}
                />
              </Field>

              {/* Field 3 — Payment instructions (optional) */}
              <Field
                icon={<CreditCard size={16} />}
                label="Instructions de paiement"
                hint="Optionnel · Ce que l'agent répondra au client (cash, lien Wave, OM...)"
              >
                <textarea
                  value={paymentInstructions}
                  onChange={e => setPaymentInstructions(e.target.value)}
                  placeholder="Paiement à la livraison · ou Wave +225 XX XX XX XX"
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
                />
              </Field>

              {/* Info card */}
              <div style={{
                background: '#D1FAE5', borderRadius: 12,
                padding: 14, marginTop: 8, marginBottom: 16,
                border: '1px solid #10B981',
                fontSize: 12, color: '#0A2A20',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <CheckCircle2 size={16} color="#059669" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong>Une fois activé :</strong> envoie une photo sur WhatsApp avec en légende
                  <code style={{ background: '#FFFAF0', padding: '1px 5px', borderRadius: 4, margin: '0 2px', fontFamily: 'JetBrains Mono, monospace' }}>iPhone 13 - 150000</code>
                  → la fiche produit est créée automatiquement.
                </div>
              </div>

              {/* Submit */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={onClose}
                  disabled={submitting}
                  style={{
                    padding: '12px 18px', borderRadius: 10,
                    background: 'transparent', color: '#5A6B62',
                    border: '1.5px solid #94A3A0',
                    cursor: 'pointer', fontWeight: 600, fontSize: 13,
                    fontFamily: 'inherit',
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  style={{
                    padding: '12px 22px', borderRadius: 10,
                    background: canSubmit
                      ? 'linear-gradient(135deg, #10B981, #059669)'
                      : '#94A3A0',
                    color: '#FFFAF0', border: 'none',
                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                    fontWeight: 700, fontSize: 14,
                    display: 'flex', alignItems: 'center', gap: 8,
                    boxShadow: canSubmit ? '0 8px 20px -6px #10B981' : 'none',
                    fontFamily: 'inherit',
                  }}
                >
                  {submitting
                    ? <><Loader2 size={16} className="spin" /> Création…</>
                    : <>Créer ma boutique <ArrowRight size={16} /></>
                  }
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Done state */}
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 20,
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  color: '#FFFAF0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                  boxShadow: '0 16px 32px -8px #10B981',
                }}>
                  <CheckCircle2 size={36} />
                </div>
                <h3 style={{
                  fontFamily: 'Fraunces, serif', fontSize: 24, fontWeight: 800,
                  margin: '0 0 8px', color: '#0A2A20', letterSpacing: '-0.02em',
                }}>
                  Ta boutique est <em style={{ fontStyle: 'italic', fontWeight: 500, color: '#059669' }}>prête.</em>
                </h3>
                <p style={{ fontSize: 14, color: '#5A6B62', margin: '0 0 24px', lineHeight: 1.5 }}>
                  Envoie maintenant une photo sur WhatsApp depuis le numéro<br />
                  <code style={{ background: '#F5EDD6', padding: '2px 8px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{phone}</code>
                  <br />avec en légende <code style={{ background: '#F5EDD6', padding: '2px 8px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>nom du produit · prix</code>.
                </p>
                <button
                  onClick={handleContinue}
                  style={{
                    padding: '12px 24px', borderRadius: 10,
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    color: '#FFFAF0', border: 'none', cursor: 'pointer',
                    fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    boxShadow: '0 8px 20px -6px #10B981',
                  }}
                >
                  Activer le pack <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ icon, label, hint, children }: { icon: React.ReactNode; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
        color: '#0A2A20', textTransform: 'uppercase',
        marginBottom: 6,
      }}>
        <span style={{ color: '#059669' }}>{icon}</span>
        {label}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: '#5A6B62', marginTop: 4 }}>{hint}</div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  border: '1.5px solid #E5E5E5',
  background: '#FFFAF0',
  fontSize: 14,
  color: '#0A2A20',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 0.15s ease',
};
