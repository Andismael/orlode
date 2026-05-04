import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, User, Trash2 } from 'lucide-react';
import api from '@/services/api';

interface AddMeetingModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function AddMeetingModal({ onClose, onCreated }: AddMeetingModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [duration, setDuration] = useState(60);
  const [meetingType, setMeetingType] = useState('other');
  const [participants, setParticipants] = useState<string[]>(['']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const addParticipant = () => setParticipants((p) => [...p, '']);
  const removeParticipant = (i: number) => setParticipants((p) => p.filter((_, idx) => idx !== i));
  const updateParticipant = (i: number, val: string) =>
    setParticipants((p) => p.map((v, idx) => (idx === i ? val : v)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      await api.post('/meetings', {
        title: title.trim(),
        date: new Date(date).toISOString(),
        duration,
        meetingType,
        participants: participants.filter((p) => p.trim()),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message ?? 'Failed to create meeting');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
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
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between relative overflow-hidden" style={{ background: '#0092FF' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)' }} />
            <h2 className="text-base font-semibold text-white relative">New Meeting</h2>
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors relative">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Title */}
            <div>
              <label className="label">Meeting Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Q1 2024 Board Review"
                required
                className="input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Date */}
              <div>
                <label className="label">Date & Time</label>
                <input
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input"
                />
              </div>
              {/* Duration */}
              <div>
                <label className="label">Duration (min)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  min={15}
                  max={480}
                  step={15}
                  className="input"
                />
              </div>
            </div>

            {/* Meeting type */}
            <div>
              <label className="label">Meeting Type</label>
              <select value={meetingType} onChange={(e) => setMeetingType(e.target.value)} className="input">
                <option value="standup">Standup</option>
                <option value="planning">Planning</option>
                <option value="review">Review</option>
                <option value="client">Client</option>
                <option value="board">Board</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Participants */}
            <div>
              <label className="label">Participants</label>
              <div className="space-y-2">
                {participants.map((p, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={p}
                        onChange={(e) => updateParticipant(i, e.target.value)}
                        placeholder="Name or email"
                        className="input pl-8"
                      />
                    </div>
                    {participants.length > 1 && (
                      <button type="button" onClick={() => removeParticipant(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addParticipant}
                  className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                  style={{ color: '#0092FF' }}
                >
                  <Plus size={13} /> Add participant
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !title.trim()}
                className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50"
                style={{ background: '#0092FF' }}
              >
                {isLoading ? 'Creating...' : 'Create Meeting'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
