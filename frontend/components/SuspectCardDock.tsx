
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { type } from '../theme';
import styled from 'styled-components';
import { motion, LayoutGroup } from 'framer-motion';
import { Suspect, Emotion } from '../types';
import SuspectCard from './SuspectCard';

/* ─── Styled Components ─── */

const ActiveCardOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 20;

  @media (max-width: 768px) {
    display: none;
  }
`;

/* Visual layer: renders cards, captures NO events */
const DockRowVisual = styled.div`
  position: absolute;
  bottom: var(--screen-edge-bottom);
  left: 0;
  width: 100%;
  height: 50px;
  display: flex;
  align-items: flex-end;
  overflow: visible;
  pointer-events: none;
  z-index: 20;

  @media (max-width: 768px) {
    display: none;
  }
`;

/* Hit-test layer: captures events only within its clipped area */
const DockRowHitArea = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: calc(50px + var(--screen-edge-bottom));
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  pointer-events: auto;
  z-index: 21;
  cursor: grab;
  opacity: 0;
  padding-bottom: var(--screen-edge-bottom);

  @media (max-width: 768px) {
    display: none;
  }
`;

const DockRowInner = styled.div`
  display: flex;
  align-items: flex-end;
  gap: var(--space);
  padding: 0 var(--screen-edge-horizontal);
  width: max-content;
  min-width: 100%;
  flex-shrink: 0;

  & > :first-child { margin-left: auto; }
  & > :last-child { margin-right: auto; }
`;

const DockSlot = styled.div<{ $hovered?: boolean }>`
  flex: 0 0 200px;
  transform: ${p => p.$hovered ? 'translateY(60%) scale(0.95)' : 'translateY(85%) scale(0.9)'};
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: ${p => p.$hovered ? 15 : 10};
  display: flex;
  justify-content: center;
  position: relative;
`;

const NotificationBadge = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  min-width: 18px;
  height: 18px;
  background: var(--color-accent-green);
  border: 2px solid var(--color-bg);
  z-index: 30;
  box-shadow: 0 0 8px var(--color-accent-green), 0 0 16px rgba(0, 255, 0, 0.4);
  animation: notif-pulse 1.5s ease-in-out infinite;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-inverse);
  ${type.xs}
  font-weight: bold;
  padding: 0 4px;

  @keyframes notif-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.3); opacity: 0.7; }
  }
`;

const LoadingBadge = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--color-accent-green);
  border-top-color: transparent;
  z-index: 30;
  box-shadow: 0 0 8px rgba(0, 255, 0, 0.3);
  pointer-events: none;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const ActiveCardWrapper = styled(motion.div) <{ $left: number; $top: number }>`
  position: absolute;
  top: ${props => props.$top}px;
  left: ${props => props.$left}px;
  z-index: 20;
  pointer-events: auto;
