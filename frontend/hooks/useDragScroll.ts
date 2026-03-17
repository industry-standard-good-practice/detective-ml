import { useRef, useCallback } from 'react';

/**
 * A hook that adds horizontal drag-to-scroll behavior on a scrollable container.
 * Returns a callback ref to attach to the scrollable element.
 * While dragging, the cursor shows 'grabbing'. At rest, the cursor shows 'grab'.
 * Prevents accidental clicks on children after a drag gesture.
 *
 * Uses a callback ref so that listeners are re-attached whenever the element
 * mounts (e.g. after a tab switch that unmounts/remounts the container).
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const startX = useRef(0);
  const scrollLeftVal = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  const ref = useCallback((el: T | null) => {
    // Clean up previous element's listeners if any
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (!el) return;

    el.style.cursor = 'grab';

    const preventClick = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, select, textarea')) return;

      isDragging.current = true;
      hasDragged.current = false;
      startX.current = e.pageX;
      scrollLeftVal.current = el.scrollLeft;
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
      document.body.style.userSelect = 'none';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const dx = e.pageX - startX.current;
      if (Math.abs(dx) > 3) hasDragged.current = true;
      el.scrollLeft = scrollLeftVal.current - dx * 1.5;
    };

    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      el.style.cursor = 'grab';
      el.style.userSelect = '';
      document.body.style.userSelect = '';
      if (hasDragged.current) {
        el.addEventListener('click', preventClick, { capture: true, once: true });
      }
    };

    const onMouseLeave = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      el.style.cursor = 'grab';
      el.style.userSelect = '';
      document.body.style.userSelect = '';
    };

    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseup', onMouseUp);
    el.addEventListener('mouseleave', onMouseLeave);

    cleanupRef.current = () => {
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('mouseleave', onMouseLeave);
      document.body.style.userSelect = '';
    };
  }, []);

  return ref;
}
