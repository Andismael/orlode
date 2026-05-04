/**
 * KioskNumpad — 6-digit code entry with big touch numpad
 */
import { useState } from 'react';
import { CheckCircle, LogOut, Clock, XCircle, Delete, KeyRound, Loader2 } from 'lucide-react';
import api from '@/services/api';

type Result = { action: string; employeeName: string; hoursWorked?: number } | null;

export function KioskNumpad() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result>(null);

  const handleDigit = (d: string) => {
    if (code.length >= 6) return;
    const next = code + d;
    setCode(next);
    if (next.length === 6) submitCode(next);
  };

  const handleDelete = () => { setCode(c => c.slice(0, -1)); setResult(null); };
  const handleClear = () => { setCode(''); setResult(null); };

  const submitCode = async (c: string) => {
    setLoading(true);
    setResult(null);
    try {
      const r = await api.post('/reception/checkin-by-code', { code: c });
      setResult(r.data);
    } catch {
      setResult({ action: 'error', employeeName: '' });
    }
    finally { setLoading(false); }
  };

  const handleReset = () => { setCode(''); setResult(null); };

  // Result screen
  if (result && result.action !== 'error') {
    return (
      <div className="flex flex-col items-center justify-center text-white">
        {result.action === 'checkin' && (
          <>
            <CheckCircle size={80} className="text-green-400 mb-6" />
            <h2 className="text-3xl font-bold mb-3">Bonjour {result.employeeName} !</h2>
            <p className="text-xl text-white/70 mb-8">Arrivee enregistree</p>
          </>
        )}
        {result.action === 'checkout' && (
          <>
            <LogOut size={80} className="text-blue-400 mb-6" />
            <h2 className="text-3xl font-bold mb-3">Au revoir {result.employeeName} !</h2>
            <p className="text-xl text-white/70 mb-2">Depart enregistre</p>
            {result.hoursWorked != null && <p className="text-lg text-white/50 mb-8">{result.hoursWorked}h travaillees</p>}
          </>
        )}
        {result.action === 'already_done' && (
          <>
            <Clock size={80} className="text-amber-400 mb-6" />
            <h2 className="text-3xl font-bold mb-3">{result.employeeName}</h2>
            <p className="text-xl text-white/70 mb-8">Journee deja terminee</p>
          </>
        )}
        <button onClick={handleReset} className="px-10 py-4 bg-white text-gray-900 rounded-full font-bold text-lg active:scale-95 transition-transform">
          Suivant
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center max-w-sm w-full">
      <div className="flex items-center gap-3 mb-8">
        <KeyRound size={28} className="text-violet-400" />
        <h1 className="text-2xl font-bold text-white">Saisissez votre code</h1>
      </div>

      {/* Code display */}
      <div className="flex gap-3 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`w-14 h-16 rounded-xl flex items-center justify-center text-3xl font-mono font-bold transition-all ${
            i < code.length ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : 'bg-white/10 border border-white/20 text-white/30'
          }`}>{code[i] ?? ''}</div>
        ))}
      </div>

      {result?.action === 'error' && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-xl">
          <XCircle size={18} className="text-red-400" />
          <p className="text-sm text-red-300">Code invalide ou revoque</p>
        </div>
      )}

      {loading && <div className="mb-4"><Loader2 className="animate-spin text-violet-400" size={28} /></div>}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {['1','2','3','4','5','6','7','8','9'].map(d => (
          <button key={d} onClick={() => handleDigit(d)}
            className="py-5 rounded-2xl bg-white/10 text-white text-2xl font-bold active:bg-white/20 active:scale-95 transition-all">
            {d}
          </button>
        ))}
        <button onClick={handleClear} className="py-5 rounded-2xl bg-red-500/20 text-red-400 text-sm font-bold active:bg-red-500/30 active:scale-95 transition-all">
          Effacer
        </button>
        <button onClick={() => handleDigit('0')} className="py-5 rounded-2xl bg-white/10 text-white text-2xl font-bold active:bg-white/20 active:scale-95 transition-all">
          0
        </button>
        <button onClick={handleDelete} className="py-5 rounded-2xl bg-white/10 text-white flex items-center justify-center active:bg-white/20 active:scale-95 transition-all">
          <Delete size={24} />
        </button>
      </div>
    </div>
  );
}
