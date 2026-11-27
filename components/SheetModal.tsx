'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './Icons';

type SheetModalProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  accent?: 'rose' | 'amber' | 'emerald' | 'indigo';
};

export default function SheetModal({
  title,
  subtitle,
  onClose,
  children,
  toolbar,
  footer,
  size = 'md',
  accent,
}: SheetModalProps) {
  const dotColor = accent
    ? {
        rose: 'bg-rose-500',
        amber: 'bg-orange-500',
        emerald: 'bg-emerald-500',
        indigo: 'bg-sky-600',
      }[accent]
    : 'bg-slate-400';

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return createPortal(
    <div className="no-print fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Fermer la fenêtre"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`animate-scale-in relative flex max-h-[min(92dvh,760px)] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl ${
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {accent && <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`} />}
              <h3 className="truncate text-base font-bold text-slate-900">{title}</h3>
            </div>
            {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon shrink-0"
            aria-label="Fermer"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
        {toolbar && <div className="shrink-0 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 sm:px-5">{toolbar}</div>}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">{children}</div>
        {footer && (
          <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
