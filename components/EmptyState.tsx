import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
}

export default function EmptyState({ icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50 text-indigo-600 shadow-sm">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-extrabold tracking-tight text-slate-900">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-500 sm:text-sm">
          {description}
        </p>
      )}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
