import React, { useState, useEffect, useRef } from 'react';
import { Video, Plus, Calendar, Clock, Users, FileText, ChevronRight, Upload, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/common/Badge';
import { formatDuration } from '@/utils/formatters';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import AddMeetingModal from '@/components/meeting/AddMeetingModal';
import TranscriptViewer from '@/components/meeting/TranscriptViewer';

interface ActionItem {
  id: string;
  text: string;
  assignee?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in-progress' | 'done';
}

interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: number;
  participants: string[];
  status: 'scheduled' | 'completed' | 'cancelled';
  hasTranscript: boolean;
  transcriptionStatus?: 'processing' | 'done' | 'error';
  summary?: string;
  keyDecisions?: string[];
  actionItems?: ActionItem[];
  transcriptText?: string;
  transcript?: Array<{ speaker: string; text: string; timestamp?: number }>;
  sentiment?: string;
  topics?: string[];
  transcriptLanguage?: string;
  transcriptWordCount?: number;
}

const STAT_COLORS = ['#0092FF', '#00A550', '#FFA200'];

export default function MeetingPage() {
  const { t } = useLangStore();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingMeeting, setViewingMeeting] = useState<Meeting | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetId = useRef<string | null>(null);

  const fetchMeetings = async () => {
    try {
      const res = await api.get<Meeting[]>('/meetings');
      setMeetings(Array.isArray(res.data) ? res.data : []);
    } catch {
      // keep empty on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchMeetings(); }, []);

  const upcoming = meetings.filter((m) => m.status === 'scheduled');
  const past = meetings.filter((m) => m.status === 'completed');
  const displayList = activeTab === 'upcoming' ? upcoming : past;

  const stats = [
    { label: 'Upcoming',    value: upcoming.length },
    { label: 'Transcribed', value: past.filter((m) => m.hasTranscript).length },
    { label: 'Total Hours', value: `${Math.round(meetings.reduce((s, m) => s + m.duration, 0) / 60)}h` },
  ];

  const handleUploadClick = (meetingId: string) => {
    uploadTargetId.current = meetingId;
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = uploadTargetId.current;
    if (!file || !id) return;

    setUploadingId(id);
    setUploadError(null);

    const formData = new FormData();
    formData.append('audio', file);

    try {
      await api.post(`/meetings/${id}/transcribe`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 5 * 60 * 1000, // 5 min for large files
      });
      await fetchMeetings();
    } catch (err) {
      setUploadError((err as Error).message ?? 'Transcription failed');
    } finally {
      setUploadingId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Meetings</h2>
          <p className="text-sm text-gray-500 mt-1">Manage meetings and transcriptions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMeetings}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
          >
            <Plus size={14} />
            Add Meeting
          </button>
        </div>
      </div>

      {/* Upload error */}
      <AnimatePresence>
        {uploadError && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3"
          >
            {uploadError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat, i) => (
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

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-xl p-1 w-fit">
        {(['upcoming', 'past'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200"
            style={activeTab === tab
              ? { background: '#0092FF', color: 'white' }
              : { color: '#6b7280' }
            }
          >
            {tab === 'upcoming' ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
          </button>
        ))}
      </div>

      {/* Meeting list */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : displayList.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <Video size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">No {activeTab} meetings</p>
            {activeTab === 'upcoming' && (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-3 text-sm font-medium transition-colors"
                style={{ color: '#0092FF' }}
              >
                Create your first meeting
              </button>
            )}
          </div>
        ) : (
          displayList.map((meeting, index) => {
            const isUploading = uploadingId === meeting.id;
            const isProcessing = meeting.transcriptionStatus === 'processing';

            return (
              <motion.div
                key={meeting.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm rounded-xl p-5 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#FFA200' }}>
                      <Video size={18} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{meeting.title}</h3>
                        <Badge variant={meeting.status === 'scheduled' ? 'info' : 'success'} dot>
                          {meeting.status === 'scheduled' ? 'Scheduled' : 'Done'}
                        </Badge>
                        {meeting.hasTranscript && (
                          <Badge variant="default">
                            <FileText size={10} className="inline mr-1" />
                            Transcript
                          </Badge>
                        )}
                        {(isUploading || isProcessing) && (
                          <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#0092FF' }}>
                            <Loader2 size={11} className="animate-spin" />
                            {isUploading ? 'Uploading...' : 'Transcribing...'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={11} />
                          {new Date(meeting.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock size={11} />
                          {formatDuration(meeting.duration)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users size={11} />
                          {meeting.participants.length} participants
                        </span>
                      </div>
                      {meeting.participants.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {meeting.participants.slice(0, 3).map((p) => (
                            <span key={p} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p}</span>
                          ))}
                          {meeting.participants.length > 3 && (
                            <span className="text-xs text-gray-400">+{meeting.participants.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {meeting.hasTranscript ? (
                      <button
                        onClick={() => setViewingMeeting(meeting)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
                        style={{ background: '#0019FF' }}
                      >
                        <FileText size={12} />
                        View
                      </button>
                    ) : meeting.status === 'completed' && !isUploading && !isProcessing ? (
                      <button
                        onClick={() => handleUploadClick(meeting.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
                        style={{ background: '#FFA200' }}
                      >
                        <Upload size={12} />
                        Transcribe
                      </button>
                    ) : null}
                    <ChevronRight size={16} className="text-gray-300" />
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Phase 2 banner */}
      <div className="rounded-xl p-5 text-center relative overflow-hidden" style={{ background: 'linear-gradient(90deg, #0049FF, #FF009D)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)' }} />
        <p className="text-sm font-semibold text-white mb-1 relative">Live Meeting Transcription — Phase 2</p>
        <p className="text-xs relative" style={{ color: 'rgba(255,255,255,0.8)' }}>
          Real-time AI transcription during meetings · Upload audio/video files to transcribe now
        </p>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddMeetingModal
          onClose={() => setShowAddModal(false)}
          onCreated={fetchMeetings}
        />
      )}
      {viewingMeeting && (
        <TranscriptViewer
          meeting={viewingMeeting}
          onClose={() => setViewingMeeting(null)}
        />
      )}
    </div>
  );
}
