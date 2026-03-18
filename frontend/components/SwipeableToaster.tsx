import React, { useRef, useCallback } from 'react';
import { type } from '../theme';
import toast, { useToaster, Toast, ToastPosition } from 'react-hot-toast';

interface SwipeableToastProps {
  t: Toast;
  children: React.ReactNode;
}

const SWIPE_THRESHOLD = 60;

const SwipeableToast: React.FC<SwipeableToastProps> = ({ t, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const swiping = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = 0;
    swiping.current = true;
    if (ref.current) {
      ref.current.style.transition = 'none';
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping.current || !ref.current) return;
    const dx = e.touches[0].clientX - startX.current;
    currentX.current = dx;
    ref.current.style.transform = `translateX(${dx}px)`;
    ref.current.style.opacity = `${Math.max(0, 1 - Math.abs(dx) / 200)}`;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!swiping.current || !ref.current) return;
    swiping.current = false;

    if (Math.abs(currentX.current) > SWIPE_THRESHOLD) {
      const dir = currentX.current > 0 ? 300 : -300;
      ref.current.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
      ref.current.style.transform = `translateX(${dir}px)`;
      ref.current.style.opacity = '0';
      setTimeout(() => toast.dismiss(t.id), 200);
    } else {
      ref.current.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
      ref.current.style.transform = 'translateX(0)';
      ref.current.style.opacity = '1';
    }
  }, [t.id]);

  return (
    <div
      ref={ref}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      {children}
    </div>
  );
};

/** Get positioning styles for a toast based on its position property */
const getPositionStyle = (
  position: ToastPosition,
  offset: number
): React.CSSProperties => {
  const isTop = position.includes('top');

  return {
    position: 'absolute',
    [isTop ? 'top' : 'bottom']: offset,
    left: 10,
    right: 10,
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'auto',
  };
};

const SwipeableToaster: React.FC<{ containerStyle?: React.CSSProperties }> = ({
  containerStyle,
}) => {
  const { toasts, handlers } = useToaster();
  const { startPause, endPause, calculateOffset, updateHeight } = handlers;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        pointerEvents: 'none',
        zIndex: 50,
        ...containerStyle,
      }}
      onMouseEnter={startPause}
      onMouseLeave={endPause}
    >
      {toasts.map((t) => {
        const pos = t.position || 'bottom-right';
        const isTop = pos.includes('top');

        const offset = calculateOffset(t, {
          reverseOrder: isTop,
          gutter: 8,
        });

        const ref = (el: HTMLDivElement | null) => {
          if (el && typeof t.height !== 'number') {
            const height = el.getBoundingClientRect().height;
            updateHeight(t.id, height);
          }
        };

        const isError = t.type === 'error';
        const customStyle = (t as any).style || {};

        return (
          <div
            key={t.id}
            ref={ref}
            style={{
              ...getPositionStyle(pos, offset),
              transition: t.visible
                ? 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                : 'all 0.3s',
              opacity: t.visible ? 1 : 0,
            }}
          >
            <SwipeableToast t={t}>
              <div
                style={{
                  background: 'var(--color-surface-raised)',
                  color: isError ? 'var(--color-accent-red-bright)' : 'var(--color-accent-green)',
                  border: `1px solid ${isError ? 'var(--color-danger-bg)' : 'var(--color-border)'}`,
                  fontFamily: "'VT323', monospace",
                  fontSize: 'var(--type-body)',
                  boxShadow: `0 0 15px ${isError ? 'rgba(255,85,85,0.1)' : 'rgba(0,255,0,0.1)'}`,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space)',
                  maxWidth: '400px',
                  ...customStyle,
                }}
              >
                {t.icon && <span>{t.icon}</span>}
                {typeof t.message === 'function' ? t.message(t) : t.message}
              </div>
            </SwipeableToast>
          </div>
        );
      })}
    </div>
  );
};

export default SwipeableToaster;
