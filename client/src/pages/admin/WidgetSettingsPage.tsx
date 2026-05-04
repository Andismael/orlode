/**
 * WidgetSettingsPage — Configure and get embed code for the AI chat widget
 */
import { useState } from 'react';
import { Copy, Check, Code, Eye, Globe, ExternalLink, Palette } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const COLORS = [
  { label: 'Violet', value: '#6c3ce0' },
  { label: 'Bleu', value: '#2563eb' },
  { label: 'Cyan', value: '#0891b2' },
  { label: 'Vert', value: '#16a34a' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Rose', value: '#db2777' },
  { label: 'Rouge', value: '#dc2626' },
  { label: 'Noir', value: '#1f2937' },
];

export default function WidgetSettingsPage() {
  const { user, company } = useAuthStore();
  const companyId = user?.companyId ?? user?.uid ?? '';

  const [color, setColor] = useState('#6c3ce0');
  const [position, setPosition] = useState<'right' | 'left'>('right');
  const [title, setTitle] = useState(company?.name ?? 'Assistant IA');
  const [welcome, setWelcome] = useState('Bonjour ! Comment puis-je vous aider ?');
  const [avatar, setAvatar] = useState('🤖');
  const [copied, setCopied] = useState(false);

  const embedCode = `<script src="https://orlode.com/embed.js"\n  data-company="${companyId}"\n  data-color="${color}"\n  data-position="${position}"\n  data-title="${title}"\n  data-welcome="${welcome}"\n  data-avatar="${avatar}"></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6c3ce0, #a855f7)' }}>
            <Code size={20} className="text-white" />
          </div>
          Widget Chat IA
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Ajoutez votre assistant IA sur n'importe quel site web — WordPress, Wix, Shopify, HTML...
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Settings */}
        <div className="space-y-5">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2"><Palette size={14} /> Personnalisation</h2>

            {/* Color */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Couleur du widget</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button key={c.value} onClick={() => setColor(c.value)}
                    className={`w-8 h-8 rounded-lg ${color === c.value ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                    style={{ background: c.value }} title={c.label} />
                ))}
              </div>
            </div>

            {/* Position */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Position</label>
              <div className="flex gap-2">
                {(['right', 'left'] as const).map(p => (
                  <button key={p} onClick={() => setPosition(p)}
                    className={`flex-1 py-2 text-sm rounded-xl font-medium ${position === p ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    {p === 'right' ? 'Droite' : 'Gauche'}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Titre du chat</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>

            {/* Welcome */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Message de bienvenue</label>
              <textarea value={welcome} onChange={e => setWelcome(e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
            </div>

            {/* Avatar */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Avatar</label>
              <div className="flex gap-2 flex-wrap">
                {['🤖', '💬', '🧠', '⚡', '🚀', '💡', '🎯', '✨', '🤝', '📞'].map(em => (
                  <button key={em} onClick={() => setAvatar(em)}
                    className={`text-2xl p-1.5 rounded-lg ${avatar === em ? 'bg-violet-100 dark:bg-violet-900/30 ring-2 ring-violet-500' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                    {em}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Embed code */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2"><Code size={14} /> Code d'integration</h2>
              <button onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg"
                style={{ background: copied ? '#16a34a' : '#6c3ce0' }}>
                {copied ? <><Check size={12} /> Copie !</> : <><Copy size={12} /> Copier</>}
              </button>
            </div>
            <pre className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap" style={{ color: '#e2e8f0' }}>
              <span style={{ color: '#94a3b8' }}>&lt;!-- Collez ce code avant &lt;/body&gt; sur votre site --&gt;</span>{'\n'}
              <span style={{ color: '#a855f7' }}>{embedCode}</span>
            </pre>
            <div className="mt-3 space-y-1.5">
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <Globe size={11} /> Fonctionne sur : WordPress, Wix, Shopify, Squarespace, HTML, React, tout
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <ExternalLink size={11} /> Collez juste avant la balise <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">&lt;/body&gt;</code>
              </p>
            </div>
          </div>

          {/* WordPress specific */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2">WordPress</h3>
            <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
              Allez dans <strong>Apparence → Editeur de theme → footer.php</strong> et collez le code juste avant <code>&lt;/body&gt;</code>.
              Ou utilisez un plugin comme <strong>"Insert Headers and Footers"</strong> pour coller le code dans le footer.
            </p>
          </div>
        </div>

        {/* Right: Live Preview */}
        <div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden sticky top-6">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
              <Eye size={14} className="text-violet-500" />
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Apercu en direct</span>
            </div>
            <div className="relative bg-gray-100 dark:bg-gray-900" style={{ height: 500 }}>
              {/* Fake website background */}
              <div className="p-6 text-center" style={{ background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)', height: '100%' }}>
                <div className="bg-white rounded-2xl shadow-sm p-8 max-w-xs mx-auto mt-8">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl mx-auto mb-4" />
                  <div className="h-3 bg-gray-200 rounded w-3/4 mx-auto mb-2" />
                  <div className="h-2 bg-gray-100 rounded w-1/2 mx-auto mb-4" />
                  <div className="h-8 bg-gray-100 rounded-lg w-full" />
                </div>
                <p className="text-[10px] text-gray-400 mt-4">Votre site web</p>
              </div>

              {/* Preview widget */}
              <div style={{ position: 'absolute', bottom: 16, [position]: 16, zIndex: 10 }}>
                {/* Chat panel */}
                <div style={{ width: 300, borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.15)', marginBottom: 8 }}>
                  <div style={{ background: color, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{avatar}</div>
                    <div>
                      <p style={{ margin: 0, color: '#fff', fontSize: 13, fontWeight: 700 }}>{title}</p>
                      <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>En ligne</p>
                    </div>
                  </div>
                  <div style={{ background: '#f8f9fa', padding: 12 }}>
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '4px 12px 12px 12px', padding: '8px 12px', fontSize: 12, color: '#374151', maxWidth: '80%' }}>
                      {welcome}
                    </div>
                    <div style={{ background: color, color: '#fff', borderRadius: '12px 4px 12px 12px', padding: '8px 12px', fontSize: 12, maxWidth: '80%', marginLeft: 'auto', marginTop: 8 }}>
                      Bonjour, quels sont vos horaires ?
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '4px 12px 12px 12px', padding: '8px 12px', fontSize: 12, color: '#374151', maxWidth: '80%', marginTop: 8 }}>
                      Nous sommes ouverts du lundi au vendredi, 8h-18h. Puis-je vous aider ?
                    </div>
                  </div>
                  <div style={{ background: '#fff', borderTop: '1px solid #e5e7eb', padding: '8px 12px', display: 'flex', gap: 6 }}>
                    <div style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 20, padding: '6px 12px', fontSize: 11, color: '#9ca3af' }}>Ecrivez votre message...</div>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
                    </div>
                  </div>
                  <div style={{ background: '#fff', borderTop: '1px solid #f3f4f6', padding: '4px 0', textAlign: 'center', fontSize: 9, color: '#9ca3af' }}>
                    Propulse par <span style={{ color, fontWeight: 600 }}>Orlode AI</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
