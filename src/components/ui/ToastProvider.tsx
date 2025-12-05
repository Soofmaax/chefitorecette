"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState
} from "react";

type ToastType = "info" | "success" | "error";

interface ToastState {
  id: number;
  type: ToastType;
  message: string;
}

interface ShowToastParams {
  type?: ToastType;
  message: string;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (params: ShowToastParams) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
};

export const ToastProvider = ({
  children
}: {
  children: React.ReactNode;
}) => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const hideToast = () => {
    clearTimer();
    setToast(null);
  };

  const showToast = useCallback(
    ({ type = "info", message, durationMs = 4000 }: ShowToastParams) => {
      clearTimer();
      const next: ToastState = {
        id: Date.now(),
        type,
        message
      };
      setToast(next);
      timerRef.current = window.setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, durationMs) as unknown as number;
    },
    []
  );

  const borderAndTextClasses =
    toast?.type === "error"
      ? "border-red-500/60 bg-slate-900/95 text-red-100"
      : toast?.type === "success"
      ? "border-emerald-500/60 bg-slate-900/95 text-emerald-100"
      : "border-slate-600 bg-slate-900/95 text-slate-100";

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2">
          <div
            className={`pointer-events-auto rounded-md border px-3 py-2 text-xs shadow-lg ${borderAndTextClasses}`}
          >
            <div className="flex items-start gap-2">
              <span className="flex-1">{toast.message}</span>
              <button
                type="button"
                onClick={hideToast}
                className="ml-2 text-[10px] text-slate-400 hover:text-slate-100"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};