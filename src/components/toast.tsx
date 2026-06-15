"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

type ToastApi = {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const KIND_STYLE: Record<ToastKind, string> = {
  success: "border-jade/30 bg-white text-jade",
  error: "border-warn/30 bg-white text-warn",
  info: "border-ink/15 bg-white text-ink",
};

const KIND_ICON: Record<ToastKind, string> = {
  success: "✓",
  error: "✕",
  info: "•",
};

const DURATION = 3500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, kind, message }]);
      return id;
    },
    [],
  );

  const api: ToastApi = {
    toast: push,
    success: (m) => push(m, "success"),
    error: (m) => push(m, "error"),
    info: (m) => push(m, "info"),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
        role="region"
        aria-live="polite"
        aria-label="การแจ้งเตือน"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, DURATION);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-md ${KIND_STYLE[toast.kind]}`}
    >
      <span aria-hidden className="mt-0.5 font-bold">
        {KIND_ICON[toast.kind]}
      </span>
      <span className="flex-1 text-ink">{toast.message}</span>
      <button
        type="button"
        onClick={onDone}
        className="text-muted hover:text-ink"
        aria-label="ปิด"
      >
        ✕
      </button>
    </div>
  );
}
