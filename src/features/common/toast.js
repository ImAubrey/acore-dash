export const TOAST_LIMIT = 5;

const DEFAULT_DURATION_BY_TONE = {
  progress: 0,
  success: 5000,
  error: 9000,
  info: 6000
};

export function normalizeToast(input = {}) {
  const tone = ['progress', 'success', 'error', 'info'].includes(input.tone)
    ? input.tone
    : 'info';
  const channel = String(input.channel || 'global').trim() || 'global';
  const message = String(input.message || '').trim();
  const requestedDuration = Number(input.duration);
  const duration = Number.isFinite(requestedDuration) && requestedDuration >= 0
    ? requestedDuration
    : DEFAULT_DURATION_BY_TONE[tone];
  return {
    id: channel,
    channel,
    message,
    tone,
    duration,
    createdAt: Number(input.createdAt) || Date.now()
  };
}

export function toastReducer(toasts, action) {
  if (action?.type === 'dismiss') {
    return toasts.filter((toast) => toast.id !== action.id && toast.channel !== action.channel);
  }
  if (action?.type !== 'show') return toasts;

  const toast = normalizeToast(action.toast);
  if (!toast.message) return toasts;
  const existingIndex = toasts.findIndex((item) => item.channel === toast.channel);
  if (existingIndex >= 0) {
    const next = [...toasts];
    next[existingIndex] = { ...toast, createdAt: toasts[existingIndex].createdAt };
    return next;
  }
  return [...toasts, toast].slice(-TOAST_LIMIT);
}

export const toast = (input) => ({ type: 'show', toast: input });
export const dismissToast = (idOrChannel) => ({ type: 'dismiss', id: idOrChannel, channel: idOrChannel });
