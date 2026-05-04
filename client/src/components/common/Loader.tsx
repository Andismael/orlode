import React from 'react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const sizeMap = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-10 h-10 border-3',
};

export function Loader({ size = 'md', label }: LoaderProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`${sizeMap[size]} border-slate-600 border-t-blue-500 rounded-full animate-spin`}
      />
      {label && <p className="text-sm text-slate-400">{label}</p>}
    </div>
  );
}

// Skeleton variants
interface SkeletonProps {
  className?: string;
  lines?: number;
}

export function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-slate-700 rounded animate-pulse ${className}`}
    />
  );
}

export function SkeletonCard({ lines = 3 }: SkeletonProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
      <SkeletonLine className="h-4 w-3/4" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <SkeletonLine key={i} className={`h-3 ${i === lines - 2 ? 'w-1/2' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function SkeletonText({ lines = 3 }: SkeletonProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

export function PageLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader size="lg" label={label} />
    </div>
  );
}

export default Loader;