`;

/* ─── Types ─── */

interface SuspectCardDockProps {
  suspects: Suspect[];
  activeSuspectId?: string;
  activePosition?: { x: number; y: number };
  activeCardWidth?: string;
  activeCardHeight?: string;
  activeEmotion?: Emotion;
  activeAggravation?: number;
  activeTurnId?: string;
  activeVariant?: 'default' | 'peek';
  onSelectSuspect: (id: string) => void;
  onFlipCard?: (flipped: boolean) => void;
  inactiveActionLabel?: string;
  unreadSuspectIds?: Map<string, number>;
  thinkingSuspectIds?: Set<string>;
}

/* ─── Transform-based drag scroll hook ─── */

function useDragTranslate() {
  const hitRef = useRef<HTMLDivElement>(null);
  const visualInnerRef = useRef<HTMLDivElement>(null);
  const hitInnerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const startX = useRef(0);
  const currentOffset = useRef(0);
  const dragStartOffset = useRef(0);

  const clampOffset = useCallback(() => {
    const hit = hitRef.current;
    const inner = hitInnerRef.current;
    if (!hit || !inner) return;

    const outerW = hit.clientWidth;
    const innerW = inner.scrollWidth;
    const maxDrag = Math.max(0, innerW - outerW);

    currentOffset.current = Math.max(-maxDrag, Math.min(0, currentOffset.current));
  }, []);

  const applyTransform = useCallback(() => {
    const offset = `translateX(${currentOffset.current}px)`;
    if (hitInnerRef.current) hitInnerRef.current.style.transform = offset;
    if (visualInnerRef.current) visualInnerRef.current.style.transform = offset;
  }, []);

  useEffect(() => {
    const hit = hitRef.current;
    if (!hit) return;

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
      dragStartOffset.current = currentOffset.current;
      hit.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const dx = e.pageX - startX.current;
      if (Math.abs(dx) > 3) hasDragged.current = true;
      currentOffset.current = dragStartOffset.current + dx;
      clampOffset();
      applyTransform();
    };

    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      hit.style.cursor = 'grab';
      document.body.style.userSelect = '';
      if (hasDragged.current) {
        hit.addEventListener('click', preventClick, { capture: true, once: true });
      }
    };

    const onMouseLeave = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      hit.style.cursor = 'grab';
      document.body.style.userSelect = '';
    };

    hit.addEventListener('mousedown', onMouseDown);
    hit.addEventListener('mousemove', onMouseMove);
    hit.addEventListener('mouseup', onMouseUp);
    hit.addEventListener('mouseleave', onMouseLeave);

    return () => {
      hit.removeEventListener('mousedown', onMouseDown);
      hit.removeEventListener('mousemove', onMouseMove);
      hit.removeEventListener('mouseup', onMouseUp);
      hit.removeEventListener('mouseleave', onMouseLeave);
      document.body.style.userSelect = '';
    };
  }, [clampOffset, applyTransform]);

  return { hitRef, visualInnerRef, hitInnerRef };
}

/* ─── Component ─── */

const SuspectCardDock: React.FC<SuspectCardDockProps> = ({
  suspects,
  activeSuspectId,
  activePosition,
  activeCardWidth = '280px',
  activeCardHeight = '450px',
  activeEmotion = Emotion.NEUTRAL,
  activeAggravation = 0,
  activeTurnId,
  activeVariant = 'default',
  onSelectSuspect,
  onFlipCard,
  inactiveActionLabel = 'SWITCH',
  unreadSuspectIds = new Map(),
  thinkingSuspectIds = new Set(),
}) => {
  const { hitRef, visualInnerRef, hitInnerRef } = useDragTranslate();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const activeSuspect = activeSuspectId
    ? suspects.find(s => s.id === activeSuspectId)
    : undefined;

  const inactiveSuspects = activeSuspectId
    ? suspects.filter(s => s.id !== activeSuspectId)
    : suspects;

  const springTransition = { type: 'spring' as const, stiffness: 170, damping: 26 };

  return (
    <LayoutGroup>
      {/* Full-screen overlay for active card only */}
      <ActiveCardOverlay>
        {activeSuspect && activePosition && (
          <ActiveCardWrapper
            key={activeSuspect.id}
            layoutId={`suspect-dock-${activeSuspect.id}`}
            $left={activePosition.x}
            $top={activePosition.y}
            transition={springTransition}
            style={{ x: '-50%', y: '-50%' }}
          >
            <SuspectCard
              id="active-suspect-card"
              suspect={activeSuspect}
              variant={activeVariant}
              width={activeCardWidth}
              height={activeCardHeight}
              emotion={activeEmotion}
              aggravation={activeAggravation}
              turnId={activeTurnId}
              onAction={() => { }}
              actionLabel="SWITCH"
              onFlip={onFlipCard}
            />
          </ActiveCardWrapper>
        )}
      </ActiveCardOverlay>

      {/* VISUAL layer: renders cards with overflow visible, pointer-events: none.
          Hover state is driven by JS from the hit-test layer */}
      <DockRowVisual>
        <DockRowInner ref={visualInnerRef}>
          {inactiveSuspects.map(s => (
            <DockSlot key={`visual-${s.id}`} $hovered={hoveredId === s.id}>
              <motion.div
                layoutId={`suspect-dock-${s.id}`}
                transition={springTransition}
              >
                <SuspectCard
                  suspect={s}
                  variant="peek"
                  width="200px"
                  height="300px"
                  notificationCount={unreadSuspectIds.get(s.id) || 0}
                  isLoading={thinkingSuspectIds.has(s.id)}
                  onAction={() => onSelectSuspect(s.id)}
                  actionLabel={inactiveActionLabel}
                  onFlip={onFlipCard}
                />
              </motion.div>
            </DockSlot>
          ))}
        </DockRowInner>
      </DockRowVisual>

      {/* HIT-TEST layer: overflow:hidden clips events to 50px strip.
          Hover/click events here sync to the visual layer */}
      <DockRowHitArea ref={hitRef} id="suspect-cards-container">
        <DockRowInner ref={hitInnerRef}>
          {inactiveSuspects.map(s => (
            <DockSlot
              key={`hit-${s.id}`}
              $hovered={hoveredId === s.id}
              onMouseEnter={() => setHoveredId(s.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <SuspectCard
                suspect={s}
                variant="peek"
                width="200px"
                height="300px"
                onAction={() => onSelectSuspect(s.id)}
                actionLabel={inactiveActionLabel}
                onFlip={onFlipCard}
              />
            </DockSlot>
          ))}
        </DockRowInner>
      </DockRowHitArea>
    </LayoutGroup>
  );
};

export default SuspectCardDock;
