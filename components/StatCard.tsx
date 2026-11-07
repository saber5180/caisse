import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  accent?: 'indigo' | 'rose' | 'amber' | 'emerald' | 'sky';
  hint?: string;
  progress?: number;
  onClick?: () => void;
  className?: string;
}

const accents = {
  indigo: {
    chip: 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/80',
    glow: 'from-indigo-500/12 via-indigo-500/4 to-transparent',
    bar: 'bg-indigo-600',
    dot: 'bg-indigo-500',
  },
  rose: {
    chip: 'bg-rose-50 text-rose-600 ring-1 ring-rose-200/80',
    glow: 'from-rose-500/12 via-rose-500/4 to-transparent',
    bar: 'bg-rose-600',
    dot: 'bg-rose-500',
  },
  amber: {
    chip: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/80',
    glow: 'from-amber-500/12 via-amber-500/4 to-transparent',
    bar: 'bg-amber-500',
    dot: 'bg-amber-500',
  },
  emerald: {
    chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80',
    glow: 'from-emerald-500/12 via-emerald-500/4 to-transparent',
    bar: 'bg-emerald-600',
    dot: 'bg-emerald-500',
  },
  sky: {
    chip: 'bg-sky-50 text-sky-600 ring-1 ring-sky-200/80',
    glow: 'from-sky-500/12 via-sky-500/4 to-transparent',
    bar: 'bg-sky-600',
    dot: 'bg-sky-500',
  },
};

export default function StatCard({
  label,
  value,
  unit,
  icon,
  accent = 'indigo',
  hint,
  progress,
  onClick,
  className = '',
}: StatCardProps) {
  const a = accents[accent];

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`card card-hover relative overflow-hidden p-5 ${
        onClick ? 'cursor-pointer hover:shadow-pro-lg hover:border-slate-300 transition-all select-none' : ''
      } ${className}`}
    >
      {/* Subtle ambient corner glow */}
      <div
        className={`pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-gradient-to-bl ${a.glow} blur-xl`}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-slate-500">
            {label}
          </p>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="font-mono text-[26px] font-extrabold leading-none tracking-tight text-slate-900 tabular-nums sm:text-[28px]">
              {value}
            </span>
            {unit && (
              <span className="font-mono text-xs font-bold uppercase text-slate-400">
                {unit}
              </span>
            )}
          </div>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ${a.chip}`}
        >
          {icon}
        </div>
      </div>

      {typeof progress === 'number' && (
        <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${a.bar}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}

      {hint && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2.5 text-xs font-medium text-slate-500">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.dot}`} />
          <span className="truncate">{hint}</span>
        </div>
      )}
    </div>
  );
}
