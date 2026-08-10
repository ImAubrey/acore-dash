export const DEFAULT_MIN_THUMB_SIZE = 28;
export const SCROLL_EPSILON = 1;

export function clampScrollValue(value, minimum, maximum) {
  const safeMinimum = Number.isFinite(minimum) ? minimum : 0;
  const safeMaximum = Number.isFinite(maximum)
    ? Math.max(maximum, safeMinimum)
    : safeMinimum;
  const safeValue = Number.isFinite(value) ? value : safeMinimum;
  return Math.min(Math.max(safeValue, safeMinimum), safeMaximum);
}

export function calculateScrollMetrics({
  clientSize,
  scrollSize,
  scrollValue,
  trackSize,
  minimumThumbSize = DEFAULT_MIN_THUMB_SIZE
}) {
  const safeClientSize = Math.max(Number(clientSize) || 0, 0);
  const safeScrollSize = Math.max(Number(scrollSize) || 0, safeClientSize);
  const safeTrackSize = Math.max(Number(trackSize) || 0, 0);
  const maximum = Math.max(safeScrollSize - safeClientSize, 0);
  const value = clampScrollValue(Number(scrollValue) || 0, 0, maximum);
  const visible = safeClientSize > 0 && maximum > SCROLL_EPSILON && safeTrackSize > 0;
  const thumbSize = visible
    ? clampScrollValue(
      (safeClientSize / safeScrollSize) * safeTrackSize,
      Math.min(minimumThumbSize, safeTrackSize),
      safeTrackSize
    )
    : 0;
  const travel = Math.max(safeTrackSize - thumbSize, 0);
  const thumbOffset = visible && maximum > 0 ? (value / maximum) * travel : 0;

  return { visible, thumbSize, thumbOffset, maximum, value };
}

export function calculateTrackTarget({ clickPosition, trackSize, thumbSize, maximum }) {
  const safeTrackSize = Math.max(Number(trackSize) || 0, 0);
  const safeThumbSize = clampScrollValue(Number(thumbSize) || 0, 0, safeTrackSize);
  const safeMaximum = Math.max(Number(maximum) || 0, 0);
  const travel = Math.max(safeTrackSize - safeThumbSize, 0);
  if (travel === 0 || safeMaximum <= 0) return 0;
  const centeredOffset = (Number(clickPosition) || 0) - safeThumbSize / 2;
  return (clampScrollValue(centeredOffset, 0, travel) / travel) * safeMaximum;
}
