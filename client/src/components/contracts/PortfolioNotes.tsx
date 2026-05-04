/**
 * PortfolioNotes — Internal notes for a signatory
 * Migrated from WEMAS PortfolioNotes.tsx
 */
import { useState, useEffect, useRef } from 'react';
import { StickyNote, Plus, Trash2, Loader2, Check, X, Pencil } from 'lucide-react';
import api from '@/services/api';

interface Note {
  id: string;
  content: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  signatoryEmail: string;
}

export function PortfolioNotes({ signatoryEmail }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => { load(); }, [signatoryEmail]);
  useEffect(() => { if (showForm && textareaRef.current) textareaRef.current.focus(); }, [showForm]);
  useEffect(() => { if (editingId && editRef.current) { editRef.current.focus(); editRef.current.selectionStart = editRef.current.value.length; } }, [editingId]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/contracts/notes/${encodeURIComponent(signatoryEmail)}`);
      setNotes(r.data ?? []);
    } catch { setNotes([]); }
    finally { setLoading(false); }
  };

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    setSaving(true);
    try {
      await api.post('/contracts/notes', { signatoryEmail, content: newContent.trim() });
      setNewContent(''); setShowForm(false);
      await load();
    } catch {}
    finally { setSaving(false); }
  };

  const handleEdit = async (id: string) => {
    if (!editContent.trim()) return;
    setEditSaving(true);
    try {
      await api.patch(`/contracts/notes/${id}`, { content: editContent.trim() });
      setEditingId(null);
      await load();
    } catch {}
    finally { setEditSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette note ?')) return;
    await api.delete(`/contracts/notes/${id}`).catch(() => {});
    load();
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <StickyNote size={18} className="text-amber-500" />
          Notes internes
          {notes.length > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500">{notes.length}</span>}
        </h3>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors shadow-sm">
            <Plus size={15} /> Ajouter
          </button>
        )}
      </div>

      {/* New note form */}
      {showForm && (
        <div className="border border-amber-100 rounded-2xl p-4 mb-5 bg-amber-50">
          <textarea ref={textareaRef} value={newContent} onChange={e => setNewContent(e.target.value)}
            placeholder="Ecrivez votre note ici..." rows={4}
            className="w-full px-3 py-2.5 border border-amber-200 rounded-xl text-sm bg-white focus:outline-none focus:border-amber-400 resize-none"
            onKeyDown={e => { if (e.key === 'Escape') { setShowForm(false); setNewContent(''); } }} />
          <div className="flex gap-2 mt-3">
            <button onClick={handleAdd} disabled={saving || !newContent.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Enregistrer
            </button>
            <button onClick={() => { setShowForm(false); setNewContent(''); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              <X size={13} /> Annuler
            </button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {loading ? (
        <div className="py-6 text-center"><Loader2 size={18} className="animate-spin mx-auto text-gray-400" /></div>
      ) : notes.length === 0 ? (
        <div className="py-6 text-center">
          <StickyNote size={18} className="mx-auto text-amber-300 mb-2" />
          <p className="text-sm text-gray-400">Aucune note interne</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <div key={note.id} className="relative border border-amber-100 rounded-2xl px-4 py-3.5 bg-amber-50 group hover:border-amber-200 transition-all">
              {editingId === note.id ? (
                <>
                  <textarea ref={editRef} value={editContent} onChange={e => setEditContent(e.target.value)} rows={4}
                    className="w-full px-3 py-2 border border-amber-200 rounded-xl text-sm bg-white focus:outline-none focus:border-amber-400 resize-none mb-3"
                    onKeyDown={e => { if (e.key === 'Escape') setEditingId(null); }} />
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(note.id)} disabled={editSaving || !editContent.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-500 disabled:opacity-50 transition-colors">
                      {editSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Enregistrer
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-white transition-colors">
                      <X size={11} /> Annuler
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed pr-14">{note.content}</p>
                  <p className="text-xs text-amber-400 mt-2">{fmtDate(note.updatedAt !== note.createdAt ? note.updatedAt : note.createdAt)}</p>
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                      className="p-1.5 rounded-lg text-amber-400 hover:text-amber-600 hover:bg-amber-100 transition-all" title="Modifier">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(note.id)}
                      className="p-1.5 rounded-lg text-amber-300 hover:text-red-500 hover:bg-red-50 transition-all" title="Supprimer">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
