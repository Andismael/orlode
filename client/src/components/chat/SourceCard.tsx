import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import type { Source } from '@/types/chat.types';

interface SourceCardProps {
  source: Source;
}

export default function SourceCard({ source }: SourceCardProps) {
  return (
    <div className="flex gap-3 p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs">
      <div className="w-7 h-7 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
        <FileText size={12} className="text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-medium text-slate-200 truncate">{source.documentName}</span>
          {source.page && (
            <span className="text-slate-500 flex-shrink-0">p. {source.page}</span>
          )}
        </div>
        {source.excerpt && (
          <p className="text-slate-400 line-clamp-2 leading-relaxed">"{source.excerpt}"</p>
        )}
        {source.score !== undefined && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="flex-1 bg-slate-700 rounded-full h-1">
              <div
                className="bg-blue-500 h-1 rounded-full"
                style={{ width: `${Math.round(source.score * 100)}%` }}
              />
            </div>
            <span className="text-slate-500">{Math.round(source.score * 100)}% match</span>
          </div>
        )}
      </div>
    </div>
  );
}
