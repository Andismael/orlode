/**
 * ContentBlockRenderer — Renders mixed multimedia content blocks
 * Supports: text, video (YouTube/upload), PDF, link, image, quiz reference
 */
import React from 'react';
import { FileText, ExternalLink, Image as ImageIcon, HelpCircle } from 'lucide-react';
import VideoPlayer from './VideoPlayer';

export interface ContentBlock {
  type: 'text' | 'video' | 'pdf' | 'link' | 'image' | 'quiz';
  value?: string;
  url?: string;
  label?: string;
  id?: string;
}

interface ContentBlockRendererProps {
  blocks: ContentBlock[];
  onVideoComplete?: () => void;
  onQuizClick?: (quizId: string) => void;
}

export default function ContentBlockRenderer({ blocks, onVideoComplete, onQuizClick }: ContentBlockRendererProps) {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'video':
            return (
              <div key={i}>
                <VideoPlayer url={block.url ?? ''} title={block.label} onComplete={onVideoComplete} />
              </div>
            );

          case 'text':
            return (
              <div key={i} className="prose prose-sm max-w-none text-gray-700">
                {(block.value ?? '').split('\n').map((line, j) => {
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return <h3 key={j} className="text-sm font-bold text-gray-800 mt-4 mb-2">{line.replace(/\*\*/g, '')}</h3>;
                  }
                  if (line.match(/^\d+\.\s/)) {
                    return <p key={j} className="text-sm text-gray-600 ml-4">{line}</p>;
                  }
                  return line ? <p key={j}>{line}</p> : <br key={j} />;
                })}
              </div>
            );

          case 'pdf':
            return (
              <a key={i} href={block.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center group-hover:bg-red-200">
                  <FileText size={18} className="text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{block.label ?? 'Document PDF'}</p>
                  <p className="text-xs text-gray-500">Cliquer pour ouvrir le PDF</p>
                </div>
                <ExternalLink size={14} className="text-gray-400" />
              </a>
            );

          case 'link':
            return (
              <a key={i} href={block.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors">
                <ExternalLink size={16} className="text-blue-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-blue-700 truncate">{block.label ?? block.url}</p>
                  <p className="text-xs text-blue-500 truncate">{block.url}</p>
                </div>
              </a>
            );

          case 'image':
            return (
              <div key={i} className="rounded-xl overflow-hidden border border-gray-100">
                <img src={block.url} alt={block.label ?? 'Image'} className="w-full object-contain max-h-96" />
                {block.label && <p className="text-xs text-gray-500 text-center py-2 bg-gray-50">{block.label}</p>}
              </div>
            );

          case 'quiz':
            return (
              <button key={i} onClick={() => onQuizClick?.(block.id ?? '')}
                className="flex items-center gap-3 p-4 w-full bg-purple-50 border border-purple-100 rounded-xl hover:bg-purple-100 transition-colors text-left">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <HelpCircle size={18} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{block.label ?? 'Quiz de validation'}</p>
                  <p className="text-xs text-purple-600">Testez vos connaissances</p>
                </div>
              </button>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
