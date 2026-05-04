import React, { useState, Suspense, lazy } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronUp, Brain, User, ThumbsUp, ThumbsDown, ExternalLink, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { Message } from '@/types/chat.types';
import SourceCard from './SourceCard';
import { formatDate } from '@/utils/formatters';

const AgentAvatar3D = lazy(() => import('@/components/3d/SceneBackgrounds').then(m => ({ default: m.AgentAvatar3D })));

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onFeedback?: (messageId: string, rating: 'up' | 'down') => Promise<void>;
  immersive?: boolean;
  agentIcon?: string;
}

export default function MessageBubble({ message, isStreaming = false, onFeedback, immersive = false, agentIcon }: MessageBubbleProps) {
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<'up' | 'down' | null>(message.feedback?.rating ?? null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleFeedback = async (rating: 'up' | 'down') => {
    if (feedbackSent || feedbackLoading || !onFeedback) return;
    setFeedbackLoading(true);
    try { await onFeedback(message.id, rating); setFeedbackSent(rating); } finally { setFeedbackLoading(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ── USER MESSAGE — right-aligned purple gradient ─────────────────────────
  if (isUser) {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}
        className="flex items-start gap-3 justify-end group">
        <div className="flex flex-col items-end gap-1 max-w-[85%] md:max-w-[75%]">
          <div className="px-4 py-2.5 rounded-2xl rounded-br-md text-[15px] leading-relaxed backdrop-blur-md"
            style={{
              background: 'linear-gradient(135deg, rgba(168,85,247,0.9) 0%, rgba(124,58,237,0.9) 100%)',
              color: 'white',
              border: '1px solid rgba(196,181,253,0.35)',
              boxShadow: '0 4px 16px rgba(147,51,234,0.45), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
          <span className="text-[10px] text-white/50 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {formatDate(message.createdAt)}
          </span>
        </div>
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ring-2 ring-white/30"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
          <User size={16} className="text-white" />
        </div>
      </motion.div>
    );
  }

  // ── AI MESSAGE — left-aligned, soft background ─────────────────────────────
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      className="flex items-start gap-3 group">
      <Suspense fallback={
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-[0_0_18px_rgba(167,139,250,0.6)] ring-2 ring-white/30"
          style={{ background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #6366f1 100%)' }}>
          <Brain size={16} className="text-white" />
        </div>
      }>
        <div className="flex-shrink-0 w-9 h-9 rounded-full overflow-hidden ring-2 ring-white/30 shadow-[0_0_18px_rgba(167,139,250,0.6)]">
          {agentIcon ? (
            <div className="w-full h-full flex items-center justify-center text-lg"
              style={{ background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #6366f1 100%)' }}>
              {agentIcon}
            </div>
          ) : (
            <AgentAvatar3D color="#a855f7" size={36} />
          )}
        </div>
      </Suspense>

      <div className="flex flex-col gap-1.5 max-w-[85%] md:max-w-[75%] flex-1 min-w-0">
        <div className="relative">
          <div className={`px-4 py-3 rounded-2xl rounded-bl-md text-[15px] leading-relaxed backdrop-blur-md text-white ${isStreaming ? 'streaming-cursor' : ''}`}
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.85) 0%, rgba(37,99,235,0.85) 100%)',
              border: '1px solid rgba(147,197,253,0.4)',
              boxShadow: '0 4px 16px rgba(37,99,235,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}>
            <div className="prose prose-sm max-w-none prose-invert text-white">
              <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
            </div>
          </div>

          {/* Streaming dots indicator */}
          {isStreaming && !message.content && (
            <div className="absolute bottom-3 left-4 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </div>

        {/* Actions row — copy + feedback + timestamp */}
        {!isStreaming && message.content && (
          <div className="flex items-center gap-0.5 px-1 opacity-60 group-hover:opacity-100 transition-opacity">
            <button onClick={handleCopy} title={copied ? 'Copié !' : 'Copier'}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
            </button>

            {onFeedback && (
              <>
                <button onClick={() => handleFeedback('up')} disabled={!!feedbackSent || feedbackLoading}
                  title="Bonne réponse"
                  className={`p-1.5 rounded-md transition-colors ${
                    feedbackSent === 'up' ? 'text-green-500 bg-green-50 dark:bg-green-900/30'
                    : feedbackSent ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                  }`}>
                  <ThumbsUp size={12} />
                </button>
                <button onClick={() => handleFeedback('down')} disabled={!!feedbackSent || feedbackLoading}
                  title="Réponse à améliorer"
                  className={`p-1.5 rounded-md transition-colors ${
                    feedbackSent === 'down' ? 'text-red-500 bg-red-50 dark:bg-red-900/30'
                    : feedbackSent ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                  }`}>
                  <ThumbsDown size={12} />
                </button>
              </>
            )}

            {feedbackSent && <span className="text-[10px] text-gray-400 ml-1">Merci 🙏</span>}
            <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto">{formatDate(message.createdAt)}</span>
          </div>
        )}

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="w-full">
            <button onClick={() => setSourcesExpanded(p => !p)}
              className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors px-1 font-medium">
              {sourcesExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              📎 {message.sources.length} source{message.sources.length !== 1 ? 's' : ''}
            </button>
            <AnimatePresence>
              {sourcesExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-2 space-y-2">
                  {message.sources.map((source, idx) => <SourceCard key={idx} source={source} />)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Internal app paths (/foo) navigate via react-router (same tab); external URLs
// open in a new tab with an icon.
function SmartMarkdownLink({ href, children }: { href?: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  const isInternal = !!href && href.startsWith('/') && !href.startsWith('//');
  if (isInternal) {
    return (
      <a href={href} onClick={(e) => { e.preventDefault(); navigate(href!); }}
        className="text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium underline underline-offset-2 cursor-pointer">
        {children}
      </a>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium underline underline-offset-2">
      {children} <ExternalLink size={10} />
    </a>
  );
}

// ── Markdown renderer (unified, respects parent text color) ─────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const markdownComponents: any = {
  p: ({ children }: { children: React.ReactNode }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }: { children: React.ReactNode }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
  ol: ({ children }: { children: React.ReactNode }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
  li: ({ children }: { children: React.ReactNode }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }: { children: React.ReactNode }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: { children: React.ReactNode }) => <em className="italic text-violet-600 dark:text-violet-400">{children}</em>,
  code: ({ children }: { children: React.ReactNode }) => (
    <code className="bg-gray-200/70 dark:bg-gray-700 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded text-[85%] font-mono">{children}</code>
  ),
  pre: ({ children }: { children: React.ReactNode }) => (
    <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto mb-2 border border-gray-800">{children}</pre>
  ),
  h1: ({ children }: { children: React.ReactNode }) => <h1 className="text-base font-bold mb-2 mt-1">{children}</h1>,
  h2: ({ children }: { children: React.ReactNode }) => <h2 className="text-sm font-bold mb-1.5 mt-1">{children}</h2>,
  h3: ({ children }: { children: React.ReactNode }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
  blockquote: ({ children }: { children: React.ReactNode }) => (
    <blockquote className="border-l-4 border-violet-300 dark:border-violet-600 pl-3 my-2 italic text-gray-600 dark:text-gray-400">{children}</blockquote>
  ),
  a: ({ href, children }: { href?: string; children: React.ReactNode }) => <SmartMarkdownLink href={href}>{children}</SmartMarkdownLink>,
  hr: () => <hr className="my-3 border-gray-200 dark:border-gray-700" />,
  table: ({ children }: { children: React.ReactNode }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-xs border border-gray-200 dark:border-gray-700 rounded">{children}</table>
    </div>
  ),
  th: ({ children }: { children: React.ReactNode }) => (
    <th className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }: { children: React.ReactNode }) => (
    <td className="border border-gray-200 dark:border-gray-700 px-2 py-1">{children}</td>
  ),
};
