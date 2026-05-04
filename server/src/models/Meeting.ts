import { Timestamp } from 'firebase-admin/firestore';

export type MeetingStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  speakerName?: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence?: number;
}

export interface ActionItem {
  id: string;
  text: string;
  assignee?: string;
  dueDate?: Timestamp | Date;
  status: 'open' | 'in-progress' | 'done';
  createdAt: Timestamp | Date;
}

export interface Meeting {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  date: Timestamp | Date;
  duration: number;
  participants: string[];
  status: MeetingStatus;
  hasTranscript: boolean;
  transcript?: TranscriptSegment[];
  summary?: string;
  actionItems?: ActionItem[];
  audioPath?: string;
  createdBy: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}
