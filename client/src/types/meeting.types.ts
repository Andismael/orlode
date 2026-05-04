export type MeetingStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  speakerName?: string;
  text: string;
  startTime: number; // seconds
  endTime: number;
  confidence?: number;
}

export interface ActionItem {
  id: string;
  text: string;
  assignee?: string;
  dueDate?: Date;
  status: 'open' | 'in-progress' | 'done';
  createdAt: Date;
}

export interface Meeting {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  date: Date;
  duration: number; // minutes
  participants: string[];
  status: MeetingStatus;
  hasTranscript: boolean;
  transcript?: TranscriptSegment[];
  summary?: string;
  actionItems?: ActionItem[];
  audioPath?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
