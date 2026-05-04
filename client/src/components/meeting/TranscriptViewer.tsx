import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, CheckSquare, Lightbulb, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';

interface ActionItem {
  id: string;
  text: string;
  assignee?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in-progress' | 'done';
}

interface TranscriptSegment {
  speaker: string;
  text: string;
  timestamp?: number;
}

interface TranscriptViewerProps {
  meeting: {
    title: string;
    summary?: string;
    keyDecisions?: string[];
    actionItems?: ActionItem[];
    transcriptText?: string;
    transcript?: TranscriptSegment[];
    sentiment?: string;
    topics?: string[];
    transcriptLanguage?: string;
    transcriptWordCount?: number;
  };
  onClose: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  high:   '#FF009D',
  medium: '#FFA200',
  low:    '#00A550',
};

function formatTimestamp(seconds?: number): string {
  if (seconds === undefined) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TranscriptViewer({ meeting, onClose }: TranscriptViewerProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'actions' | 'transcript'>('summary');
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  const tabs = [
    { id: 'summary' as const,    label: 'Summary',      icon: Lightbulb,     color: '#0092FF' },
    { id: 'actions' as const,    label: 'Action Items', icon: CheckSquare,   color: '#FF009D' },
    { id: 'transcript' as const, label: 'Transcript',   icon: MessageSquare, color: '#FFA200' },
  ];

  const activeColor = tabs.find((t) => t.id === activeTab)?.color ?? '#0092FF';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-start justify-between flex-shrink-0 relative overflow-hidden" style={{ background: '#0019FF' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)' }} />
          <div className="relative">
            <h2 className="text-base font-semibold text-white">{meeting.title}</h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {meeting.transcriptLanguage && (
                <span className="text-xs text-white/70">Lang: {meeting.transcriptLanguage.toUpperCase()}</span>
              )}
              {meeting.transcriptWordCount && (
                <span className="text-xs text-white/70">{meeting.transcriptWordCount} words</span>
              )}
              {meeting.sentiment && (
                <span className="text-xs text-white/70 capitalize">Sentiment: {meeting.sentiment}</span>
              )}
            </div>
            {meeting.topics && meeting.topics.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {meeting.topics.slice(0, 5).map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>{t}</span>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors relative flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors border-b-2"
                style={{
                  borderBottomColor: isActive ? tab.color : 'transparent',
                  color: isActive ? tab.color : '#9ca3af',
                }}
              >
                <Icon size={14} />
                {tab.label}
                {tab.id === 'actions' && meeting.actionItems && meeting.actionItems.length > 0 && (
                  <span className="text-white text-xs rounded-full w-4 h-4 flex items-center justify-center" style={{ background: tab.color }}>
                    {meeting.actionItems.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'summary' && (
            <div className="space-y-5">
              {meeting.summary ? (
                <>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: activeColor }}>Executive Summary</h3>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{meeting.summary}</p>
                  </div>
                  {meeting.keyDecisions && meeting.keyDecisions.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: activeColor }}>Key Decisions</h3>
                      <ul className="space-y-2">
                        {meeting.keyDecisions.map((d, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 mt-0.5" style={{ background: activeColor }}>
                              {i + 1}
                            </span>
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">No summary available</p>
              )}
            </div>
          )}

          {activeTab === 'actions' && (
            <div className="space-y-3">
              {meeting.actionItems && meeting.actionItems.length > 0 ? (
                meeting.actionItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-2" style={{ background: PRIORITY_COLORS[item.priority] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 font-medium">{item.text}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {item.assignee && (
                          <span className="text-xs text-gray-500">👤 {item.assignee}</span>
                        )}
                        {item.dueDate && (
                          <span className="text-xs text-gray-500">📅 {item.dueDate}</span>
                        )}
                        <span className="text-xs capitalize font-medium" style={{ color: PRIORITY_COLORS[item.priority] }}>
                          {item.priority} priority
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">No action items detected</p>
              )}
            </div>
          )}

          {activeTab === 'transcript' && (
            <div className="space-y-3">
              {meeting.transcript && meeting.transcript.length > 0 ? (
                <>
                  {(showFullTranscript ? meeting.transcript : meeting.transcript.slice(0, 8)).map((seg, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex-shrink-0 text-right w-14">
                        {seg.timestamp !== undefined && (
                          <span className="text-xs text-gray-400 font-mono">{formatTimestamp(seg.timestamp)}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold" style={{ color: activeColor }}>{seg.speaker}</span>
                        <p className="text-sm text-gray-700 mt-0.5">{seg.text}</p>
                      </div>
                    </div>
                  ))}
                  {meeting.transcript.length > 8 && (
                    <button
                      onClick={() => setShowFullTranscript((v) => !v)}
                      className="flex items-center gap-1.5 text-xs font-medium mx-auto mt-2 transition-colors"
                      style={{ color: activeColor }}
                    >
                      {showFullTranscript ? <><ChevronUp size={13} /> Show less</> : <><ChevronDown size={13} /> Show all {meeting.transcript.length} segments</>}
                    </button>
                  )}
                </>
              ) : meeting.transcriptText ? (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{meeting.transcriptText}</p>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">No transcript available</p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
