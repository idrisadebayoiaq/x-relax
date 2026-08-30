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

export function bindAppAlert(fn: ShowFn | null) {
  showFn = fn;
  if (fn) {
    const pending = queue.splice(0, queue.length);
    pending.forEach((item) => fn(item));
  }
}

export function appAlert(
  title: string,
  message?: string,
  buttons?: AppAlertButton[],
) {
  const payload: AppAlertPayload = {
    title,
    message,
    buttons: buttons?.length ? buttons : [{ text: 'OK' }],
  };
  if (showFn) showFn(payload);
  else queue.push(payload);
}
