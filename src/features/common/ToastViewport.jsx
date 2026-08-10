import { useEffect } from 'react';

export function ToastViewport({ toasts = [], dismiss }) {
  return (
    <div className="toast-viewport" aria-label="Notifications">
      {toasts.map((item) => (
        <ToastItem key={item.id} toast={item} dismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, dismiss }) {
  useEffect(() => {
    if (!toast.duration || typeof dismiss !== 'function') return undefined;
    const timer = window.setTimeout(() => dismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, toast.message, toast.tone, dismiss]);

  const isError = toast.tone === 'error';
  return (
    <div className={`toast toast-${toast.tone}`} role={isError ? 'alert' : 'status'} aria-live={isError ? 'assertive' : 'polite'}>
      <span className="toast-tone" aria-hidden="true" />
      <p className="toast-message">{toast.message}</p>
      <button
        type="button"
        className="toast-dismiss"
        onClick={() => dismiss?.(toast.id)}
        aria-label="Dismiss notification"
        title="Dismiss"
      >
        X
      </button>
    </div>
  );
}
