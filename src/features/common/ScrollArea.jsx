import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  calculateScrollMetrics,
  calculateTrackTarget,
  clampScrollValue
} from './scrollAreaMetrics.js';

const EMPTY_METRIC = { visible: false, thumbSize: 0, thumbOffset: 0, maximum: 0, value: 0 };

const metricsAreEqual = (left, right) => (
  left.visible === right.visible
  && left.thumbSize === right.thumbSize
  && left.thumbOffset === right.thumbOffset
  && left.maximum === right.maximum
  && left.value === right.value
);

/**
 * A dependency-free scroll region with an actual DOM scroll viewport and a
 * JavaScript-driven thumb. Native wheel, touch and screen-reader scrolling are
 * intentionally preserved; only the browser's painted scrollbar is replaced.
 */
export function ScrollArea({
  children,
  className = '',
  contentClassName = '',
  viewportClassName = '',
  viewportAs: Viewport = 'div',
  viewportRef,
  viewportProps = {},
  axis = 'vertical',
  ariaLabel,
  id,
  ...props
}) {
  const internalViewportRef = useRef(null);
  const contentRef = useRef(null);
  const rootRef = useRef(null);
  const verticalTrackRef = useRef(null);
  const horizontalTrackRef = useRef(null);
  const dragRef = useRef(null);
  const animationFrameRef = useRef(null);
  const scrollIdleTimerRef = useRef(null);
  const metricsRef = useRef({ vertical: EMPTY_METRIC, horizontal: EMPTY_METRIC });
  const generatedId = useId();
  const viewportId = id || `scroll-area-${generatedId.replace(/:/g, '')}`;
  const [metrics, setMetrics] = useState(metricsRef.current);

  const setViewportNode = useCallback((node) => {
    internalViewportRef.current = node;
    if (typeof viewportRef === 'function') {
      viewportRef(node);
    } else if (viewportRef && typeof viewportRef === 'object') {
      viewportRef.current = node;
    }
  }, [viewportRef]);

  const updateMetrics = useCallback(() => {
    const viewport = internalViewportRef.current;
    if (!viewport) return;

    const buildAxisMetrics = (orientation) => {
      const isVertical = orientation === 'vertical';
      const clientSize = isVertical ? viewport.clientHeight : viewport.clientWidth;
      const scrollSize = isVertical ? viewport.scrollHeight : viewport.scrollWidth;
      const scrollValue = isVertical ? viewport.scrollTop : viewport.scrollLeft;
      const track = isVertical ? verticalTrackRef.current : horizontalTrackRef.current;
      const trackSize = isVertical ? track?.clientHeight || 0 : track?.clientWidth || 0;
      return calculateScrollMetrics({ clientSize, scrollSize, scrollValue, trackSize });
    };

    const nextMetrics = {
      vertical: buildAxisMetrics('vertical'),
      horizontal: buildAxisMetrics('horizontal')
    };
    metricsRef.current = nextMetrics;
    setMetrics((current) => (
      metricsAreEqual(current.vertical, nextMetrics.vertical)
      && metricsAreEqual(current.horizontal, nextMetrics.horizontal)
        ? current
        : nextMetrics
    ));
  }, []);

  const scheduleMetricsUpdate = useCallback(() => {
    if (animationFrameRef.current !== null) return;
    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      updateMetrics();
    });
  }, [updateMetrics]);

  const markScrollActivity = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    root.classList.add('is-scrolling');
    if (scrollIdleTimerRef.current !== null) window.clearTimeout(scrollIdleTimerRef.current);
    scrollIdleTimerRef.current = window.setTimeout(() => {
      root.classList.remove('is-scrolling');
      scrollIdleTimerRef.current = null;
    }, 720);
  }, []);

  useLayoutEffect(() => {
    scheduleMetricsUpdate();
    const viewport = internalViewportRef.current;
    const content = contentRef.current;
    if (!viewport) return undefined;
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleMetricsUpdate);
    resizeObserver?.observe(viewport);
    if (content) resizeObserver?.observe(content);
    const mutationObserver = content && typeof MutationObserver !== 'undefined'
      ? new MutationObserver(scheduleMetricsUpdate)
      : null;
    mutationObserver?.observe(content, { childList: true, characterData: true, subtree: true });
    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [scheduleMetricsUpdate]);

  useLayoutEffect(() => {
    scheduleMetricsUpdate();
  }, [axis, children, scheduleMetricsUpdate]);

  useEffect(() => {
    const onWindowResize = () => scheduleMetricsUpdate();
    window.addEventListener('resize', onWindowResize);
    return () => window.removeEventListener('resize', onWindowResize);
  }, [scheduleMetricsUpdate]);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
    if (scrollIdleTimerRef.current !== null) window.clearTimeout(scrollIdleTimerRef.current);
    const drag = dragRef.current;
    if (!drag) return;
    window.removeEventListener('pointermove', drag.move);
    window.removeEventListener('pointerup', drag.end);
    window.removeEventListener('pointercancel', drag.end);
    window.removeEventListener('blur', drag.end);
  }, []);

  const scrollByKeyboard = useCallback((event) => {
    if (event.target !== event.currentTarget) return;
    const viewport = internalViewportRef.current;
    if (!viewport) return;
    const verticalEnabled = axis !== 'horizontal';
    const horizontalEnabled = axis !== 'vertical';
    const verticalStep = Math.max(40, Math.round(viewport.clientHeight * 0.12));
    const horizontalStep = Math.max(40, Math.round(viewport.clientWidth * 0.12));
    let handled = false;

    const canScrollVertical = verticalEnabled && metricsRef.current.vertical.visible;
    const canScrollHorizontal = horizontalEnabled && metricsRef.current.horizontal.visible;

    if (canScrollVertical && event.key === 'ArrowDown') { viewport.scrollTop += verticalStep; handled = true; }
    if (canScrollVertical && event.key === 'ArrowUp') { viewport.scrollTop -= verticalStep; handled = true; }
    if (canScrollHorizontal && event.key === 'ArrowRight') { viewport.scrollLeft += horizontalStep; handled = true; }
    if (canScrollHorizontal && event.key === 'ArrowLeft') { viewport.scrollLeft -= horizontalStep; handled = true; }
    if (canScrollVertical && event.key === 'PageDown') { viewport.scrollTop += viewport.clientHeight * 0.9; handled = true; }
    if (canScrollVertical && event.key === 'PageUp') { viewport.scrollTop -= viewport.clientHeight * 0.9; handled = true; }
    if (event.key === 'Home') {
      if (canScrollVertical) viewport.scrollTop = 0;
      if (canScrollHorizontal) viewport.scrollLeft = 0;
      handled = canScrollVertical || canScrollHorizontal;
    }
    if (event.key === 'End') {
      if (canScrollVertical) viewport.scrollTop = viewport.scrollHeight;
      if (canScrollHorizontal) viewport.scrollLeft = viewport.scrollWidth;
      handled = canScrollVertical || canScrollHorizontal;
    }
    if (handled) event.preventDefault();
  }, [axis]);

  const beginDrag = useCallback((orientation, event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const viewport = internalViewportRef.current;
    const track = orientation === 'vertical' ? verticalTrackRef.current : horizontalTrackRef.current;
    if (!viewport || !track) return;
    const metric = metricsRef.current[orientation];
    if (!metric.visible || metric.maximum <= 0) return;
    const startPointer = orientation === 'vertical' ? event.clientY : event.clientX;
    const startValue = orientation === 'vertical' ? viewport.scrollTop : viewport.scrollLeft;
    const trackSize = orientation === 'vertical' ? track.clientHeight : track.clientWidth;
    const travel = Math.max(trackSize - metric.thumbSize, 1);
    const pointerId = event.pointerId;
    const thumb = event.currentTarget;
    rootRef.current?.classList.add('is-dragging');
    markScrollActivity();
    thumb.setPointerCapture?.(pointerId);
    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const pointer = orientation === 'vertical' ? moveEvent.clientY : moveEvent.clientX;
      const nextValue = startValue + ((pointer - startPointer) / travel) * metric.maximum;
      if (orientation === 'vertical') viewport.scrollTop = clampScrollValue(nextValue, 0, metric.maximum);
      else viewport.scrollLeft = clampScrollValue(nextValue, 0, metric.maximum);
    };
    const onEnd = (endEvent) => {
      if (endEvent?.pointerId != null && endEvent.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      window.removeEventListener('blur', onEnd);
      dragRef.current = null;
      if (thumb.hasPointerCapture?.(pointerId)) thumb.releasePointerCapture(pointerId);
      rootRef.current?.classList.remove('is-dragging');
    };
    dragRef.current = { move: onMove, end: onEnd };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    window.addEventListener('blur', onEnd);
  }, [markScrollActivity]);

  const pageScroll = useCallback((orientation, event) => {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    const viewport = internalViewportRef.current;
    if (!viewport) return;
    const isVertical = orientation === 'vertical';
    const track = isVertical ? verticalTrackRef.current : horizontalTrackRef.current;
    const point = isVertical ? event.clientY : event.clientX;
    const trackStart = isVertical ? track?.getBoundingClientRect().top : track?.getBoundingClientRect().left;
    const metric = metricsRef.current[orientation];
    if (!metric.visible || metric.maximum <= 0) return;
    const clickPosition = point - (trackStart || 0);
    const trackSize = isVertical ? track?.clientHeight || 0 : track?.clientWidth || 0;
    const target = calculateTrackTarget({
      clickPosition,
      trackSize,
      thumbSize: metric.thumbSize,
      maximum: metric.maximum
    });
    if (isVertical) viewport.scrollTop = target;
    else viewport.scrollLeft = target;
    viewport.focus?.({ preventScroll: true });
    markScrollActivity();
    scheduleMetricsUpdate();
  }, [markScrollActivity, scheduleMetricsUpdate]);

  const endDragOnCaptureLoss = useCallback((event) => {
    dragRef.current?.end(event);
  }, []);

  const showVertical = axis !== 'horizontal' && metrics.vertical.visible;
  const showHorizontal = axis !== 'vertical' && metrics.horizontal.visible;
  const {
    className: viewportExtraClassName = '',
    onKeyDown: viewportOnKeyDown,
    onScroll: viewportOnScroll,
    ...restViewportProps
  } = viewportProps;

  return (
    <div ref={rootRef} className={`js-scroll-area js-scroll-area--${axis} ${className}`.trim()} {...props}>
      <Viewport
        {...restViewportProps}
        id={viewportId}
        ref={setViewportNode}
        className={`js-scroll-area__viewport ${viewportClassName} ${viewportExtraClassName}`.trim()}
        tabIndex={restViewportProps.tabIndex ?? 0}
        role={restViewportProps.role || (Viewport === 'div' ? 'region' : undefined)}
        aria-label={ariaLabel || restViewportProps['aria-label'] || 'Scrollable content'}
        onScroll={(event) => {
          viewportOnScroll?.(event);
          if (!event.defaultPrevented) {
            markScrollActivity();
            scheduleMetricsUpdate();
          }
        }}
        onKeyDown={(event) => {
          viewportOnKeyDown?.(event);
          if (!event.defaultPrevented) scrollByKeyboard(event);
        }}
      >
        <div className={`js-scroll-area__content ${contentClassName}`.trim()} ref={contentRef}>
          {children}
        </div>
      </Viewport>
      {axis !== 'horizontal' ? (
        <div className={`js-scroll-area__track js-scroll-area__track--vertical${showVertical ? ' is-visible' : ''}`} ref={verticalTrackRef} onPointerDown={(event) => pageScroll('vertical', event)}>
          {showVertical ? <div
            className="js-scroll-area__thumb"
            aria-hidden="true"
            onPointerDown={(event) => beginDrag('vertical', event)}
            onLostPointerCapture={endDragOnCaptureLoss}
            style={{ height: `${metrics.vertical.thumbSize}px`, transform: `translateY(${metrics.vertical.thumbOffset}px)` }}
          /> : null}
        </div>
      ) : null}
      {axis !== 'vertical' ? (
        <div className={`js-scroll-area__track js-scroll-area__track--horizontal${showHorizontal ? ' is-visible' : ''}`} ref={horizontalTrackRef} onPointerDown={(event) => pageScroll('horizontal', event)}>
          {showHorizontal ? <div
            className="js-scroll-area__thumb"
            aria-hidden="true"
            onPointerDown={(event) => beginDrag('horizontal', event)}
            onLostPointerCapture={endDragOnCaptureLoss}
            style={{ width: `${metrics.horizontal.thumbSize}px`, transform: `translateX(${metrics.horizontal.thumbOffset}px)` }}
          /> : null}
        </div>
      ) : null}
    </div>
  );
}
