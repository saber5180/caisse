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
  indigo: {
    chip: 'bg-indigo-50/90 text-indigo-700 ring-1 ring-indigo-200/60',
    bar: 'from-indigo-600 via-indigo-500 to-indigo-400',
  },
  rose: {
    chip: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/60',
    bar: 'from-rose-600 via-rose-500 to-rose-400',
  },
  amber: {
    chip: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/60',
    bar: 'from-amber-500 via-amber-400 to-amber-300',
  },
  emerald: {
    chip: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/60',
    bar: 'from-emerald-600 via-emerald-500 to-emerald-400',
  },
  sky: {
    chip: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200/60',
    bar: 'from-sky-600 via-sky-500 to-sky-400',
  },
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
    <div className="card-pro card-pro-interactive relative overflow-hidden p-5">
      <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${a.bar}`} />

      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm ${a.chip}`}>
          {icon}
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-[28px] font-black leading-none tracking-tight text-slate-900 tabular-nums">
          {value}
        </span>
        {unit && <span className="text-xs font-bold text-slate-400 uppercase">{unit}</span>}
      </div>

      {hint && <p className="mt-2.5 text-xs text-slate-400 font-medium">{hint}</p>}
    </div>
  );
}
