import React from 'react';

const COLLAPSE_VIEWPORT_WIDTH = 1024;
const FIT_BUFFER = 12;

export function resolveTopbarLayout({
  viewportWidth = 0,
  containerWidth = 0,
  navContentWidth = 0
} = {}) {
  const width = Number.isFinite(viewportWidth) ? viewportWidth : 0;
  const container = Number.isFinite(containerWidth) ? containerWidth : 0;
  const content = Number.isFinite(navContentWidth) ? navContentWidth : 0;
  const narrowViewport = width > 0 && width < COLLAPSE_VIEWPORT_WIDTH;
  const menuDoesNotFit = container > 0 && content > 0 && content > container - FIT_BUFFER;
  const collapsed = narrowViewport || menuDoesNotFit;

  return {
    collapsed,
    centered: !collapsed
  };
}

function getTopbarContentWidth(nav) {
  if (!nav || typeof window === 'undefined') return 0;
  const style = window.getComputedStyle(nav);
  const gap = Number.parseFloat(style.columnGap || style.gap || '0') || 0;
  const paddingLeft = Number.parseFloat(style.paddingLeft || '0') || 0;
  const paddingRight = Number.parseFloat(style.paddingRight || '0') || 0;
  const links = Array.from(nav.children);
  const linksWidth = links.reduce((sum, element) => {
    return sum + element.getBoundingClientRect().width;
  }, 0);

  return Math.ceil(linksWidth + Math.max(links.length - 1, 0) * gap + paddingLeft + paddingRight);
}

export function useTopbarLayout(resetKey) {
  const wrapRef = React.useRef(null);
  const navRef = React.useRef(null);
  const layoutRef = React.useRef(resolveTopbarLayout());
  const lastNavContentWidthRef = React.useRef(0);
  const [layout, setLayout] = React.useState(layoutRef.current);

  const updateLayout = React.useCallback(() => {
    if (typeof window === 'undefined') return;

    const wrap = wrapRef.current;
    const nav = navRef.current;
    const containerWidth = wrap?.clientWidth || 0;
    const measuredNavWidth = layoutRef.current.collapsed ? 0 : getTopbarContentWidth(nav);

    if (measuredNavWidth > 0) {
      lastNavContentWidthRef.current = measuredNavWidth;
    }

    const nextLayout = resolveTopbarLayout({
      viewportWidth: window.innerWidth || document.documentElement?.clientWidth || 0,
      containerWidth,
      navContentWidth: measuredNavWidth || lastNavContentWidthRef.current
    });

    if (
      layoutRef.current.collapsed !== nextLayout.collapsed
      || layoutRef.current.centered !== nextLayout.centered
    ) {
      layoutRef.current = nextLayout;
      setLayout(nextLayout);
    }
  }, []);

  React.useLayoutEffect(() => {
    updateLayout();
  });

  React.useEffect(() => {
    updateLayout();
    const frame = window.requestAnimationFrame(updateLayout);
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateLayout);

    if (resizeObserver) {
      if (wrapRef.current) resizeObserver.observe(wrapRef.current);
      if (navRef.current) resizeObserver.observe(navRef.current);
    }

    window.addEventListener('resize', updateLayout);
    window.visualViewport?.addEventListener('resize', updateLayout);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateLayout);
      window.visualViewport?.removeEventListener('resize', updateLayout);
    };
  }, [resetKey, updateLayout]);

  return {
    wrapRef,
    navRef,
    collapsed: layout.collapsed,
    centered: layout.centered
  };
}
