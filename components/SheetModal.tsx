'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './Icons';

type SheetModalProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
};

export default function SheetModal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = 'md',
}: SheetModalProps) {
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
        className={`relative flex w-full max-h-[min(92dvh,920px)] flex-col overflow-hidden rounded-t-[1.6rem] border border-slate-200/90 bg-white shadow-2xl sm:rounded-3xl ${
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg'
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/90 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h3 className="text-[15px] font-extrabold leading-snug tracking-tight text-slate-900 sm:text-base">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-0.5 text-xs font-medium text-slate-500">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon !h-9 !w-9 shrink-0 rounded-xl border border-slate-200 bg-white"
            aria-label="Fermer"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4">
          {children}
        </div>
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
