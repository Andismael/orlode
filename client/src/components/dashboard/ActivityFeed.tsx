import React from 'react';
import { motion } from 'framer-motion';
import { FileText, MessageSquare, Video, Upload, User } from 'lucide-react';
import { formatDate } from '@/utils/formatters';

interface ActivityItem {
  id: string;
  type: 'document' | 'chat' | 'meeting' | 'upload' | 'user';
  title: string;
  description: string;
  timestamp: Date;
  user?: string;
}

interface ActivityFeedProps {
  items?: ActivityItem[];
}

const DEMO_ACTIVITIES: ActivityItem[] = [
  {
    id: '1',
    type: 'upload',
    title: 'Document uploaded',
    description: 'Q4-2024-Financial-Report.pdf was uploaded and processed',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    user: 'Marie Dupont',
  },
  {
    id: '2',
    type: 'chat',
    title: 'New conversation',
    description: 'Asked about quarterly revenue targets',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    user: 'Jean Martin',
  },
  {
    id: '3',
    type: 'meeting',
    title: 'Meeting transcribed',
    description: 'Board Meeting 2024-03-15 transcription completed',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    user: 'System',
  },
  {
    id: '4',
    type: 'document',
    title: 'Document indexed',
    description: 'HR-Policy-2024.docx has been indexed (247 chunks)',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
    user: 'System',
  },
  {
    id: '5',
    type: 'user',
    title: 'New user joined',
    description: 'Pierre Bernard joined the workspace',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
];

const iconMap = {
  document: FileText,
  chat: MessageSquare,
  meeting: Video,
  upload: Upload,
  user: User,
};

const iconColors: Record<string, string> = {
  document: '#0092FF',
  chat:     '#FF009D',
  meeting:  '#FFA200',
  upload:   '#00A550',
  user:     '#0049FF',
};

export function ActivityFeed({ items }: ActivityFeedProps) {
  const displayItems = items && items.length > 0 ? items : DEMO_ACTIVITIES;
  return (
    <div className="rounded-xl overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #FF009D 0%, #0049FF 100%)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%)' }} />
      <div className="px-5 py-4 relative" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
        <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
      </div>
      <div className="relative">
        {displayItems.map((item, index) => {
          const Icon = iconMap[item.type];
          const color = iconColors[item.type];

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-white/10"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: color }}>
                <Icon size={14} color="#fff" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{item.title}</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{item.description}</p>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{formatDate(item.timestamp)}</p>
                {item.user && (
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.user}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default ActivityFeed;
