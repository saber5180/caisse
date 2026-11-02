import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  accent?: 'indigo' | 'rose' | 'amber' | 'emerald' | 'sky';
  hint?: string;
}

const accents = {
  indigo: { chip: 'bg-indigo-50 text-indigo-600', bar: 'from-indigo-500 to-indigo-300' },
  rose: { chip: 'bg-rose-50 text-rose-600', bar: 'from-rose-500 to-rose-300' },
  amber: { chip: 'bg-amber-50 text-amber-600', bar: 'from-amber-500 to-amber-300' },
  emerald: { chip: 'bg-emerald-50 text-emerald-600', bar: 'from-emerald-500 to-emerald-300' },
  sky: { chip: 'bg-sky-50 text-sky-600', bar: 'from-sky-500 to-sky-300' },
};

export default function StatCard({
  label,
  value,
  unit,
  icon,
  accent = 'indigo',
  hint,
}: StatCardProps) {
  const a = accents[accent];

  return (
    <div className="card card-hover relative overflow-hidden p-5">
      <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${a.bar}`} />

      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${a.chip}`}>{icon}</div>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[26px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">
          {value}
        </span>
        {unit && <span className="text-sm font-semibold text-slate-400">{unit}</span>}
      </div>

      {hint && <p className="mt-2 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

