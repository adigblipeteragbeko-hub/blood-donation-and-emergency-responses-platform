import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { BloodSosAssistant } from './BloodSosAssistant';

function assistantRoute(role?: string) {
  if (role === 'DONOR') return '/donor/assistant';
  if (role === 'HOSPITAL_ADMIN') return '/hospital/assistant';
  if (role === 'ADMIN') return '/admin/management?section=assistant';
  return '/assistant';
}

export function FloatingAssistantLauncher() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        window.setTimeout(() => buttonRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        aria-label="Open BloodSOS Assistant"
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-[65] flex h-14 w-14 items-center justify-center rounded-full border border-red-200 bg-primary text-white shadow-2xl shadow-red-950/20 transition hover:bg-red-800 focus:outline-none focus:ring-4 focus:ring-red-200 md:bottom-6 md:right-6"
        onClick={() => setOpen(true)}
        title="Open BloodSOS Assistant"
        type="button"
      >
        <span aria-hidden="true" className="text-xl font-black">?</span>
      </button>

      {open ? (
        <aside
          aria-label="BloodSOS Assistant drawer"
          className="fixed inset-x-3 bottom-20 z-[75] h-[min(720px,calc(100vh-7rem))] overflow-hidden rounded-3xl border border-red-100 bg-white shadow-2xl shadow-slate-950/20 md:inset-x-auto md:right-6 md:w-[440px]"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <p className="font-black text-slate-950">BloodSOS Assistant</p>
            <div className="flex gap-2">
              <button
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700"
                onClick={() => {
                  setOpen(false);
                  navigate(assistantRoute(user?.role));
                }}
                type="button"
              >
                Open Full Assistant
              </button>
              <button
                aria-label="Close BloodSOS Assistant"
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700"
                onClick={() => {
                  setOpen(false);
                  window.setTimeout(() => buttonRef.current?.focus(), 0);
                }}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
          <div className="h-[calc(100%-57px)]">
            <BloodSosAssistant mode="compact" />
          </div>
        </aside>
      ) : null}
    </>
  );
}
