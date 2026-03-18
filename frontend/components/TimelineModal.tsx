
import React from 'react';
import { type } from '../theme';
import styled, { keyframes } from 'styled-components';
import { TimelineStatement, Suspect } from '../types';
import SuspectPortrait from './SuspectPortrait';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: calc(var(--space) * 3);

  @media (max-width: 600px) {
    padding: var(--space);
  }
`;

const ModalContent = styled.div`
  background: var(--color-officer-surface);
  border: 2px solid var(--color-officer-border);
  width: 100%;
  max-width: 1200px;
  height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 30px var(--color-bg);
  position: relative;

  @media (max-width: 600px) {
    height: 90vh;
  }
`;

const ModalHeader = styled.div`
  background: var(--color-officer-bg);
  color: var(--color-officer-text);
  padding: calc(var(--space) * 2) calc(var(--space) * 3);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-officer-border);

  h2 {
    margin: 0;
    ${type.h3}
    letter-spacing: 2px;
    color: var(--color-text-bright);
  }
`;

const CloseButton = styled.button`
  background: transparent;
  color: var(--color-officer-text);
  border: none;
  ${type.h3}
  cursor: pointer;
  &:hover { color: var(--color-text-bright); }
`;

/* Non-scrolling wrapper: holds the vertical spine line absolutely positioned */
const TimelineLineWrapper = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;

  &::before {
    content: '';
    position: absolute;
    left: calc(50% - 3.5px);
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--color-officer-border);
    transform: translateX(-50%);
    z-index: 0;
    pointer-events: none;
    
    @media (max-width: 600px) {
      left: 20px;
    }
  }
`;

const TimelineContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  position: relative;
  background: rgba(0, 0, 0, 0.2);
`;

const ScrollContent = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 100%;
  padding: calc(var(--space) * 4) calc(var(--space) * 3);
  box-sizing: border-box;

  @media (max-width: 600px) {
    padding: calc(var(--space) * 3) var(--space);
  }
`;

/* --- Time group: a cluster of events that share the same timestamp --- */

const TimeGroup = styled.div`
  position: relative;
  margin-bottom: calc(var(--space) * 4);
  animation: ${fadeIn} 0.3s ease-out both;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const TimeGroupLabel = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 3;
  margin-bottom: calc(var(--space) * 2);

  @media (max-width: 600px) {
    align-items: flex-start;
    padding-left: calc(var(--space) * 5);
  }
`;

const TimeBadge = styled.div`
  background: var(--color-officer-bg);
  color: var(--color-accent-green);
  border: 1px solid var(--color-accent-green);
  padding: var(--space) calc(var(--space) * 2);
  font-family: 'VT323', monospace;
  ${type.h3}
  letter-spacing: 2px;
  box-shadow: 0 0 15px rgba(0, 255, 0, 0.15);
  position: relative;
  z-index: 3;
  margin-bottom: var(--space);

  @media (max-width: 600px) {
    ${type.bodyLg}
    padding: 0 calc(var(--space) * 2);
    margin-top: var(--space);
  }
`;

const TimeGroupDot = styled.div`
  width: 14px;
  height: 14px;
  background: var(--color-accent-green);
  border-radius: 50%;
  box-shadow: 0 0 12px var(--color-accent-green);
  z-index: 2;
  flex-shrink: 0;

  @media (max-width: 600px) {
    position: absolute;
    left: 10px;
    top: 0px;
    transform: translateX(-50%) translateY(100%);
  }
`;

const EventsRow = styled.div`
  display: flex;
  gap: calc(var(--space) * 3);
  position: relative;
  padding: 0 30px;

  @media (max-width: 600px) {
    flex-direction: column;
    padding-left: calc(var(--space) * 5);
    padding-right: var(--space);
    gap: var(--space);
  }
`;

const LeftEvents = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space);
  align-items: flex-end;

  @media (max-width: 600px) {
    align-items: flex-start;
  }
`;

const RightEvents = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space);
  align-items: flex-start;
`;

/* Invisible spacer so groups stay balanced */
const Spacer = styled.div`
  flex: 1;
  @media (max-width: 600px) { display: none; }
`;

const StatementCard = styled.div<{ $isInitial?: boolean }>`
  background: var(--color-officer-button);
  border: 1px solid var(--color-officer-border);
  ${props => props.$isInitial ? 'border-left: 4px solid var(--color-accent-green);' : ''}
  padding: calc(var(--space) * 2) calc(var(--space) * 2);
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  position: relative;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space);
`;

const SuspectInfo = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space);

  span {
    font-weight: bold;
    color: var(--color-text-bright);
    ${type.small}
  }
