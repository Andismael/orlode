import React from 'react';

interface Props {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Max-width for content. Default 5xl. Pass 'full' for 100%. */
  maxWidth?: 'full' | '5xl' | '6xl' | '7xl';
}

const WIDTH_MAP = {
  full: 'max-w-full',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
};

/**
 * Shared shell for SuperAdmin pages — provides a consistent header (title +
 * optional subtitle + icon + right-aligned actions), responsive padding, and
 * a centered content container. Replaces the 14 ad-hoc page headers we had
 * before and gives the SuperAdmin section a cohesive look.
 */
export default function SuperAdminPage({
  title,
  subtitle,
  icon,
  actions,
  children,
  maxWidth = '5xl',
}: Props) {
  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 via-white to-violet-50/30">
      <div className={`${WIDTH_MAP[maxWidth]} mx-auto px-4 md:px-6 py-4 md:py-6`}>
        <header className="mb-4 md:mb-6 flex items-start gap-3">
          {icon && (
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 flex-shrink-0">
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">{title}</h1>
            {subtitle && <p className="text-xs md:text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>}
        </header>
        {children}
      </div>
    </div>
  );
}
