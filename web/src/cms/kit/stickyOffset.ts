import { useLayoutEffect, type RefObject } from 'react';

/**
 * Publishes `source`'s live height onto `host` as the CSS custom property
 * `prop`, so sticky bars can park exactly beneath the chrome above them.
 *
 * Hard-coding those offsets does not hold: the CMS header changes height at
 * the lg breakpoint, toolbars wrap at narrow widths, and being a few pixels
 * out leaves either a gap that scrolling content shows through or a bar
 * clipped behind the one above it. The height is rounded up for that reason —
 * a sub-pixel overlap is invisible, a sub-pixel gap is not.
 */
export function usePublishedHeight(
  source: RefObject<HTMLElement | null>,
  host: RefObject<HTMLElement | null>,
  prop: string,
) {
  useLayoutEffect(() => {
    const el = source.current;
    const target = host.current;
    if (!el || !target) return;

    const sync = () => {
      target.style.setProperty(prop, `${Math.ceil(el.getBoundingClientRect().height)}px`);
    };
    sync();

    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [source, host, prop]);
}