`;

const StatementText = styled.p`
  margin: 0;
  color: var(--color-officer-accent);
  font-style: italic;
  line-height: 1.4;
  ${type.body}
`;

const NewEntryDot = styled.div`
  position: absolute;
  top: -4px;
  right: -4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-accent-blue);
  box-shadow: 0 0 6px var(--color-accent-blue), 0 0 12px rgba(68,170,255,0.4);
  animation: notif-pulse 1.5s ease-in-out infinite;
  z-index: 5;

  @keyframes notif-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.3); opacity: 0.7; }
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-disabled);
  text-align: center;
  padding: calc(var(--space) * 5);
  
  svg {
    width: 64px;
    height: 64px;
    margin-bottom: calc(var(--space) * 3);
    opacity: 0.3;
  }
`;

interface TimelineModalProps {
  statements: TimelineStatement[];
  initialTimeline?: TimelineStatement[];
  suspects: Suspect[];
  onClose: () => void;
  inline?: boolean;
  newTimelineIds?: Set<string>;
}

/**
 * Parse any common time format to a sortable minute-of-day value.
 * Supports: "8:00 PM", "20:00", "8:00pm", "20:00 GTS", etc.
 */
const parseTimeToMinutes = (t: string): number => {
  if (!t) return -1;
  const cleaned = t.trim();

  // Try 12-hour: "8:00 PM", "8:00pm", "8:00 pm"
  const match12 = cleaned.match(/^(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (match12) {
    let h = parseInt(match12[1]);
    const m = parseInt(match12[2]);
    const isPm = match12[3].toLowerCase() === 'pm';
    if (isPm && h < 12) h += 12;
    if (!isPm && h === 12) h = 0;
    return h * 60 + m;
  }

  // Try 24-hour: "20:00", "20:45", "08:30 GTS"
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    const h = parseInt(match24[1]);
    const m = parseInt(match24[2]);
    return h * 60 + m;
  }

  return -1;
};

const DayDivider = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: calc(var(--space) * 2);
  padding: calc(var(--space) * 4) calc(var(--space) * 4);
  z-index: 4;
  background: var(--color-officer-surface);

  &::before, &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--color-accent-green);
    opacity: 0.3;
  }

  @media (max-width: 600px) {
    background: none;
    padding: calc(var(--space) * 3) var(--space) calc(var(--space) * 3) calc(var(--space) * 5);
    &::before { display: none; }
  }
`;

const DayLabel = styled.div`
  font-family: 'VT323', monospace;
  color: var(--color-accent-green);
  ${type.h3}
  letter-spacing: 3px;
  text-transform: uppercase;
  white-space: nowrap;
  text-shadow: 0 0 10px rgba(0, 255, 0, 0.3);

  @media (max-width: 600px) {
    ${type.bodyLg}
    letter-spacing: 2px;
  }
`;

