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
  const headerTone = accent
    ? {
        rose: 'bg-rose-800 text-white',
        amber: 'bg-amber-700 text-white',
        emerald: 'bg-emerald-800 text-white',
        indigo: 'bg-indigo-800 text-white',
      }[accent]
    : 'border-b border-slate-200 text-slate-900';
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
    <div className="no-print fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-5">
      <button
        type="button"
        aria-label="Fermer la fenêtre"
        className="absolute inset-0 bg-slate-950/65 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex w-full max-h-[min(92dvh,760px)] flex-col overflow-hidden rounded-t-lg border border-slate-200 bg-white shadow-xl sm:rounded-lg ${
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md'
        }`}
      >
        <div className={`flex min-h-14 shrink-0 items-center justify-between gap-3 px-4 py-2.5 ${headerTone}`}>
          <div className="min-w-0">
            {accent ? <p className="text-[11px] font-medium text-white/70">Statut de la flotte</p> : null}
            <h3 className="truncate text-base font-semibold leading-5">{title}</h3>
            {subtitle ? (
              <p className={`truncate text-xs leading-4 ${accent ? 'text-white/75' : 'text-slate-500'}`}>{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
              accent ? 'text-white/80 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'
            }`}
            aria-label="Fermer"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
        {toolbar ? <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">{toolbar}</div> : null}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">{children}</div>
        {footer ? (
          <div className="border-t border-slate-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
