import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function HistoryPopover({
  label,
  className,
  children,
  title = label,
  onSelect,
  selected,
}) {
  const id = useId();
  const anchor = useRef(null);
  const trigger = useRef(null);
  const popup = useRef(null);
  const delay = useRef(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState(null);
  function cancel() {
    window.clearTimeout(delay.current);
  }
  function enter(event) {
    if (event.pointerType !== 'mouse') return;
    cancel();
    delay.current = window.setTimeout(() => setOpen(true), 180);
  }
  function leave(event) {
    if (event.pointerType !== 'mouse') return;
    cancel();
    delay.current = window.setTimeout(() => {
      if (!popup.current?.contains(document.activeElement)) setOpen(false);
    }, 220);
  }
  useEffect(() => () => window.clearTimeout(delay.current), []);
  useEffect(() => {
    if (!open) return undefined;
    const position = () => {
      const rect = anchor.current.getBoundingClientRect();
      const width = Math.min(380, window.innerWidth - 16);
      const below = window.innerHeight - rect.bottom;
      setBox({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        width,
        ...(below >= 240 || rect.top <= below
          ? {
              top: rect.bottom + 4,
              bottom: 'auto',
              maxHeight: Math.max(100, below - 12),
            }
          : {
              top: 'auto',
              bottom: window.innerHeight - rect.top + 4,
              maxHeight: Math.max(100, rect.top - 12),
            }),
      });
    };
    const outside = (event) => {
      if (
        !anchor.current?.contains(event.target) &&
        !popup.current?.contains(event.target)
      )
        setOpen(false);
    };
    const keydown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keydown);
    };
  }, [open]);
  return (
    <>
      <span
        className="history-popover-anchor"
        ref={anchor}
        onPointerEnter={enter}
        onPointerLeave={leave}
      >
        {onSelect && (
          <button
            type="button"
            className={className}
            aria-pressed={selected}
            onClick={onSelect}
          >
            {label}
          </button>
        )}
        <button
          ref={trigger}
          className={onSelect ? 'history-popover-toggle' : className}
          type="button"
          title={title}
          aria-label={onSelect ? title : undefined}
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={(event) => {
            cancel();
            if (event.detail === 0) {
              setOpen(true);
              window.requestAnimationFrame(() => popup.current?.focus());
            } else {
              setOpen(true);
            }
          }}
        >
          {onSelect ? <span aria-hidden="true">▾</span> : label}
        </button>
      </span>
      {open &&
        createPortal(
          <div
            ref={popup}
            id={id}
            className="history-popover"
            role="group"
            aria-label={title}
            tabIndex={-1}
            style={box || { visibility: 'hidden' }}
            onPointerEnter={cancel}
            onPointerLeave={leave}
            onBlur={(event) => {
              if (
                !event.currentTarget.contains(event.relatedTarget) &&
                !anchor.current?.contains(event.relatedTarget)
              )
                setOpen(false);
            }}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </>
  );
}
