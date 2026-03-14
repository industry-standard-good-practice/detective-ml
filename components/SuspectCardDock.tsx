
import React, { useRef, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { motion, LayoutGroup } from 'framer-motion';
import { Suspect, Emotion } from '../types';
import SuspectCard from './SuspectCard';

/* ─── Styled Components ─── */

const DockWrapper = styled.div`
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

const DockRow = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 140px;
  display: flex;
  align-items: flex-end;
  overflow: visible;
  pointer-events: auto;
  z-index: 15;
  cursor: grab;
`;

const DockRowInner = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 0 60px;
  width: max-content;
  min-width: 100%;
  flex-shrink: 0;

  & > :first-child { margin-left: auto; }
  & > :last-child { margin-right: auto; }
`;

const DockSlot = styled.div`
  flex: 0 0 200px;
  transform: translateY(85%) scale(0.9);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: auto;
  z-index: 10;
  display: flex;
  justify-content: center;

  &:hover {
    transform: translateY(60%) scale(0.95);
    z-index: 15;
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
}

/* ─── Transform-based drag scroll hook ─── */

function useDragTranslate() {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const startX = useRef(0);
  const currentOffset = useRef(0);
  const dragStartOffset = useRef(0);

  const clampOffset = useCallback(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const outerW = outer.clientWidth;
    const innerW = inner.scrollWidth;
    const maxDrag = Math.max(0, innerW - outerW);

    // Clamp: offset is negative (dragging left moves content left)
    currentOffset.current = Math.max(-maxDrag, Math.min(0, currentOffset.current));
  }, []);

  const applyTransform = useCallback(() => {
    if (innerRef.current) {
      innerRef.current.style.transform = `translateX(${currentOffset.current}px)`;
    }
  }, []);

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;

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
      outer.style.cursor = 'grabbing';
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
      outer.style.cursor = 'grab';
      document.body.style.userSelect = '';
      if (hasDragged.current) {
        outer.addEventListener('click', preventClick, { capture: true, once: true });
      }
    };

    const onMouseLeave = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      outer.style.cursor = 'grab';
      document.body.style.userSelect = '';
    };

    outer.addEventListener('mousedown', onMouseDown);
    outer.addEventListener('mousemove', onMouseMove);
    outer.addEventListener('mouseup', onMouseUp);
    outer.addEventListener('mouseleave', onMouseLeave);

    return () => {
      outer.removeEventListener('mousedown', onMouseDown);
      outer.removeEventListener('mousemove', onMouseMove);
      outer.removeEventListener('mouseup', onMouseUp);
      outer.removeEventListener('mouseleave', onMouseLeave);
      document.body.style.userSelect = '';
    };
  }, [clampOffset, applyTransform]);

  return { outerRef, innerRef };
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
}) => {
  const { outerRef, innerRef } = useDragTranslate();

  const activeSuspect = activeSuspectId
    ? suspects.find(s => s.id === activeSuspectId)
    : undefined;

  const inactiveSuspects = activeSuspectId
    ? suspects.filter(s => s.id !== activeSuspectId)
    : suspects;

  const springTransition = { type: 'spring' as const, stiffness: 170, damping: 26 };

  return (
    <LayoutGroup>
      <DockWrapper>
        {/* Active card (animated to target position) */}
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

        {/* Bottom dock row */}
        <DockRow ref={outerRef}>
          <DockRowInner ref={innerRef}>
            {inactiveSuspects.map(s => (
              <DockSlot key={s.id}>
                <motion.div
                  layoutId={`suspect-dock-${s.id}`}
                  transition={springTransition}
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
                </motion.div>
              </DockSlot>
            ))}
          </DockRowInner>
        </DockRow>
      </DockWrapper>
    </LayoutGroup>
  );
};

export default SuspectCardDock;