const TimelineModal: React.FC<TimelineModalProps> = ({ statements, initialTimeline = [], suspects, onClose, inline = false, newTimelineIds = new Set() }) => {
  // Combine discovered statements with initial timeline events
  const allEvents = [
    ...statements.map(s => ({
      id: s.id,
      time: s.time,
      text: s.statement,
      suspectId: s.suspectId,
      suspectName: s.suspectName,
      isInitial: false,
      day: s.day || 'Today',
      dayOffset: s.dayOffset ?? 0
    })),
    ...initialTimeline.map((e, idx) => ({
      id: `initial-${idx}`,
      time: e.time,
      text: e.statement,
      suspectId: null as string | null,
      suspectName: null as string | null,
      isInitial: true,
      day: e.day || 'Today',
      dayOffset: e.dayOffset ?? 0
    }))
  ];

  // Sort all events by day offset first, then by time within each day
  const sortedEvents = [...allEvents].sort((a, b) => {
    // Sort by dayOffset first (ascending: earliest day first)
    if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset;
    // Within same day, sort by time
    const aMin = parseTimeToMinutes(a.time);
    const bMin = parseTimeToMinutes(b.time);
    if (aMin !== bMin) return aMin - bMin;
    // Stable: initial events first within same time
    if (a.isInitial && !b.isInitial) return -1;
    if (!a.isInitial && b.isInitial) return 1;
    return 0;
  });

  // Group events by day, then by time within each day
  type TimeGroup = { time: string; minutes: number; events: typeof sortedEvents };
  type DayGroup = { day: string; dayOffset: number; timeGroups: TimeGroup[] };

  const dayGroups: DayGroup[] = [];
  sortedEvents.forEach(e => {
    let currentDay = dayGroups[dayGroups.length - 1];
    if (!currentDay || currentDay.dayOffset !== e.dayOffset) {
      currentDay = { day: e.day, dayOffset: e.dayOffset, timeGroups: [] };
      dayGroups.push(currentDay);
    }

    const lastTimeGroup = currentDay.timeGroups[currentDay.timeGroups.length - 1];
    if (lastTimeGroup && lastTimeGroup.time === e.time) {
      lastTimeGroup.events.push(e);
    } else {
      currentDay.timeGroups.push({ time: e.time, minutes: parseTimeToMinutes(e.time), events: [e] });
    }
  });

  const renderEvent = (e: typeof sortedEvents[0]) => {
    const suspect = e.suspectId ? suspects.find(sus => sus.id === e.suspectId) : null;
    return (
      <StatementCard key={e.id} $isInitial={e.isInitial}>
        {newTimelineIds.has(e.id) && <NewEntryDot />}
        <CardHeader>
          {suspect ? (
            <SuspectInfo>
              <SuspectPortrait suspect={suspect} size={28} />
              <span>{suspect.name}</span>
            </SuspectInfo>
          ) : e.suspectName ? (
            <SuspectInfo>
              <span>{e.suspectName}</span>
            </SuspectInfo>
          ) : e.isInitial ? (
            <SuspectInfo>
              <span style={{ color: 'var(--color-accent-green)', fontSize: 'var(--type-xs)', textTransform: 'uppercase', letterSpacing: '1px' }}>Initial Discovery</span>
            </SuspectInfo>
          ) : null}
        </CardHeader>
        <StatementText>"{e.text}"</StatementText>
      </StatementCard>
    );
  };

  let globalGroupIdx = 0;
  const hasMultipleDays = dayGroups.length > 1;

  const timelineContent = (
    <ScrollContent>
      {dayGroups.length === 0 ? (
        <EmptyState>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <p>No timeline events discovered yet.<br />Interrogate suspects or examine evidence to reveal the sequence of events.</p>
        </EmptyState>
      ) : (
        dayGroups.map((dayGroup, dayIdx) => (
          <React.Fragment key={`day-${dayGroup.dayOffset}-${dayIdx}`}>
            {/* Day divider — always shown if multiple days, or if the single day isn't the default */}
            {(hasMultipleDays || dayGroup.day !== 'Today') && (
              <DayDivider>
                <DayLabel>{dayGroup.day}</DayLabel>
              </DayDivider>
            )}
            {dayGroup.timeGroups.map((group) => {
              const idx = globalGroupIdx++;
              const leftItems = group.events.filter(e => e.isInitial || !e.suspectId);
              const rightItems = group.events.filter(e => !e.isInitial && e.suspectId);
              const allLeft = rightItems.length === 0;
              const allRight = leftItems.length === 0;

              return (
                <TimeGroup key={group.time + '-' + idx} style={{ animationDelay: `${idx * 0.05}s` }}>
                  <TimeGroupLabel>
                    <TimeBadge>{group.time}</TimeBadge>
                    <TimeGroupDot />
                  </TimeGroupLabel>
                  <EventsRow>
                    {allRight ? (
                      <>
                        {idx % 2 === 0 ? <Spacer /> : null}
                        <RightEvents>
                          {rightItems.map(renderEvent)}
                        </RightEvents>
                        {idx % 2 !== 0 ? <Spacer /> : null}
                      </>
                    ) : allLeft ? (
                      <>
                        {idx % 2 === 0 ? (
                          <LeftEvents>{leftItems.map(renderEvent)}</LeftEvents>
                        ) : <Spacer />}
                        {idx % 2 !== 0 ? (
                          <RightEvents>{leftItems.map(renderEvent)}</RightEvents>
                        ) : <Spacer />}
                      </>
                    ) : (
                      <>
                        <LeftEvents>{leftItems.map(renderEvent)}</LeftEvents>
                        <RightEvents>{rightItems.map(renderEvent)}</RightEvents>
                      </>
                    )}
                  </EventsRow>
                </TimeGroup>
              );
            })}
          </React.Fragment>
        ))
      )}
    </ScrollContent>
  );

  if (inline) {
    return (
      <TimelineLineWrapper>
        <TimelineContainer>
          {timelineContent}
        </TimelineContainer>
      </TimelineLineWrapper>
    );
  }

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <h2>CASE TIMELINE</h2>
          <CloseButton onClick={onClose}>&times;</CloseButton>
        </ModalHeader>

        <TimelineLineWrapper>
          <TimelineContainer>
            {timelineContent}
          </TimelineContainer>
        </TimelineLineWrapper>
      </ModalContent>
    </ModalOverlay>
  );
};

export default TimelineModal;
