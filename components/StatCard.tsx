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
    chip: 'bg-indigo-500 text-white',
    bar: 'bg-indigo-500',
    num: 'text-indigo-600',
  },
  rose: {
    chip: 'bg-red-500 text-white',
    bar: 'bg-red-500',
    num: 'text-red-600',
  },
  amber: {
    chip: 'bg-amber-400 text-amber-950',
    bar: 'bg-amber-400',
    num: 'text-amber-600',
  },
  emerald: {
    chip: 'bg-emerald-500 text-white',
    bar: 'bg-emerald-500',
    num: 'text-emerald-600',
  },
  sky: {
    chip: 'bg-sky-500 text-white',
    bar: 'bg-sky-500',
    num: 'text-sky-600',
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
        <p className="truncate text-sm font-bold tracking-tight text-slate-800">
          {label}
        </p>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${a.chip}`}>
          {icon}
        </div>
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`font-mono text-[28px] font-bold leading-none tracking-tight tabular-nums ${a.num}`}>
          {value}
        </span>
        {unit && (
          <span className="font-mono text-xs font-medium text-slate-400">{unit}</span>
        )}
      </div>

      {typeof progress === 'number' && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${a.bar}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}

      {hint && (
        <p className="mt-2 truncate text-xs font-medium leading-5 text-slate-500">{hint}</p>
      )}
    </div>
  );
}
