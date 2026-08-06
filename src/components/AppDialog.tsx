import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {useTheme} from '../context/ThemeContext';
import {Icon, IconName} from './Icon';
import {PressableScale} from './PressableScale';

// Web port of mobile's components/AppDialog.tsx — same API, same visual
// language. Replaces window.confirm/window.alert everywhere: a native
// browser popup ignores the app's theme entirely (stark, unstyled, the
// URL bar stamped across the top like the screenshot the user flagged),
// carries no icon or severity colour, and reads like the browser
// interrupting rather than the product asking. This renders inside the
// app instead.

export type DialogTone = 'error' | 'warning' | 'success' | 'info';

interface DialogButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface DialogOptions {
  title?: string;
  message: string;
  tone?: DialogTone;
  buttons?: DialogButton[];
}

interface DialogApi {
  /** Drop-in for window.alert — one dismiss button. */
  alert: (message: string, opts?: {title?: string; tone?: DialogTone}) => void;
  /** Drop-in for window.confirm — resolves true if the confirming button was clicked. */
  confirm: (opts: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    tone?: DialogTone;
    destructive?: boolean;
  }) => Promise<boolean>;
  show: (opts: DialogOptions) => void;
}

const Ctx = createContext<DialogApi>({
  alert: () => {},
  confirm: async () => false,
  show: () => {},
});

export function useDialog() { return useContext(Ctx); }

const TONE_ICON: Record<DialogTone, IconName> = {
  error: 'alert',
  warning: 'bellAlert',
  success: 'check',
  info: 'info',
};

export function DialogProvider({children}: {children: React.ReactNode}) {
  const [opts, setOpts] = useState<DialogOptions | null>(null);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const {colors, isDark} = useTheme();

  // Queue, so a second alert fired while one is open isn't swallowed.
  const queue = useRef<DialogOptions[]>([]);

  const present = useCallback((next: DialogOptions) => {
    setOpts(cur => {
      if (cur) {
        // Never queue a dialog that repeats what's already on screen, or one
        // that's already waiting.
        const same = (a: DialogOptions, b: DialogOptions) => a.title === b.title && a.message === b.message;
        if (same(cur, next) || queue.current.some(q => same(q, next))) return cur;
        queue.current.push(next);
        return cur;
      }
      return next;
    });
    setClosing(false);
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    setClosing(true);
    setVisible(false);
  }, []);

  // Run the exit animation to completion before swapping content, otherwise
  // a queued dialog pops in mid-fade with the previous one's text.
  useEffect(() => {
    if (!visible && opts && closing) {
      const t = window.setTimeout(() => {
        const next = queue.current.shift();
        if (next) { setOpts(next); setClosing(false); setVisible(true); } else { setOpts(null); setClosing(false); }
      }, 130);
      return () => window.clearTimeout(t);
    }
  }, [visible, opts, closing]);

  const api: DialogApi = {
    show: present,
    alert: useCallback((message, o) => {
      present({message, title: o?.title, tone: o?.tone ?? 'error', buttons: [{text: 'OK'}]});
    }, [present]),
    confirm: useCallback((o) => new Promise<boolean>(resolve => {
      present({
        title: o.title,
        message: o.message,
        tone: o.tone ?? (o.destructive ? 'warning' : 'info'),
        buttons: [
          {text: o.cancelText ?? 'Cancel', style: 'cancel', onPress: () => resolve(false)},
          {text: o.confirmText ?? 'Confirm', style: o.destructive ? 'destructive' : 'default', onPress: () => resolve(true)},
        ],
      });
    }), [present]),
  };

  const tone = opts?.tone ?? 'info';
  const toneColor = tone === 'error' ? colors.error
    : tone === 'warning' ? colors.warning
    : tone === 'success' ? colors.success
    : colors.primary;
  const buttons = opts?.buttons?.length ? opts.buttons : [{text: 'OK'}];
  const stacked = buttons.length > 2;

  return (
    <Ctx.Provider value={api}>
      {children}
      {opts && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28,
            backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.45)',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.13s ease',
          }}
          // Tapping outside only dismisses a single-button (informational)
          // dialog — a real choice shouldn't be resolvable by a stray click.
          onClick={buttons.length === 1 ? dismiss : undefined}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 380, borderRadius: 24, border: `1px solid ${colors.border}`, padding: 24,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              backgroundColor: colors.surface,
              opacity: visible ? 1 : 0,
              transform: visible ? 'scale(1)' : 'scale(0.94)',
              transition: 'opacity 0.16s ease, transform 0.16s cubic-bezier(0.2, 0.9, 0.3, 1.2)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{width: 52, height: 52, borderRadius: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, backgroundColor: toneColor + '18'}}>
              <Icon name={TONE_ICON[tone]} size={24} color={toneColor} />
            </div>

            {!!opts.title && (
              <div style={{fontSize: 18, fontWeight: 900, textAlign: 'center', marginBottom: 6, color: colors.textPrimary}}>{opts.title}</div>
            )}
            <div style={{fontSize: 14, fontWeight: 600, textAlign: 'center', lineHeight: '21px', whiteSpace: 'pre-line', color: opts.title ? colors.textSecondary : colors.textPrimary}}>
              {opts.message}
            </div>

            <div style={{display: 'flex', flexDirection: stacked ? 'column' : 'row', gap: 10, marginTop: 22, alignSelf: 'stretch'}}>
              {buttons.map((b, i) => {
                const isCancel = b.style === 'cancel';
                const isDestructive = b.style === 'destructive';
                const bg = isCancel ? colors.cardAlt : isDestructive ? colors.error : colors.primary;
                const fg = isCancel ? colors.textSecondary : colors.textOnPrimary;
                return (
                  <PressableScale
                    key={`${b.text}-${i}`}
                    style={{
                      ...(stacked ? {width: '100%'} : {flex: 1}),
                      borderRadius: 14, border: `1px solid ${isCancel ? colors.border : 'transparent'}`,
                      padding: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: bg,
                    }}
                    onClick={() => { dismiss(); b.onPress?.(); }}>
                    <span style={{fontSize: 14, fontWeight: 800, color: fg}}>{b.text}</span>
                  </PressableScale>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
