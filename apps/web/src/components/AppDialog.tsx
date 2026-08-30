'use client';

import { useEffect, useState } from 'react';

export type AppAlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type AppAlertPayload = {
  title: string;
  message?: string;
  buttons: AppAlertButton[];
};

type ShowFn = (payload: AppAlertPayload) => void;

let showFn: ShowFn | null = null;
const queue: AppAlertPayload[] = [];

function bind(fn: ShowFn | null) {
  showFn = fn;
  if (fn) {
    const pending = queue.splice(0, queue.length);
    pending.forEach((item) => fn(item));
  }
}

export function appAlert(title: string, message?: string, buttons?: AppAlertButton[]) {
  const payload: AppAlertPayload = {
    title: message ? title : 'X-Relax',
    message: message ?? title,
    buttons: buttons?.length ? buttons : [{ text: 'OK' }],
  };
  if (showFn) showFn(payload);
  else queue.push(payload);
}

export function appConfirm(title: string, message?: string): Promise<boolean> {
  return new Promise((resolve) => {
    appAlert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'OK', onPress: () => resolve(true) },
    ]);
  });
}

export function AppDialogHost() {
  const [payload, setPayload] = useState<AppAlertPayload | null>(null);

  useEffect(() => {
    bind(setPayload);
    return () => bind(null);
  }, []);

  if (!payload) return null;

  const close = (button?: AppAlertButton) => {
    setPayload(null);
    button?.onPress?.();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#061428]/60 p-6">
      <div className="card w-full max-w-md p-7 text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-full bg-gradient-to-br from-[#0B3D91] to-[#F5C400]" />
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">X-Relax</p>
        <h2 className="text-2xl font-serif font-bold text-foreground">{payload.title}</h2>
        {payload.message ? <p className="text-sm text-muted leading-6">{payload.message}</p> : null}
        <div className="pt-3 space-y-2">
          {payload.buttons.map((button, index) => {
            const primary =
              button.style !== 'cancel' &&
              (index === payload.buttons.length - 1 || button.style === 'destructive');
            return (
              <button
                key={`${button.text}-${index}`}
                type="button"
                className={
                  primary
                    ? button.style === 'destructive'
                      ? 'btn w-full bg-red-600 text-white'
                      : 'btn btn-primary w-full'
                    : 'btn btn-outline w-full'
                }
                onClick={() => close(button)}
              >
                {button.text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
