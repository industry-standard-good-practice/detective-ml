
import React from 'react';
import styled from 'styled-components';
import { TimelineStatement, Suspect } from '../types';
import SuspectPortrait from './SuspectPortrait';

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
  padding: 20px;

  @media (max-width: 600px) {
    padding: 10px;
  }
`;

const ModalContent = styled.div`
  background: #050a10;
  border: 2px solid #415a77;
  width: 100%;
  max-width: 1200px;
  height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 30px #000;
  position: relative;

  @media (max-width: 600px) {
    height: 90vh;
  }
`;

const ModalHeader = styled.div`
  background: #0d1b2a;
  color: #778da9;
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #415a77;

  h2 {
    margin: 0;
    font-size: 1.5rem;
    letter-spacing: 2px;
    color: #fff;
  }
`;

const CloseButton = styled.button`
  background: transparent;
  color: #778da9;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  &:hover { color: #fff; }
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
  gap: 20px;
  min-height: 100%;
  padding: 30px 20px;
  box-sizing: border-box;

  @media (max-width: 600px) {
    padding: 20px 10px 80px 10px;
  }

  &::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #415a77;
    transform: translateX(-50%);
    z-index: 1;
    
    @media (max-width: 600px) {
      left: 20px;
    }
  }
`;

const TimelineItem = styled.div<{ $side: 'left' | 'right' }>`
  display: flex;
  justify-content: ${props => props.$side === 'left' ? 'flex-end' : 'flex-start'};
  width: 50%;
  align-self: ${props => props.$side === 'left' ? 'flex-start' : 'flex-end'};
  position: relative;
  padding: 0 30px;

  &::after {
    content: '';
    position: absolute;
    width: 12px;
    height: 12px;
    background: #0f0;
    border-radius: 50%;
    top: 20px;
    ${props => props.$side === 'left' ? 'right: -6px;' : 'left: -6px;'}
    box-shadow: 0 0 10px #0f0;
    z-index: 2;
  }

  @media (max-width: 600px) {
    width: 100%;
    display: block;
    align-self: flex-start;
    padding-left: 40px;
    padding-right: 10px;
    box-sizing: border-box;

    &::after {
      left: 4px;
      right: auto;
    }
  }
`;

const StatementCard = styled.div`
  background: #1b263b;
  border: 1px solid #415a77;
  padding: 15px;
  border-radius: 4px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.3);
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #415a77;
  padding-bottom: 8px;
`;

const TimeLabel = styled.div`
  font-family: 'VT323', monospace;
  color: #0f0;
  font-size: 1.2rem;

  @media (max-width: 600px) {
    font-size: 1rem;
  }
`;

const SuspectInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  
  span {
    font-weight: bold;
    color: #fff;
    font-size: 0.9rem;
  }
`;

const StatementText = styled.p`
  margin: 0;
  color: #e0e1dd;
  font-style: italic;
  line-height: 1.4;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #555;
  text-align: center;
  padding: 40px;
  
  svg {
    width: 64px;
    height: 64px;
    margin-bottom: 20px;
    opacity: 0.3;
  }
`;

interface TimelineModalProps {
  statements: TimelineStatement[];
  initialTimeline?: TimelineStatement[];
  suspects: Suspect[];
  onClose: () => void;
}

const TimelineModal: React.FC<TimelineModalProps> = ({ statements, initialTimeline = [], suspects, onClose }) => {
  // Combine discovered statements with initial timeline events
  const allEvents = [
    ...statements.map(s => ({
      id: s.id,
      time: s.time,
      text: s.statement,
      suspectId: s.suspectId,
      isInitial: false
    })),
    ...initialTimeline.map((e, idx) => ({
      id: `initial-${idx}`,
      time: e.time,
      text: e.statement,
      suspectId: null,
      isInitial: true
    }))
  ];

  const sortedEvents = allEvents.sort((a, b) => {
    const getTimeVal = (t: string) => {
        const match = t.match(/(\d+):(\d+)\s*(am|pm)/i);
        if (!match) return 0;
        let h = parseInt(match[1]);
        const m = parseInt(match[2]);
        const isPm = match[3].toLowerCase() === 'pm';
        if (isPm && h < 12) h += 12;
        if (!isPm && h === 12) h = 0;
        return h * 60 + m;
    };
    return getTimeVal(a.time) - getTimeVal(b.time);
  });

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <h2>CASE TIMELINE</h2>
          <CloseButton onClick={onClose}>&times;</CloseButton>
        </ModalHeader>
        
        <TimelineContainer>
          <ScrollContent>
            {sortedEvents.length === 0 ? (
              <EmptyState>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <p>No timeline events discovered yet.<br/>Interrogate suspects or examine evidence to reveal the sequence of events.</p>
              </EmptyState>
            ) : (
              sortedEvents.map((e, idx) => {
                const suspect = e.suspectId ? suspects.find(sus => sus.id === e.suspectId) : null;
                return (
                  <TimelineItem key={e.id} $side={idx % 2 === 0 ? 'left' : 'right'}>
                    <StatementCard style={e.isInitial ? { borderLeft: '4px solid #0f0' } : {}}>
                      <CardHeader>
                        <TimeLabel>{e.time}</TimeLabel>
                        {suspect ? (
                          <SuspectInfo>
                            <SuspectPortrait suspect={suspect} size={30} />
                            <span>{suspect.name}</span>
                          </SuspectInfo>
                        ) : e.isInitial ? (
                          <SuspectInfo>
                            <span style={{ color: '#0f0', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Initial Discovery</span>
                          </SuspectInfo>
                        ) : null}
                      </CardHeader>
                      <StatementText>"{e.text}"</StatementText>
                    </StatementCard>
                  </TimelineItem>
                );
              })
            )}
          </ScrollContent>
        </TimelineContainer>
      </ModalContent>
    </ModalOverlay>
  );
};

export default TimelineModal;
