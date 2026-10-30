import React, { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp, ClipboardList, AlertTriangle, CheckCircle, Clock, X, Lock } from 'lucide-react';

export function PageTitle({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[.15em] text-[#71857b]">
            {eyebrow}
          </div>
        )}
        <h1 className="display text-2xl font-extrabold tracking-[-.04em] text-[#22362f] md:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-xs text-[#707e77] sm:text-sm">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status?: string }) {
  const val = (status || 'unknown').toLowerCase();
  
  const styles: Record<string, string> = {
    active: 'bg-[#e5f3ec] text-[#2e694e] border-[#c2e2d3]',
    published: 'bg-[#e5f3ec] text-[#2e694e] border-[#c2e2d3]',
    completed: 'bg-[#e5f3ec] text-[#2e694e] border-[#c2e2d3]',
    accepted: 'bg-[#e5f3ec] text-[#2e694e] border-[#c2e2d3]',
    present: 'bg-[#e5f3ec] text-[#2e694e] border-[#c2e2d3]',
    draft: 'bg-[#fcf5e3] text-[#916e2b] border-[#fae4aa]',
    available: 'bg-[#fcf5e3] text-[#916e2b] border-[#fae4aa]',
    late: 'bg-[#fcf5e3] text-[#916e2b] border-[#fae4aa]',
    under_review: 'bg-[#e8f1fc] text-[#2b5a94] border-[#bcd8f8]',
    submitted: 'bg-[#e8f1fc] text-[#2b5a94] border-[#bcd8f8]',
    blocked: 'bg-[#fceeed] text-[#a64037] border-[#f7c2be]',
    revoked: 'bg-[#fceeed] text-[#a64037] border-[#f7c2be]',
    absent: 'bg-[#fceeed] text-[#a64037] border-[#f7c2be]',
    rejected: 'bg-[#fceeed] text-[#a64037] border-[#f7c2be]',
    revision_requested: 'bg-[#fceeed] text-[#a64037] border-[#f7c2be]',
    inactive: 'bg-[#f0f2ef] text-[#6b7771] border-[#d8deda]',
    archived: 'bg-[#f0f2ef] text-[#6b7771] border-[#d8deda]',
    locked: 'bg-[#f0f2ef] text-[#6b7771] border-[#d8deda]',
  };

  const style = styles[val] || 'bg-[#f0f2ef] text-[#6b7771] border-[#d8deda]';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold capitalize ${style}`}>
      {val === 'locked' && <Lock size={10} />}
      {val.replace('_', ' ')}
    </span>
  );
}

export function EmptyState({
  title,
  detail,
  description,
  icon: Icon = ClipboardList,
  action
}: {
  title: string;
  detail?: string;
  description?: string;
  icon?: any;
  action?: ReactNode;
}) {
  const text = detail || description || '';
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-[#d5dad3] bg-[#fafbf9] px-6 py-10 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#edf3ed] text-[#4a725e]">
        <Icon size={22} />
      </div>
      <h3 className="display text-base font-bold text-[#2e4038]">{title}</h3>
      {text && <p className="mt-1.5 max-w-sm text-xs leading-5 text-[#738079]">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Loading workspace' }: { label?: string }) {
  return (
    <div className="space-y-4 py-8" aria-label={label}>
      <div className="h-6 w-44 animate-pulse rounded-lg bg-[#e2e7e0]" />
      <div className="h-4 w-72 animate-pulse rounded bg-[#edf0eb]" />
      <div className="panel mt-6 h-48 animate-pulse bg-[#f4f6f2]" />
    </div>
  );
}

export function ErrorState({ error, retry }: { error?: string; retry?: () => void }) {
  return (
    <div className="panel flex flex-col items-start gap-3 p-7">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#faecea] text-[#b8483d]">
        <CircleHelp size={20} />
      </div>
      <h3 className="display text-lg font-bold text-[#2e3e37]">Unable to load content</h3>
      <p className="max-w-md text-xs leading-5 text-[#74827c]">
        {error || "An error occurred while communicating with the platform API. Please try again."}
      </p>
      {retry && (
        <button className="btn btn-soft text-xs" onClick={retry}>
          Retry request
        </button>
      )}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  maxWidth = 'max-w-lg',
  open
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
  open?: boolean;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = origOverflow;
    };
  }, [onClose]);

  const modalNode = (
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 p-4 sm:p-6 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`panel w-full ${maxWidth} max-h-[90vh] flex flex-col p-5 sm:p-6 shadow-2xl relative my-auto overflow-hidden bg-white border border-[#d8e2d9] animate-in zoom-in-95 duration-150`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 mb-4 flex items-center justify-between border-b border-[#edf0ea] pb-3">
          <h2 className="display text-base sm:text-lg font-bold text-[#273831]">{title}</h2>
          <button
            type="button"
            className="rounded-lg p-1.5 text-[#73827b] hover:bg-[#edf1eb] transition cursor-pointer"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pr-1">{children}</div>
      </section>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
}

export function ConfirmModal({
  title,
  detail,
  confirmLabel = 'Confirm',
  destructive = false,
  pending = false,
  onCancel,
  onConfirm
}: {
  title: string;
  detail: string;
  confirmLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = origOverflow;
    };
  }, [onCancel, pending]);

  const modalNode = (
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 p-4 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
    >
      <section
        className="panel w-full max-w-md p-6 shadow-2xl relative my-auto bg-white border border-[#d8e2d9] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${destructive ? 'bg-[#faecea] text-[#b8483d]' : 'bg-[#fcf5e3] text-[#916e2b]'}`}>
          <AlertTriangle size={19} />
        </div>
        <h3 className="display text-lg font-bold text-[#2a3c35]">{title}</h3>
        <p className="mt-2 text-xs leading-5 text-[#738079]">{detail}</p>
        <div className="mt-6 flex justify-end gap-2.5">
          <button className="btn btn-soft" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button
            className={`btn ${destructive ? 'border-red-600 bg-red-600 text-white hover:bg-red-700' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
}
