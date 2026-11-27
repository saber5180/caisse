import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  accent?: 'indigo' | 'rose' | 'sky' | 'amber' | 'emerald' | 'slate';
  badge?: string;
  actions?: ReactNode;
}

const accents: Record<string, string> = {
  indigo: 'bg-sky-600 text-white',
  rose: 'bg-rose-600 text-white',
  sky: 'bg-sky-600 text-white',
  amber: 'bg-slate-800 text-white',
  emerald: 'bg-emerald-600 text-white',
  slate: 'bg-slate-700 text-white',
};

export default function PageHeader({
  title,
  subtitle,
  icon,
  accent = 'indigo',
  badge,
  actions,
}: PageHeaderProps) {
  const chip = accents[accent] || accents.indigo;
  return (
    <div className="no-print mb-5 flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        {icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ${chip}`}>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold leading-snug tracking-tight text-slate-900 sm:text-xl">
              {title}
            </h1>
            {badge && <span className="badge-slate">{badge}</span>}
          </div>
          {subtitle && (
            <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
