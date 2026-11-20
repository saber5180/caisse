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
  indigo: { chip: 'bg-indigo-50 text-indigo-600 ring-indigo-100', bar: 'from-indigo-400 to-indigo-600', num: 'text-slate-900', glow: 'bg-indigo-500/10' },
  rose: { chip: 'bg-rose-50 text-rose-600 ring-rose-100', bar: 'from-rose-400 to-rose-600', num: 'text-rose-600', glow: 'bg-rose-500/10' },
  amber: { chip: 'bg-amber-50 text-amber-600 ring-amber-100', bar: 'from-amber-300 to-amber-500', num: 'text-amber-600', glow: 'bg-amber-500/10' },
  emerald: { chip: 'bg-emerald-50 text-emerald-600 ring-emerald-100', bar: 'from-emerald-400 to-emerald-600', num: 'text-emerald-600', glow: 'bg-emerald-500/10' },
  sky: { chip: 'bg-sky-50 text-sky-600 ring-sky-100', bar: 'from-sky-400 to-sky-600', num: 'text-sky-600', glow: 'bg-sky-500/10' },
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
      className={`card card-hover group relative flex h-full flex-col overflow-hidden p-4 sm:p-5 ${
        onClick ? 'cursor-pointer select-none' : ''
      } ${className}`}
    >
      <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl ${a.glow}`} />
      <div className="relative flex items-center justify-between gap-3">
        <p className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${a.chip}`}>
          {icon}
        </div>
      </div>

      <div className="relative mt-3 flex items-baseline gap-1.5">
        <span className={`font-mono text-[26px] font-bold leading-none tracking-tight tabular-nums sm:text-[30px] ${a.num}`}>
          {value}
        </span>
        {unit && <span className="font-mono text-xs font-semibold text-slate-400">{unit}</span>}
      </div>

      {typeof progress === 'number' && (
        <div className="relative mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${a.bar}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}

      {hint && <p className="relative mt-2.5 truncate text-xs font-medium text-slate-500">{hint}</p>}
    </div>
  );
}
