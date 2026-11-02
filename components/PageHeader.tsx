import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  accent?: 'indigo' | 'rose' | 'sky' | 'amber' | 'emerald' | 'slate';
  actions?: ReactNode;
}

const accents: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
  rose: 'bg-rose-50 text-rose-600 ring-rose-100',
  sky: 'bg-sky-50 text-sky-600 ring-sky-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export default function PageHeader({
  title,
  subtitle,
  icon,
  accent = 'indigo',
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3.5">
        {icon && (
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${accents[accent]}`}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold leading-tight tracking-tight text-slate-900 sm:text-[22px]">
            {title}
          </h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>

      {actions && (
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          {actions}
        </div>
      )}
    </div>
  );
}

