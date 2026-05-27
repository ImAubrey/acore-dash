import React from 'react';

const HIGH_DPI_RATIO = 1.5;
const HIDE_HERO_VIEWPORT_WIDTH = 760;
const LOW_DPI_HIDE_HERO_VIEWPORT_WIDTH = 1024;
const WIDE_SIDE_MIN_WIDTH = 1200;

export function getHeroTitleClassName() {
  return 'hero-page-title';
}

export function resolveHeroLayout({
  viewportWidth = 0,
  devicePixelRatio = 1,
  containerWidth = 0
} = {}) {
  const width = Number.isFinite(viewportWidth) ? viewportWidth : 0;
  const dpr = Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1;
  const container = Number.isFinite(containerWidth) ? containerWidth : 0;
  const lowDpi = dpr < HIGH_DPI_RATIO;
  const hidden = (width > 0 && width <= HIDE_HERO_VIEWPORT_WIDTH)
    || (width > 0 && width < LOW_DPI_HIDE_HERO_VIEWPORT_WIDTH && lowDpi);
  const wideSide = !hidden && dpr >= HIGH_DPI_RATIO && container >= WIDE_SIDE_MIN_WIDTH;

  return {
    titleHidden: hidden,
    sideHidden: hidden,
    wideSide
  };
}

export function useHeroLayout(resetKey) {
  const heroRef = React.useRef(null);
  const layoutRef = React.useRef(resolveHeroLayout());
  const [layout, setLayout] = React.useState(layoutRef.current);

  const updateLayout = React.useCallback(() => {
    if (typeof window === 'undefined') return;

    const hero = heroRef.current;
    const nextLayout = resolveHeroLayout({
      viewportWidth: window.innerWidth || document.documentElement?.clientWidth || 0,
      devicePixelRatio: window.devicePixelRatio || 1,
      containerWidth: hero?.clientWidth || 0
    });

    if (
      layoutRef.current.titleHidden !== nextLayout.titleHidden
      || layoutRef.current.sideHidden !== nextLayout.sideHidden
      || layoutRef.current.wideSide !== nextLayout.wideSide
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

    if (resizeObserver && heroRef.current) {
      resizeObserver.observe(heroRef.current);
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

  const heroClassName = [
    'hero',
    layout.titleHidden ? 'hero-layout-title-hidden' : '',
    layout.sideHidden ? 'hero-layout-side-hidden' : '',
    layout.wideSide ? 'hero-layout-side-wide' : ''
  ].filter(Boolean).join(' ');

  return {
    heroRef,
    heroClassName,
    layout
  };
}
