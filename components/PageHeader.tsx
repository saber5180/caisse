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
  indigo:
    'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-[0_6px_16px_-3px_rgba(79,70,229,0.4)] ring-indigo-400/30',
  rose:
    'bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-[0_6px_16px_-3px_rgba(225,29,72,0.4)] ring-rose-400/30',
  sky:
    'bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-[0_6px_16px_-3px_rgba(2,132,199,0.4)] ring-sky-400/30',
  amber:
    'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-[0_6px_16px_-3px_rgba(217,119,6,0.4)] ring-amber-400/30',
  emerald:
    'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-[0_6px_16px_-3px_rgba(5,150,105,0.4)] ring-emerald-400/30',
  slate:
    'bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-[0_6px_16px_-3px_rgba(15,23,42,0.35)] ring-slate-600/30',
};

export default function PageHeader({
  title,
  subtitle,
  icon,
  accent = 'indigo',
  badge,
  actions,
}: PageHeaderProps) {
  return (
    <div className="no-print mb-6 rounded-2xl border border-slate-200/85 bg-white/90 p-4 shadow-pro backdrop-blur-md sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3.5 sm:items-center">
          {icon && (
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ${accents[accent]}`}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[21px]">
                {title}
              </h1>
              {badge && (
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-indigo-700 ring-1 ring-inset ring-indigo-200">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="mt-0.5 text-xs font-medium text-slate-500 sm:text-[13px]">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
