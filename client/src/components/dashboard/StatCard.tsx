import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  icon: React.ReactNode;
  bgColor?: string; // hex
  delay?: number;
}

export function StatCard({ title, value, subtitle, trend, icon, bgColor = '#0092FF', delay = 0 }: StatCardProps) {
  const TrendIcon = trend === undefined || trend === 0 ? Minus : trend > 0 ? TrendingUp : TrendingDown;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-xl p-5 relative overflow-hidden"
      style={{ background: bgColor }}
    >
      {/* Subtle gloss overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 60%)' }} />

      <div className="flex items-start justify-between mb-4 relative">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
          <span className="text-white">{icon}</span>
        </div>
        {trend !== undefined && (
          <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
            <TrendIcon size={12} />
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>

      <motion.p
        className="text-2xl font-bold text-white mb-1 relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: delay + 0.1 }}
      >
        {value}
      </motion.p>
      <p className="text-sm font-medium text-white relative">{title}</p>
      {subtitle && <p className="text-xs mt-1 relative" style={{ color: 'rgba(255,255,255,0.7)' }}>{subtitle}</p>}
    </motion.div>
  );
}

export default StatCard;
