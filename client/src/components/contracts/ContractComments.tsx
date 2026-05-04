/**
 * ContractComments — Internal team comments on a contract
 */
import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Trash2, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

interface Comment {
  id: string;
  contractId: string;
  content: string;
  authorName: string;
  authorEmail: string;
  createdAt: string;
}

interface Props {
  contractId: string;
}

export function ContractComments({ contractId }: Props) {
  const { user } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { load(); }, [contractId]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/contracts/comments/${contractId}`);
      setComments((r.data ?? []).sort((a: Comment, b: Comment) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch { setComments([]); }
    finally { setLoading(false); }
  };

  const handleSend = async () => {
    if (!newComment.trim() || sending) return;
    setSending(true);
    try {
      await api.post('/contracts/comments', {
        contractId,
        content: newComment.trim(),
        authorName: user?.displayName || user?.email || 'Anonyme',
      });
      setNewComment('');
      await load();
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch {}
    finally { setSending(false); }
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/contracts/comments/${id}`).catch(() => {});
    load();
  };

  const fmtTime = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 60_000) return 'A l\'instant';
    if (diffMs < 3_600_000) return `Il y a ${Math.floor(diffMs / 60_000)} min`;
    if (diffMs < 86_400_000) return `Il y a ${Math.floor(diffMs / 3_600_000)}h`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="border-t border-gray-100 mt-6 pt-6">
      <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-4">
        <MessageSquare size={16} className="text-blue-500" />
        Commentaires internes
        {comments.length > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500">{comments.length}</span>}
      </h3>

      {/* Comments list */}
      {loading ? (
        <div className="py-4 text-center"><Loader2 size={16} className="animate-spin mx-auto text-gray-400" /></div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400 mb-4">Aucun commentaire. Lancez la discussion.</p>
      ) : (
        <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
          {comments.map(c => {
            const isMe = c.authorEmail === user?.email;
            return (
              <div key={c.id} className={`flex gap-2.5 group ${isMe ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 ${isMe ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {initials(c.authorName)}
                </div>
                <div className={`max-w-[75%] ${isMe ? 'text-right' : ''}`}>
                  <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                    {c.content}
                  </div>
                  <div className={`flex items-center gap-2 mt-0.5 ${isMe ? 'justify-end' : ''}`}>
                    <span className="text-xs text-gray-400">{c.authorName} · {fmtTime(c.createdAt)}</span>
                    {isMe && (
                      <button onClick={() => handleDelete(c.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-500 transition-all">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Ajouter un commentaire..."
          className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
          disabled={sending}
        />
        <button onClick={handleSend} disabled={sending || !newComment.trim()}
          className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors shrink-0">
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
