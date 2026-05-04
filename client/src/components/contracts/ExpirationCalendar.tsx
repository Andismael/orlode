/**
 * ExpirationCalendar — Visual calendar showing contracts expiring soon
 * Simple month view with colored dots for expiring contracts
 */
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, Clock, Calendar, Loader2 } from 'lucide-react';
import api from '@/services/api';

interface Contract {
  id: string;
  signatoryName: string;
  signatoryEmail: string;
  status: string;
  expiresAt?: string;
  createdAt: string;
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

export function ExpirationCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/contracts?status=pending_signature');
      setContracts((r.data ?? []).filter((c: Contract) => c.expiresAt));
    } catch { setContracts([]); }
    finally { setLoading(false); }
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Map expiration dates to contracts
  const expirationMap = new Map<string, Contract[]>();
  contracts.forEach(c => {
    if (!c.expiresAt) return;
    const d = new Date(c.expiresAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!expirationMap.has(key)) expirationMap.set(key, []);
    expirationMap.get(key)!.push(c);
  });

  // Contracts expiring in next 7 days
  const soon = contracts.filter(c => {
    if (!c.expiresAt) return false;
    const diff = (new Date(c.expiresAt).getTime() - Date.now()) / 86_400_000;
    return diff >= 0 && diff <= 7;
  });

  const selectedContracts = selectedDate ? (expirationMap.get(selectedDate) ?? []) : [];

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-gray-400" size={24} /></div>;

  return (
    <div className="space-y-5">
      {/* Alert banner */}
      {soon.length > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertTriangle size={20} className="text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">{soon.length} contrat{soon.length > 1 ? 's' : ''} expire{soon.length > 1 ? 'nt' : ''} dans les 7 prochains jours</p>
            <p className="text-xs text-amber-600 mt-0.5">{soon.map(c => c.signatoryName).join(', ')}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Month header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><ChevronLeft size={18} /></button>
          <h3 className="text-sm font-bold text-gray-800">{MONTHS[month]} {year}</h3>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><ChevronRight size={18} /></button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 px-3 pt-3">
          {DAYS.map(d => <div key={d} className="text-center text-xs font-bold text-gray-400 uppercase tracking-wider py-2">{d}</div>)}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 px-3 pb-3">
          {/* Empty cells for offset */}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="aspect-square" />)}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const expiring = expirationMap.get(dateStr) ?? [];
            const hasExpiring = expiring.length > 0;
            const isPast = new Date(dateStr) < new Date(todayStr);
            const isSelected = dateStr === selectedDate;

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all relative ${
                  isSelected ? 'bg-blue-600 text-white shadow-md' :
                  isToday ? 'bg-blue-50 text-blue-700 font-bold ring-2 ring-blue-200' :
                  hasExpiring && !isPast ? 'bg-amber-50 text-amber-700 font-semibold' :
                  hasExpiring && isPast ? 'bg-red-50 text-red-400' :
                  'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className={`text-sm ${isPast && !isToday && !isSelected ? 'opacity-40' : ''}`}>{day}</span>
                {hasExpiring && (
                  <div className="flex gap-0.5 mt-0.5">
                    {expiring.slice(0, 3).map((_, j) => (
                      <div key={j} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : isPast ? 'bg-red-400' : 'bg-amber-500'}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected date contracts */}
        {selectedDate && selectedContracts.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Expirations le {new Date(selectedDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
            </h4>
            <div className="space-y-2">
              {selectedContracts.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <Clock size={14} className="text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{c.signatoryName}</p>
                    <p className="text-xs text-gray-500">{c.signatoryEmail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Expire bientot</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-400" /> Deja expire</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Aujourd'hui</div>
      </div>
    </div>
  );
}
