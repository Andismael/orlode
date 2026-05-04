import React, { useState, useEffect } from 'react';
import { Users, Upload, Search, Lock, Plus, Trash2, ScanFace, RefreshCw, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import EnrollPhotoModal from '@/components/faces/EnrollPhotoModal';
import RecognizeModal from '@/components/faces/RecognizeModal';

interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  photoURL?: string;
  faceDescriptor?: number[];
  enrolledAt?: string;
  color: string;
}

const PALETTE = ['#0092FF', '#FF009D', '#00A550', '#FFA200', '#FF4B4B', '#0049FF', '#0019FF', '#FF7300'];

function getColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

const STAT_COLORS = ['#FF009D', '#0092FF', '#FFA200'];

export default function FaceDirectoryPage() {
  const { t } = useLangStore();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [enrollTarget, setEnrollTarget] = useState<Employee | null>(null);
  const [showRecognize, setShowRecognize] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newDept, setNewDept] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const fetchEmployees = async () => {
    try {
      const res = await api.get<Employee[]>('/faces/employees');
      const data = (Array.isArray(res.data) ? res.data : []).map((e, i) => ({ ...e, color: getColor(i) }));
      setEmployees(data);
    } catch {
      // keep empty
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsAdding(true);
    try {
      await api.post('/faces/employees', {
        name: newName.trim(),
        role: newRole.trim(),
        department: newDept.trim(),
      });
      setNewName(''); setNewRole(''); setNewDept('');
      setShowAddForm(false);
      await fetchEmployees();
    } catch { /* ignore */ } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this employee?')) return;
    try {
      await api.delete(`/faces/employees/${id}`);
      setEmployees((prev) => prev.filter((e) => e.id !== id));
    } catch { /* ignore */ }
  };

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const departments = [...new Set(employees.map((e) => e.department).filter(Boolean))];
  const enrolledCount = employees.filter((e) => e.faceDescriptor && e.faceDescriptor.length > 0).length;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Face Directory</h2>
          <p className="text-sm text-gray-500 mt-1">Employee recognition and directory</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchEmployees}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowRecognize(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90"
            style={{ background: '#0019FF' }}
          >
            <ScanFace size={14} />
            Recognize
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
          >
            <Plus size={14} />
            Add Employee
          </button>
        </div>
      </div>

      {/* Phase 2 banner */}
      <div className="rounded-xl p-4 flex items-start gap-4 relative overflow-hidden" style={{ background: 'linear-gradient(90deg, #0049FF, #FF009D)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)' }} />
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 relative" style={{ background: 'rgba(255,255,255,0.2)' }}>
          <Lock size={16} className="text-white" />
        </div>
        <div className="relative">
          <p className="text-sm font-semibold text-white">Face Recognition — Active</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Enroll employee photos to enable recognition · Click <strong>Recognize</strong> to identify faces in any photo
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search employees..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input pl-9 text-sm"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Total Employees', value: employees.length },
          { label: 'Departments',     value: departments.length },
          { label: 'Enrolled',        value: enrolledCount },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className="rounded-xl p-4 text-center relative overflow-hidden"
            style={{ background: STAT_COLORS[i] }}
          >
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 60%)' }} />
            <p className="text-2xl font-bold text-white relative">{stat.value}</p>
            <p className="text-xs mt-1 relative" style={{ color: 'rgba(255,255,255,0.8)' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Add form (inline) */}
      <AnimatePresence>
        {showAddForm && (
          <motion.form
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleAddEmployee}
            className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3"
          >
            <p className="text-sm font-semibold text-gray-900">New Employee</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name *" className="input text-sm" required />
              <input type="text" value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Job title" className="input text-sm" />
              <input type="text" value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="Department" className="input text-sm" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
              <button type="submit" disabled={isAdding || !newName.trim()} className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-colors" style={{ background: '#0092FF' }}>
                {isAdding ? 'Adding...' : 'Add Employee'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Employee grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {filtered.map((person, index) => {
            const isEnrolled = !!(person.faceDescriptor && person.faceDescriptor.length > 0);
            return (
              <motion.div
                key={person.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.04 }}
                className="bg-white border border-gray-200 hover:shadow-md rounded-xl p-4 text-center group transition-all relative"
              >
                {/* Delete button */}
                <button
                  onClick={() => handleDelete(person.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                >
                  <Trash2 size={12} />
                </button>

                {/* Avatar / Photo */}
                <div className="relative w-14 h-14 mx-auto mb-3">
                  {person.photoURL ? (
                    <img
                      src={person.photoURL}
                      alt={person.name}
                      className="w-14 h-14 rounded-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg group-hover:scale-105 transition-transform"
                      style={{ background: person.color }}
                    >
                      {person.name[0]?.toUpperCase()}
                    </div>
                  )}
                  {/* Enrolled indicator */}
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white"
                    style={{ background: isEnrolled ? '#00A550' : '#e5e7eb' }}
                    title={isEnrolled ? 'Face enrolled' : 'Not enrolled'}
                  />
                </div>

                <p className="text-xs font-semibold text-gray-800 truncate">{person.name}</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{person.role}</p>
                <span
                  className="inline-block text-xs text-white px-2 py-0.5 rounded-full mt-1.5 truncate max-w-full"
                  style={{ background: person.color }}
                >
                  {person.department || 'No dept'}
                </span>

                {/* Enroll button */}
                <button
                  onClick={() => setEnrollTarget(person)}
                  className="mt-2 w-full text-xs py-1 rounded-lg font-medium transition-colors"
                  style={isEnrolled
                    ? { background: '#f0fdf4', color: '#00A550' }
                    : { background: `${person.color}22`, color: person.color }
                  }
                >
                  {isEnrolled ? 'Re-enroll' : 'Enroll Face'}
                </button>
              </motion.div>
            );
          })}

          {/* Add placeholder */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: filtered.length * 0.04 }}
            className="bg-white border-2 border-dashed border-gray-200 hover:border-blue-300 rounded-xl p-4 text-center cursor-pointer group transition-all flex flex-col items-center justify-center min-h-[160px]"
            onClick={() => setShowAddForm(true)}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2 group-hover:scale-105 transition-transform" style={{ background: '#0092FF' }}>
              <Users size={18} className="text-white" />
            </div>
            <p className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">Add employee</p>
          </motion.div>
        </div>
      )}

      {/* Modals */}
      {enrollTarget && (
        <EnrollPhotoModal
          employee={enrollTarget}
          onClose={() => setEnrollTarget(null)}
          onEnrolled={(photoURL) => {
            setEmployees((prev) =>
              prev.map((e) => e.id === enrollTarget.id ? { ...e, photoURL, faceDescriptor: [1] } : e)
            );
            setEnrollTarget(null);
          }}
        />
      )}
      {showRecognize && (
        <RecognizeModal
          employees={employees}
          onClose={() => setShowRecognize(false)}
        />
      )}
    </div>
  );
}
