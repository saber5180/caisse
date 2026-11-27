import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  accent?: 'indigo' | 'rose' | 'amber' | 'emerald' | 'sky' | 'slate';
  hint?: string;
  progress?: number;
  onClick?: () => void;
  className?: string;
}

const accents = {
  indigo: {
    topBar: 'bg-indigo-500',
    chip: 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/70',
    bar: 'bg-indigo-500',
    num: 'text-slate-900',
    pct: 'bg-indigo-50 text-indigo-700',
    hoverBorder: 'hover:border-indigo-300',
  },
  slate: {
    topBar: 'bg-slate-600',
    chip: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
    bar: 'bg-slate-600',
    num: 'text-slate-900',
    pct: 'bg-slate-100 text-slate-700',
    hoverBorder: 'hover:border-slate-300',
  },
  rose: {
    topBar: 'bg-rose-500',
    chip: 'bg-rose-50 text-rose-600 ring-1 ring-rose-200/80',
    bar: 'bg-rose-500',
    num: 'text-rose-600',
    pct: 'bg-rose-50 text-rose-700',
    hoverBorder: 'hover:border-rose-300',
  },
  amber: {
    topBar: 'bg-orange-500',
    chip: 'bg-orange-50 text-orange-600 ring-1 ring-orange-200/80',
    bar: 'bg-orange-500',
    num: 'text-orange-600',
    pct: 'bg-orange-50 text-orange-700',
    hoverBorder: 'hover:border-orange-300',
  },
  emerald: {
    topBar: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/80',
    bar: 'bg-emerald-500',
    num: 'text-emerald-600',
    pct: 'bg-emerald-50 text-emerald-700',
    hoverBorder: 'hover:border-emerald-300',
  },
  sky: {
    topBar: 'bg-sky-500',
    chip: 'bg-sky-50 text-sky-600 ring-1 ring-sky-200/80',
    bar: 'bg-sky-500',
    num: 'text-sky-600',
    pct: 'bg-sky-50 text-sky-700',
    hoverBorder: 'hover:border-sky-300',
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
  const roundedPct = typeof progress === 'number' ? Math.round(Math.min(100, Math.max(0, progress))) : null;

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
      className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-4.5 shadow-2xs transition-all duration-200 ${
        onClick ? `cursor-pointer select-none hover:-translate-y-0.5 hover:shadow-md ${a.hoverBorder}` : ''
      } ${className}`}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 ${a.topBar} opacity-85`} />

      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${a.chip}`}>
            {icon}
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className={`font-mono text-2xl font-extrabold leading-none tabular-nums sm:text-3xl ${a.num}`}>
              {value}
            </span>
            {unit && <span className="font-mono text-xs font-semibold text-slate-400">{unit}</span>}
          </div>
          {roundedPct !== null && (
            <span className={`rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-bold ${a.pct}`}>
              {roundedPct}%
            </span>
          )}
        </div>
      </div>

      <div className="mt-3.5">
        {typeof progress === 'number' && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${a.bar}`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}

        {hint && (
          <p className="mt-2 flex items-center justify-between gap-1 truncate text-[11px] font-medium text-slate-500">
            <span className="truncate">{hint}</span>
            {onClick && (
              <span className="shrink-0 font-semibold text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-700">
                Voir →
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
