import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * A styled replacement for window.confirm().
 *
 * The browser dialog blocks the page, ignores the app's theme and looks alien on a phone.
 * `useConfirm()` returns a function with the same shape as confirm — call it, await the
 * answer — so a call site changes from `if (!window.confirm(msg)) return;` to
 * `if (!(await confirm(msg))) return;` and nothing else moves.
 */
type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type Resolver = (answer: boolean) => void;

const ConfirmContext = createContext<((opts: string | ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<Resolver | null>(null);

  const confirm = useCallback((opts: string | ConfirmOptions) => {
    setOpen(typeof opts === 'string' ? { message: opts } : opts);
    return new Promise<boolean>(resolve => { resolverRef.current = resolve; });
  }, []);

  const answer = (value: boolean) => {
    setOpen(null);
    resolverRef.current?.(value);
    resolverRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {open && (
        <div
          className="fixed inset-0 z-[400] flex items-start sm:items-center justify-center overflow-y-auto p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => answer(false)} />
          <div className="relative my-auto w-full max-w-sm rounded-[2rem] border border-gray-100 dark:border-gray-800/50 bg-white dark:bg-gray-800 p-7 shadow-2xl">
            <button
              type="button"
              aria-label="Yopish"
              onClick={() => answer(false)}
              className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${
              open.danger === false
                ? 'bg-teal-50 text-[#1b6b6b] dark:bg-teal-950/30 dark:text-teal-400'
                : 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400'
            }`}>
              <AlertTriangle size={20} />
            </div>

            <h3 className="text-base font-black tracking-tight text-gray-900 dark:text-white">
              {open.title || 'Tasdiqlang'}
            </h3>
            <p className="mt-2 whitespace-pre-line text-sm text-gray-500 dark:text-gray-400">
              {open.message}
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => answer(false)}
                className="flex-1 rounded-2xl bg-gray-100 py-3 text-xs font-extrabold text-gray-700 transition-all hover:bg-gray-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 cursor-pointer"
              >
                {open.cancelLabel || 'Bekor qilish'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => answer(true)}
                className={`flex-1 rounded-2xl py-3 text-xs font-extrabold text-white shadow-lg transition-all cursor-pointer ${
                  open.danger === false
                    ? 'bg-[#1b6b6b] hover:bg-[#155252] shadow-[#1b6b6b]/20'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                }`}
              >
                {open.confirmLabel || 'Ha, davom etish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Outside the provider (the public apply page, for one) fall back to the browser
    // dialog rather than silently letting a destructive action through.
    return async (opts: string | ConfirmOptions) =>
      window.confirm(typeof opts === 'string' ? opts : opts.message);
  }
  return ctx;
}
