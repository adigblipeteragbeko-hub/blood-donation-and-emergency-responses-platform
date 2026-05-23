import { ReactNode, useEffect } from 'react';

type EditModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
};

export function EditModal({ open, title, description, onClose, children, maxWidth = 'max-w-2xl' }: EditModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
    >
      <div
        className={`${maxWidth} max-h-[88vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button
            aria-label="Close modal"
            className="rounded-full border border-slate-200 px-3 py-1 text-lg font-bold text-slate-500 hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
