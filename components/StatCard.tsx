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
    chip: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
    glow: 'from-rose-400/10 via-rose-400/0 to-transparent',
    bar: 'bg-rose-400',
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
      className={`card card-hover relative flex h-full flex-col p-4 ${
        onClick ? 'cursor-pointer select-none' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-medium leading-5 text-slate-600">
          {label}
        </p>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${a.chip}`}>
          {icon}
        </div>
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-semibold leading-none tabular-nums text-slate-900">
          {value}
        </span>
        {unit && (
          <span className="font-mono text-xs font-medium text-slate-400">{unit}</span>
        )}
      </div>

      {typeof progress === 'number' && (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${a.bar}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}

      {hint && (
        <p className="mt-2 truncate text-xs leading-5 text-slate-500">{hint}</p>
      )}
    </div>
  );
}
