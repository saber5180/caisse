import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  accent?: 'indigo' | 'rose' | 'sky' | 'amber' | 'emerald' | 'slate';
  badge?: string;
  actions?: ReactNode;
}

const accents: Record<string, { chip: string; line: string }> = {
  indigo: { chip: 'from-indigo-500 to-violet-600 shadow-[0_8px_20px_-6px_rgba(79,70,229,0.6)]', line: 'from-indigo-500' },
  rose: { chip: 'from-rose-500 to-pink-600 shadow-[0_8px_20px_-6px_rgba(225,29,72,0.55)]', line: 'from-rose-500' },
  sky: { chip: 'from-sky-500 to-cyan-600 shadow-[0_8px_20px_-6px_rgba(2,132,199,0.55)]', line: 'from-sky-500' },
  amber: { chip: 'from-amber-400 to-orange-500 shadow-[0_8px_20px_-6px_rgba(217,119,6,0.55)]', line: 'from-amber-400' },
  emerald: { chip: 'from-emerald-500 to-teal-600 shadow-[0_8px_20px_-6px_rgba(5,150,105,0.55)]', line: 'from-emerald-500' },
  slate: { chip: 'from-slate-700 to-slate-900 shadow-[0_8px_20px_-6px_rgba(15,23,42,0.45)]', line: 'from-slate-600' },
};

export default function PageHeader({
  title,
  subtitle,
  icon,
  accent = 'indigo',
  badge,
  actions,
}: PageHeaderProps) {
  const a = accents[accent] || accents.indigo;
  return (
    <div className="no-print relative mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card sm:p-5">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${a.line} via-transparent to-transparent`} />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3.5 sm:items-center">
          {icon && (
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white ring-1 ring-inset ring-white/20 ${a.chip}`}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-2xl">
                {title}
              </h1>
              {badge && <span className="badge-indigo uppercase">{badge}</span>}
            </div>
            {subtitle && (
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-500">{subtitle}</p>
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
