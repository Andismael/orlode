import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';
import type { ProcessingJob } from '@/types/data.types';

interface ProcessingStatusProps {
  jobs: ProcessingJob[];
}

const statusConfig = {
  pending: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Pending' },
  processing: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Processing', spin: true },
  completed: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Done' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Failed' },
};

export function ProcessingStatus({ jobs }: ProcessingStatusProps) {
  const activeJobs = jobs.filter((j) => j.status === 'processing' || j.status === 'pending');

  if (activeJobs.length === 0) return null;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
        <Loader2 size={14} className="text-blue-400 animate-spin" />
        <h3 className="text-sm font-semibold text-slate-100">Processing Queue</h3>
        <span className="ml-auto text-xs text-blue-400 font-medium">{activeJobs.length} active</span>
      </div>

      <div className="divide-y divide-slate-700/50">
        {jobs.map((job) => {
          const config = statusConfig[job.status];
          const Icon = config.icon;

          return (
            <motion.div
              key={job.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 px-5 py-3.5"
            >
              <div className={`w-7 h-7 ${config.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Icon
                  size={13}
                  className={`${config.color} ${'spin' in config && config.spin ? 'animate-spin' : ''}`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">{job.filename}</p>
                <div className="mt-1.5">
                  {job.status === 'processing' && job.progress !== undefined && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-700 rounded-full h-1">
                        <motion.div
                          className="bg-blue-500 h-1 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${job.progress}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 flex-shrink-0">{job.progress}%</span>
                    </div>
                  )}
                  {job.status !== 'processing' && (
                    <p className="text-xs text-slate-500">{job.message ?? config.label}</p>
                  )}
                </div>
              </div>

              <span className={`text-xs font-medium flex-shrink-0 ${config.color}`}>
                {config.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default ProcessingStatus;
