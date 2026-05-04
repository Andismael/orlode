/**
 * ContractSignPage — Public contract signing page (no auth required)
 * Accessed via /sign/:uniqueLink from email
 * Migrated from WEMAS ContractView.tsx
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileCheck, CheckCircle, AlertCircle, Loader2, Calendar, User, Mail,
  Phone, Printer, PenLine, X, Shield, MapPin, FileText,
} from 'lucide-react';
import { SignaturePad } from '@/components/contracts/SignaturePad';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';

interface Contract {
  id: string;
  companyId: string;
  uniqueLink: string;
  signatoryName: string;
  signatoryEmail: string;
  signatoryPhone?: string;
  signatoryAddress?: string;
  contractContent: string;
  importedFileUrl?: string;
  importedFileName?: string;
  senderName?: string;
  senderSignatureData?: string;
  senderSignedAt?: string;
  signatureData?: string;
  signedAt?: string;
  status: string;
  expiresAt?: string;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Success Modal ────────────────────────────────────────────────────────────

function SignedSuccessModal({ artistName, onClose }: { artistName: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="relative p-8 text-center">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
          <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-5 shadow-lg">
            <CheckCircle size={40} className="text-white" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 bg-green-50 text-green-700">
            <Shield size={12} />
            Signature enregistree
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Contrat signe avec succes !</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            Bonjour <strong className="text-gray-700">{artistName}</strong>, votre signature electronique a bien ete enregistree.
          </p>
          <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-left space-y-2">
            {['Signature electronique enregistree', 'Contrat archive', 'Preuve legale horodatee'].map(t => (
              <div key={t} className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle size={16} className="text-green-500 shrink-0" />
                {t}
              </div>
            ))}
          </div>
          <button onClick={onClose} className="w-full py-3.5 rounded-xl font-bold text-white text-sm bg-green-600 hover:bg-green-700 transition-colors shadow-md">
            Voir mon contrat signe
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ContractSignPage() {
  const { uniqueLink } = useParams<{ uniqueLink: string }>();
  const { t } = useLangStore();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [justSigned, setJustSigned] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => { if (uniqueLink) loadContract(); }, [uniqueLink]);

  const loadContract = async () => {
    try {
      const r = await api.get(`/public/contract/${uniqueLink}`);
      setContract(r.data);
    } catch (err: any) {
      setError(err?.response?.status === 404 ? 'Contrat introuvable' : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!signature || !contract || signing) return;
    setSigning(true);
    setError('');
    try {
      const r = await api.post(`/public/contract/${uniqueLink}/sign`, { signatureData: signature });
      if (!r.data?.success) throw new Error(r.data?.message || 'Erreur');
      setJustSigned(true);
      setShowSuccessModal(true);
      await loadContract();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Erreur lors de la signature');
    } finally {
      setSigning(false);
    }
  };

  const handlePrint = () => window.print();

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4 text-slate-500" size={48} />
          <p className="text-gray-600">Chargement du contrat...</p>
        </div>
      </div>
    );
  }

  // ── Error / Not found ──────────────────────────────────────────────────────

  if (error && !contract) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="text-red-400" size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Lien invalide ou expire</h2>
          <p className="text-gray-500 mb-6 leading-relaxed">
            Ce lien de contrat est introuvable. Il a peut-etre expire ou ete supprime. Contactez l'emetteur pour obtenir un nouveau lien.
          </p>
        </div>
      </div>
    );
  }

  if (!contract) return null;

  const isSigned = contract.status === 'signed' && contract.signatureData;
  const isExpired = contract.status === 'expired' || (contract.status === 'pending_signature' && contract.expiresAt && new Date(contract.expiresAt) < new Date());

  // ── Expired ────────────────────────────────────────────────────────────────

  if (isExpired && !isSigned) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="text-orange-400" size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Contrat expire</h2>
          <p className="text-gray-500 leading-relaxed">
            Ce lien de signature a expire. Veuillez contacter l'emetteur pour recevoir un nouveau lien.
          </p>
        </div>
      </div>
    );
  }

  // ── Signed view ────────────────────────────────────────────────────────────

  if (isSigned) {
    return (
      <>
        {showSuccessModal && (
          <SignedSuccessModal
            artistName={contract.signatoryName}
            onClose={() => setShowSuccessModal(false)}
          />
        )}
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 py-12 print:bg-white print:p-0">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden print:shadow-none print:rounded-none">

              {/* Header */}
              <div className="p-8 bg-green-600 text-white print:bg-white print:text-gray-900 print:border-b-2 print:border-gray-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <FileCheck size={40} className="print:hidden" />
                    <div>
                      <h1 className="text-3xl font-bold">Contrat signe</h1>
                      <p className="text-white/80 print:text-gray-500">{`${t('success')}`}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-xl print:hidden">
                    <CheckCircle size={20} />
                    <span className="font-semibold">{`${t('signed')}`}</span>
                  </div>
                </div>
              </div>

              {justSigned && !showSuccessModal && (
                <div className="mx-8 mt-6 p-4 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3 print:hidden">
                  <CheckCircle size={20} className="text-green-600" />
                  <p className="font-semibold text-sm text-green-700">Votre contrat a ete signe avec succes !</p>
                </div>
              )}

              <div className="p-8">
                {/* Info grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 p-6 bg-slate-50 rounded-xl border-2 border-slate-200">
                  <div className="flex items-center gap-3">
                    <User className="text-slate-500 shrink-0" size={20} />
                    <div><p className="text-xs text-gray-500 uppercase tracking-wide">{`${t('name')}`}</p><p className="font-semibold text-gray-800">{contract.signatoryName}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="text-slate-500 shrink-0" size={20} />
                    <div><p className="text-xs text-gray-500 uppercase tracking-wide">{`${t('email')}`}</p><p className="font-semibold text-gray-800">{contract.signatoryEmail}</p></div>
                  </div>
                  {contract.signatoryPhone && (
                    <div className="flex items-center gap-3">
                      <Phone className="text-slate-500 shrink-0" size={20} />
                      <div><p className="text-xs text-gray-500 uppercase tracking-wide">{`${t('phone')}`}</p><p className="font-semibold text-gray-800">{contract.signatoryPhone}</p></div>
                    </div>
                  )}
                  {contract.signatoryAddress && (
                    <div className="flex items-center gap-3">
                      <MapPin className="text-slate-500 shrink-0" size={20} />
                      <div><p className="text-xs text-gray-500 uppercase tracking-wide">{`${t('company')}`}</p><p className="font-semibold text-gray-800">{contract.signatoryAddress}</p></div>
                    </div>
                  )}
                  {contract.signedAt && (
                    <div className="flex items-center gap-3">
                      <Calendar className="text-slate-500 shrink-0" size={20} />
                      <div><p className="text-xs text-gray-500 uppercase tracking-wide">Date de signature</p><p className="font-semibold text-gray-800">{formatDate(contract.signedAt)}</p></div>
                    </div>
                  )}
                </div>

                {/* Imported file */}
                {contract.importedFileUrl && (
                  <div className="mb-8">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-b-2 border-gray-200 pb-2">Document annexe</h3>
                    <a href={contract.importedFileUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
                      <FileText size={16} />
                      {contract.importedFileName || 'Voir le document'}
                    </a>
                  </div>
                )}

                {/* Content */}
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 border-b-2 border-gray-200 pb-2">Contenu du contrat</h3>
                  <div className="bg-gray-50 rounded-xl p-6 border-2 border-gray-200">
                    <div className="whitespace-pre-wrap text-gray-700 leading-relaxed font-serif">{contract.contractContent}</div>
                  </div>
                </div>

                {/* Signatures */}
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 border-b-2 border-gray-200 pb-2">{`${t('signature')}`}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contract.senderSignatureData && (
                      <div className="bg-white rounded-xl p-6 border-2 border-blue-100">
                        <div className="flex items-center gap-2 mb-3"><PenLine size={16} className="text-blue-600" /><p className="text-sm font-semibold text-blue-700">Emetteur</p></div>
                        <img src={contract.senderSignatureData} alt="Signature emetteur" className="max-w-[200px] mx-auto block" />
                        <p className="text-center text-xs text-gray-500 mt-2">
                          {contract.senderName || 'Emetteur'}
                          {contract.senderSignedAt && <> — {formatDate(contract.senderSignedAt)}</>}
                        </p>
                      </div>
                    )}
                    {contract.signatureData && (
                      <div className={`bg-white rounded-xl p-6 border-2 border-green-200 ${!contract.senderSignatureData ? 'md:col-span-2' : ''}`}>
                        <div className="flex items-center gap-2 mb-3"><PenLine size={16} className="text-green-600" /><p className="text-sm font-semibold text-green-700">{contract.signatoryName}</p></div>
                        <img src={contract.signatureData} alt="Signature" className="max-w-[200px] mx-auto block" />
                        {contract.signedAt && <p className="text-center text-xs text-gray-500 mt-2">{contract.signatoryName} — {formatDate(contract.signedAt)}</p>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-center print:hidden">
                  <button onClick={handlePrint} className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-md">
                    <Printer size={20} />
                    Imprimer / Sauvegarder PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Pending signature view ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">

          {/* Header */}
          <div className="p-8 bg-blue-600 text-white">
            <div className="flex items-center gap-4 mb-2">
              <FileCheck size={40} />
              <div>
                <h1 className="text-3xl font-bold">Document a signer</h1>
                <p className="text-white/80">Veuillez lire et signer electroniquement</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            {/* Greeting */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Bonjour {contract.signatoryName}</h2>
              <p className="text-gray-600">Veuillez lire attentivement le contrat ci-dessous et signer electroniquement pour accepter les termes.</p>
            </div>

            {/* Imported file */}
            {contract.importedFileUrl && (
              <div className="mb-6">
                <a href={contract.importedFileUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
                  <FileText size={16} />
                  Consulter le document annexe : {contract.importedFileName || 'Document'}
                </a>
              </div>
            )}

            {/* Contract content */}
            <div className="mb-8 p-6 bg-gray-50 rounded-xl border-2 border-gray-200">
              <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">{contract.contractContent}</div>
            </div>

            {/* Sender pre-signature */}
            {contract.senderSignatureData && (
              <div className="mb-8 p-5 bg-blue-50 rounded-xl border-2 border-blue-100">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={18} className="text-blue-600" />
                  <p className="text-sm font-semibold text-blue-700">Ce contrat a ete pre-signe par l'emetteur</p>
                </div>
                <img src={contract.senderSignatureData} alt="Signature emetteur" className="max-h-16 max-w-[180px]" />
                <p className="text-xs text-gray-500 mt-1">
                  {contract.senderName || 'Emetteur'}
                  {contract.senderSignedAt && <> — {formatDate(contract.senderSignedAt)}</>}
                </p>
              </div>
            )}

            {/* Signature pad */}
            <div className="border-t-2 border-gray-200 pt-8">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Votre Signature</h3>
              <p className="text-gray-600 mb-6">En signant ci-dessous, vous confirmez avoir lu et accepte les termes du contrat.</p>
              <SignaturePad onSignatureChange={setSignature} />

              {error && (
                <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              )}

              <button
                onClick={handleSign}
                disabled={!signature || signing}
                className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-4 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: signature && !signing ? '#2563eb' : '#9ca3af' }}
              >
                {signing ? (
                  <><Loader2 className="animate-spin" size={20} /> Signature en cours...</>
                ) : (
                  <><CheckCircle size={20} /> Signer le contrat</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
