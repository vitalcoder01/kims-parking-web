import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { playUndoChime } from '../utils/audioChimes';

export interface UndoToastOptions {
  message: string;
  onUndo?: () => void | Promise<void>;
  durationMs?: number;
}

export type ShowUndoToastFn = {
  (options: UndoToastOptions): void;
  (message: string, onUndo?: () => void | Promise<void>, durationMs?: number): void;
};

interface UndoToastContextType {
  showUndoToast: ShowUndoToastFn;
  dismissToast: () => void;
}

const UndoToastContext = createContext<UndoToastContextType>({
  showUndoToast: () => {},
  dismissToast: () => {},
});

export function useUndoToast() {
  return useContext(UndoToastContext);
}

export function UndoToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    onUndo?: () => void | Promise<void>;
    durationMs: number;
  } | null>(null);

  const timerRef = useRef<any>(null);

  const dismissToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const showUndoToast: ShowUndoToastFn = useCallback((
    input: string | UndoToastOptions,
    onUndoArg?: () => void | Promise<void>,
    durationMsArg?: number,
  ) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    const id = Date.now();
    let message: string;
    let onUndo: (() => void | Promise<void>) | undefined;
    let durationMs: number;

    if (typeof input === 'string') {
      message = input;
      onUndo = onUndoArg;
      durationMs = durationMsArg ?? 5000;
    } else {
      message = input.message;
      onUndo = input.onUndo;
      durationMs = input.durationMs ?? 5000;
    }

    setToast({ id, message, onUndo, durationMs });

    timerRef.current = setTimeout(() => {
      setToast(prev => (prev?.id === id ? null : prev));
      timerRef.current = null;
    }, durationMs);
  }, []);

  const handleUndo = async () => {
    if (!toast || !toast.onUndo) return;
    const undoAction = toast.onUndo;
    dismissToast();
    playUndoChime();
    try {
      await undoAction();
    } catch (err) {
      console.warn('[UndoToast] Undo action failed:', err);
    }
  };

  return (
    <UndoToastContext.Provider value={{ showUndoToast, dismissToast }}>
      {children}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 76, // sits comfortably above mobile bottom navigation
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            backgroundColor: '#0F172A',
            color: '#F8FAFC',
            padding: '10px 16px',
            borderRadius: 14,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            minWidth: 280,
            maxWidth: '92vw',
            animation: 'fadeInUp 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#10B981',
              flexShrink: 0,
            }}
          />
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              flex: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: '#F8FAFC',
            }}
          >
            {toast.message}
          </div>
          {toast.onUndo ? (
            <button
              type="button"
              onClick={handleUndo}
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                color: '#60A5FA',
                border: '1px solid rgba(96, 165, 250, 0.4)',
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background-color 150ms ease',
              }}
            >
              Undo
            </button>
          ) : (
            <button
              type="button"
              onClick={dismissToast}
              aria-label="Dismiss toast"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#94A3B8',
                border: 'none',
                borderRadius: 8,
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          )}
        </div>
      )}
    </UndoToastContext.Provider>
  );
}
