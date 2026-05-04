import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { useLangStore } from '@/store/langStore';
import api from '@/services/api';
import { Building2 } from 'lucide-react';

interface CompanyOption { id: string; name: string; plan: string; }

export default function SelectCompanyPage() {
  const navigate = useNavigate();
  const { setCompany } = useAuthStore();
  const { t } = useLangStore();
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/my-companies').then(r => {
      const list = r.data as CompanyOption[];
      setCompanies(list);
      // Auto-select if user has only one company — no picker needed
      if (list.length === 1) { select(list[0].id); return; }
    }).catch(() => setCompanies([])).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = async (id: string) => {
    const snap = await getDoc(doc(db, 'companies', id));
    if (snap.exists()) {
      setCompany({ id: snap.id, ...snap.data() } as Parameters<typeof setCompany>[0]);
      navigate('/');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Sélectionner une entreprise</h2>
      {loading ? (
        <div className="text-center text-sm text-gray-500 py-8">{`${t('loading')}`}</div>
      ) : (
        <div className="space-y-2">
          {companies.map(c => (
            <button key={c.id} onClick={() => select(c.id)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
                <Building2 size={18} className="text-white" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                <p className="text-xs text-gray-500 capitalize">{c.plan}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
