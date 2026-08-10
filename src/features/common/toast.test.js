import test from 'node:test';
import assert from 'node:assert/strict';
import { TOAST_LIMIT, dismissToast, toast, toastReducer } from './toast.js';

test('toast reducer updates an existing channel instead of stacking progress', () => {
  const pending = toastReducer([], toast({ channel: 'hot-reload', tone: 'progress', message: 'Starting' }));
  const completed = toastReducer(pending, toast({ channel: 'hot-reload', tone: 'success', message: 'Done' }));

  assert.equal(completed.length, 1);
  assert.equal(completed[0].tone, 'success');
  assert.equal(completed[0].message, 'Done');
});

test('toast reducer dismisses and keeps a bounded queue', () => {
  let toasts = [];
  for (let index = 0; index < TOAST_LIMIT + 2; index += 1) {
    toasts = toastReducer(toasts, toast({ channel: `channel-${index}`, message: `Message ${index}` }));
  }
  assert.equal(toasts.length, TOAST_LIMIT);
  assert.equal(toasts[0].channel, 'channel-2');
  assert.equal(toastReducer(toasts, dismissToast('channel-4')).some((item) => item.channel === 'channel-4'), false);
});
