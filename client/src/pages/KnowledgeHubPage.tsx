/**
 * KnowledgeHubPage — Unified Documents + Q&A Hub
 * Chat with documents, upload, read aloud (TTS), correct, analyze, compare, send
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useCallback } from 'react';
import { lazy, Suspense } from 'react';
import {
  BookOpen, Search, Upload, Volume2, VolumeX, Mic, MicOff, Send, FileText,
  Loader2, Sparkles, PenLine, BarChart3, GitCompare, Share2, Plus,
  ChevronRight, X, RefreshCw, Trash2, Eye, Phone, PhoneOff,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

const GeminiLiveChat = lazy(() => import('@/components/ai/GeminiLiveChat'));
import { useLangStore } from '@/store/langStore';
import { FileUploader } from '@/components/common/FileUploader';
import { dataService } from '@/services/dataService';

interface DocMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ documentName: string; excerpt: string }>;
  confidence?: string;
  timestamp: Date;
}

interface DocItem {
  id: string;
  originalName: string;
  fileType: string;
  status: string;
  summary?: string;
  chunksCreated?: number;
  uploadedAt: string;
}

const QUICK_ACTIONS = [
  { icon: Search, label: 'Rechercher', prompt: 'Recherche dans mes documents : ', color: '#3b82f6' },
  { icon: Volume2, label: 'Lire a haute voix', prompt: 'Lis a haute voix le document ', color: '#8b5cf6' },
  { icon: PenLine, label: 'Corriger', prompt: 'Corrige les fautes dans le document ', color: '#10b981' },
  { icon: BarChart3, label: 'Analyser', prompt: 'Analyse en profondeur le document ', color: '#f59e0b' },
  { icon: GitCompare, label: 'Comparer', prompt: 'Compare les documents ', color: '#06b6d4' },
  { icon: Share2, label: 'Envoyer', prompt: 'Envoie le resume du document ', color: '#ec4899' },
  { icon: Sparkles, label: 'Generer', prompt: 'Genere un document de type rapport sur ', color: '#a855f7' },
  { icon: FileText, label: 'Resumer', prompt: 'Resume le document ', color: '#ef4444' },
];

export default function KnowledgeHubPage() {
  const { user, company } = useAuthStore();
  const { t } = useLangStore();

  // Custom brain name from company settings
  const brainName = (company as any)?.settings?.knowledgeAgentName
    || `${(company as any)?.name ?? 'Orlode'} AI`;

  // Chat state
  const [messages, setMessages] = useState<DocMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Documents state
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showDocs, setShowDocs] = useState(true);
  const [liveMode, setLiveMode] = useState(false);

  // TTS state
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  // Voice input
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Load documents
  const loadDocs = useCallback(async () => {
    if (!user?.companyId) return;
    setDocsLoading(true);
    try {
      const docs = await dataService.getDocuments(user.companyId);
      setDocuments(docs as unknown as DocItem[]);
    } catch { /* */ }
    finally { setDocsLoading(false); }
  }, [user?.companyId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // TTS
  const speak = (text: string) => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[#*_`\[\]()>]/g, '').replace(/https?:\/\/\S+/g, '').slice(0, 1000);
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'fr-FR';
    utterance.rate = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find(v => v.lang.startsWith('fr'));
    if (frVoice) utterance.voice = frVoice;
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  // Voice input
  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results as any).map((r: any) => r[0].transcript).join('');
      setInput(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  // Send message to Knowledge agent
  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: DocMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const r = await api.post('/agent/message', {
        message: text,
        agentId: 'knowledge',
        conversationId: null,
      });
      const data = (r.data as unknown as { data?: { response: string; sources?: Array<{ documentName: string; excerpt: string }>; confidence?: string } })?.data ?? r.data;
      const response = (data as { response: string }).response ?? (data as { reply: string }).reply ?? String(data);
      const sources = (data as { sources?: Array<{ documentName: string; excerpt: string }> }).sources;
      const confidence = (data as { confidence?: string }).confidence;

      const botMsg: DocMessage = {
        id: (Date.now() + 1).toString(), role: 'assistant', content: response,
        sources, confidence, timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);

      // Auto TTS for assistant responses
      if (ttsEnabled) speak(response);

      // Refresh docs in case new ones were created
      if (/genere|cree|indexe|corrige|modifie/i.test(text)) {
        setTimeout(loadDocs, 2000);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: 'Erreur de communication avec l\'agent Knowledge.', timestamp: new Date(),
      }]);
    }
    setLoading(false);
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
  };

  const handleUpload = async (file: File) => {
    if (!user?.companyId) return;
    await dataService.uploadDocument(file, user.companyId);
    setShowUpload(false);
    loadDocs();
    setMessages(prev => [...prev, {
      id: Date.now().toString(), role: 'assistant',
      content: `Document "${file.name}" en cours d'indexation. Vous pourrez l'interroger dans quelques instants.`,
      timestamp: new Date(),
    }]);
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await api.delete(`/data/documents/${docId}`);
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch { /* */ }
  };

  const completedDocs = documents.filter(d => d.status === 'completed');
  const processingDocs = documents.filter(d => d.status !== 'completed' && d.status !== 'failed');

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* ── Left: Document panel ─────────────────────────────────── */}
      <AnimatePresence>
        {showDocs && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                  <FileText size={16} className="text-blue-600" /> Documents ({completedDocs.length})
                </h2>
                <div className="flex gap-1">
                  <button onClick={loadDocs} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                    <RefreshCw size={14} className={`text-gray-400 ${docsLoading ? 'animate-spin' : ''}`} />
                  </button>
                  <button onClick={() => setShowUpload(true)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                    <Plus size={14} className="text-blue-600" />
                  </button>
                </div>
              </div>

              {processingDocs.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 mb-2">
                  <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" /> {processingDocs.length} en cours d'indexation...
                  </p>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {completedDocs.map(doc => (
                <div key={doc.id}
                  className="group flex items-start gap-2 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  onClick={() => setInput(`Parle-moi du document "${doc.originalName}"`)}
                >
                  <FileText size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{doc.originalName}</p>
                    <p className="text-[10px] text-gray-400">{doc.chunksCreated ?? 0} chunks · {doc.fileType?.split('/')[1] ?? 'doc'}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); handleDeleteDoc(doc.id); }}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-opacity">
                    <Trash2 size={12} className="text-red-400" />
                  </button>
                </div>
              ))}
              {completedDocs.length === 0 && !docsLoading && (
                <div className="text-center py-8">
                  <FileText className="mx-auto text-gray-300 dark:text-gray-600 mb-2" size={32} />
                  <p className="text-xs text-gray-400">Aucun document. Uploadez-en un pour commencer.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Right: Chat area ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowDocs(p => !p)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              <BookOpen size={18} className="text-blue-600" />
            </button>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-white text-sm">{brainName}</h1>
              <p className="text-[10px] text-gray-400">Le cerveau de votre entreprise</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLiveMode(p => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                liveMode ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              }`}>
              {liveMode ? <PhoneOff size={14} /> : <Phone size={14} />}
              {liveMode ? 'Mode texte' : 'Conversation Live'}
            </button>
            <button onClick={() => { if (speaking) stopSpeaking(); setTtsEnabled(p => !p); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                ttsEnabled ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              }`}>
              {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
              {ttsEnabled ? 'TTS ON' : 'TTS OFF'}
            </button>
            <button onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
              <Upload size={14} /> Upload
            </button>
          </div>
        </div>

        {/* Live Mode or Chat Messages */}
        {liveMode ? (
          <div className="flex-1 overflow-hidden p-2">
            <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-blue-600" size={32} /></div>}>
              <GeminiLiveChat
                theme="dark"
                language="fr"
                voiceName="Kore"
                showTextInput={true}
                systemInstruction={`Tu es "${brainName}", le cerveau IA de l'entreprise. Tu as acces a toute la base documentaire.
Tu reponds aux questions sur les documents, tu peux lire des passages, analyser, comparer, corriger.
Sois concis (1-3 phrases), professionnel et chaleureux. Reponds en francais.
Si on te demande de lire un document, lis-en un extrait de maniere naturelle.
Si tu ne sais pas, dis-le honnetement.`}
                className="h-full"
              />
            </Suspense>
          </div>
        ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mb-4">
                <BookOpen size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{brainName}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                Posez des questions sur vos documents, faites-les lire a haute voix, corrigez-les, analysez-les, comparez-les ou envoyez-les.
              </p>

              {/* Quick actions */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl">
                {QUICK_ACTIONS.map(a => {
                  const Icon = a.icon;
                  return (
                    <button key={a.label} onClick={() => handleQuickAction(a.prompt)}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900 transition-all hover:shadow-md">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${a.color}15` }}>
                        <Icon size={16} style={{ color: a.color }} />
                      </div>
                      <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-3'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-md px-4 py-3'
              }`}>
                {msg.role === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert text-gray-800 dark:text-gray-200">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Sources ({msg.confidence})</p>
                    {msg.sources.map((s, i) => (
                      <div key={i} className="flex items-start gap-1.5 mb-1">
                        <FileText size={10} className="text-blue-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">{s.documentName}</span>
                          <p className="text-[10px] text-gray-400 line-clamp-1">{s.excerpt}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* TTS button on assistant messages */}
                {msg.role === 'assistant' && (
                  <button onClick={() => speak(msg.content)} className="mt-2 text-[10px] text-gray-400 hover:text-purple-500 flex items-center gap-1">
                    <Volume2 size={10} /> Lire
                  </button>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-blue-600" />
                <span className="text-sm text-gray-500">Recherche en cours...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        )}

        {/* Input bar (only in text mode) */}
        {!liveMode && (
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={listening ? 'Ecoute en cours...' : 'Posez une question sur vos documents...'}
                rows={1}
                className="w-full px-4 py-2.5 pr-20 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                style={{ minHeight: 44, maxHeight: 120 }}
              />
              <div className="absolute right-2 bottom-1.5 flex items-center gap-1">
                <button onClick={toggleListening}
                  className={`p-1.5 rounded-lg transition-colors ${listening ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400'}`}>
                  {listening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              </div>
            </div>
            <button onClick={handleSend} disabled={loading || !input.trim()}
              className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <Send size={18} />
            </button>
          </div>
        </div>
        )}
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowUpload(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 mx-4 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">Ajouter un document</h3>
              <button onClick={() => setShowUpload(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X size={16} className="text-gray-400" />
              </button>
            </div>
            <FileUploader onUpload={handleUpload} />
          </div>
        </div>
      )}
    </div>
  );
}
