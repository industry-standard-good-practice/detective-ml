
import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { CaseData, ScreenState, ChatMessage, Evidence, Emotion, TimelineStatement } from '../types';
import { getPixelArtUrl } from '../services/gameHelpers';
import SuspectCard from '../components/SuspectCard';
import SuspectCardDock from '../components/SuspectCardDock';
import TimelineModal from '../components/TimelineModal';
import { useOnboarding, OnboardingStep } from '../contexts/OnboardingContext';

const HubContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  overflow: hidden;
  
  /* CSS Variable for card deck spacing, responsive */
  --card-spacing: 190px;
`;

const BoardSection = styled.div`
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 20px 20px 50px 20px;
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const MainLayout = styled.div`
  display: flex;
  gap: 20px;
  flex: 1;
  overflow: hidden;
  margin-top: 0;
  
  @media (max-width: 768px) {
    display: none; /* Desktop layout hidden on mobile */
  }
`;

const EvidenceBoard = styled.div`
  flex: 1;
  border: 2px dashed #444;
  background: rgba(0,0,0,0.2);
  padding: 20px;
  overflow-y: auto;
  position: relative;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  
  @media (max-width: 768px) {
    padding: 15px;
    padding-top: 0;
    border: 1px dashed #333;
    background: rgba(0,0,0,0.2);
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }
`;

const EvidenceGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  align-content: flex-start; 
`;

const EvidenceItemBase = styled(motion.div)`
  background: #fff;
  color: #000;
  padding: 12px 12px 24px 12px;
  width: 260px;
  box-shadow: 3px 3px 12px rgba(0,0,0,0.6);
  font-family: 'Caveat', cursive;
  font-size: var(--type-body-lg);
  line-height: 1.1;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;

  @media (min-width: 769px) {
    &:hover {
      z-index: 50;
      box-shadow: 8px 8px 20px rgba(0,0,0,0.7);
    }
  }
  
  @media (max-width: 768px) {
    width: 100%;
  }
`;

const LightboxOverlay = styled(motion.div)`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 10000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  cursor: pointer;
  overflow-y: auto;
  padding: 40px 20px;
`;

const LightboxCardWrapper = styled(motion.div)`
  background: #fff;
  color: #000;
  padding: 20px 20px 36px 20px;
  max-width: 500px;
  width: 90vw;
  box-shadow: 0 20px 60px rgba(0,0,0,0.8);
  font-family: 'Caveat', cursive;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: default;
  margin: auto 0;
  flex-shrink: 0;
`;

const LightboxImage = styled.div<{ $src?: string }>`
  width: 100%;
  aspect-ratio: 1;
  background-color: #333;
  background-image: ${props => props.$src ? `url(${props.$src})` : 'none'};
  background-size: cover;
  background-position: center;
  image-rendering: pixelated;
  border: 1px solid #ddd;
  margin-bottom: 16px;
`;

const LightboxText = styled.div`
  text-align: center;
  width: 100%;
  
  strong {
    display: block;
    font-size: 2rem;
    margin-bottom: 6px;
    font-weight: 700;
  }
  
  span {
    font-size: 1.4rem;
    color: #333;
    display: block;
    padding: 0 10px;
    line-height: 1.4;
  }
`;

const LightboxClose = styled.button`
  position: fixed;
  top: 20px;
  right: 30px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border: 2px solid #fff;
  font-size: 1.2rem;
  font-family: 'VT323', monospace;
  padding: 8px 16px;
  cursor: pointer;
  z-index: 10002;
  transition: background 0.2s;
  
  &:hover {
    background: rgba(255,255,255,0.2);
  }
`;

const PolaroidImage = styled.div<{ $src?: string }>`
  width: 100%;
  aspect-ratio: 1;
  background-color: #333;
  background-image: ${props => props.$src ? `url(${props.$src})` : 'none'};
  background-size: cover;
  background-position: center;
  image-rendering: pixelated;
  border: 1px solid #ddd;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  font-size: var(--type-small);
`;

const PolaroidText = styled.div`
  text-align: center;
  width: 100%;
  
  strong {
    display: block;
    font-size: var(--type-h3);
    margin-bottom: 2px;
    font-weight: 700;
  }
  
  span {
    font-size: var(--type-body-lg);
    color: #000;
    display: block;
    padding: 0 5px;
  }
`;

const NoteItem = styled(EvidenceItemBase)`
  background: #fff9c4; /* Light yellow post-it */
  width: 260px;
  min-height: 180px;
  align-items: flex-start;
  font-family: 'Caveat', cursive;
  font-size: var(--type-h3);
  color: #000;
  
  strong {
      display: block;
      width: 100%;
      border-bottom: 1px dashed #990;
      margin-bottom: 8px;
      font-weight: 700;
  }
  
  @media (max-width: 768px) {
    width: 100%;
  }
`;

const SidePanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
  width: 320px;
  flex-shrink: 0;
  z-index: 20;
`;

const ChiefWidget = styled.div`
  background: #0d1b2a;
  border: 2px solid #415a77;
  padding: 10px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  gap: 8px;
  
  @media (max-width: 768px) {
    width: 100%;
    flex: 1; /* Fill available space on mobile */
    gap: 20px;
    justify-content: center;
  }
`;

const ChiefStatus = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  color: #778da9;
  
  img {
    border: 2px solid #415a77;
    image-rendering: pixelated;
    width: 40px;
    height: 40px;
    object-fit: cover;
  }
  
  div {
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 768px) {
    flex-direction: column;
    text-align: center;
    
    img {
      width: 150px;
      height: 150px;
      margin-bottom: 10px;
    }
    
    div span:first-child {
      font-size: var(--type-h2);
      color: #fff;
    }
    
    div span:last-child {
      font-size: var(--type-body-lg);
    }
  }
`;

const SecureLineButton = styled.button`
  background: #1b263b;
  color: #e0e1dd;
  border: 1px solid #415a77;
  padding: 8px;
  cursor: pointer;
  font-family: inherit;
  font-size: var(--type-small);
  text-transform: uppercase;
  
  &:hover:not(:disabled) {
    background: #415a77;
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    padding: 15px;
    font-size: var(--type-body-lg);
    background: #253855;
  }
`;

const AccuseButton = styled.button`
  background: #700;
  color: #fff;
  border: 2px solid #a00;
  padding: 15px;
  font-family: inherit;
  font-size: var(--type-body-lg);
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(0,0,0,0.5);
  
  &:hover {
    background: #900;
    transform: scale(1.02);
  }
  
  @media (max-width: 768px) {
    font-size: var(--type-h3);
    padding: 20px;
  }
`;

const TimelineButton = styled.button`
  background: #1b263b;
  color: #0f0;
  border: 2px solid #415a77;
  padding: 12px;
  font-family: inherit;
  font-size: var(--type-body);
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  
  &:hover {
    background: #253855;
    border-color: #0f0;
  }

  svg {
    width: 20px;
    height: 20px;
  }
  
  @media (max-width: 768px) {
    font-size: var(--type-body-lg);
    padding: 15px;
  }
`;

const BriefingWidget = styled.div`
  background: #111;
  border: 1px solid #444;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  overflow-y: auto;
  box-shadow: 0 4px 10px rgba(0,0,0,0.5);
  
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }

  h3 {
    margin: 0;
    color: #888;
    font-size: 1.1rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1px solid #333;
    padding-bottom: 5px;
  }
  
  p {
    margin: 0;
    font-size: 1.1rem;
    line-height: 1.6;
    color: #ddd;
    font-family: 'VT323', monospace;
  }

  .tags {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  
  @media (max-width: 768px) {
    width: 100%;
    max-height: none;
    
    h3 {
        font-size: var(--type-body-lg);
        color: #aaa;
    }
    
    p {
        font-size: var(--type-body-lg);
        line-height: 1.6;
    }
    
    .tags {
        gap: 15px;
    }
  }
`;

const Tag = styled.span<{ $color?: string }>`
  background: #222;
  color: ${props => props.$color || '#aaa'};
  padding: 2px 6px;
  font-size: var(--type-small);
  border: 1px solid #333;
  text-transform: uppercase;
  
  @media (max-width: 768px) {
    font-size: var(--type-body);
    padding: 5px 10px;
  }
`;



const ModalOverlay = styled.div`
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
`;

const ChatModal = styled.div`
  width: 600px;
  height: 500px;
  background: #050a10;
  border: 2px solid #415a77;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 30px #000;
  
  @media (max-width: 768px) {
    width: 95%;
    height: 80%;
  }
`;

const ChatHeader = styled.div`
  background: #0d1b2a;
  color: #778da9;
  padding: 10px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #415a77;
`;

const CloseButton = styled.button`
  background: transparent;
  color: #778da9;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  &:hover { color: #fff; }
`;

const ChatLog = styled.div`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const OfficerBubble = styled.div<{ $sender: 'player' | 'officer' }>`
  align-self: ${props => props.$sender === 'player' ? 'flex-end' : 'flex-start'};
  max-width: 80%;
  background: ${props => props.$sender === 'player' ? '#1b263b' : '#0d1b2a'};
  color: ${props => props.$sender === 'player' ? '#e0e1dd' : '#778da9'};
  padding: 10px;
  border: 1px solid #415a77;
  
  .name { font-size: var(--type-small); margin-bottom: 4px; opacity: 0.7; }
`;

const InputZone = styled.div`
  padding: 15px;
  border-top: 1px solid #415a77;
  display: flex;
  gap: 10px;
  background: #0d1b2a;
`;

const ChatInput = styled.input`
  flex: 1;
  background: #050a10;
  border: 1px solid #415a77;
  color: #e0e1dd;
  padding: 8px;
  font-family: inherit;
  font-size: var(--type-body);
  
  &:focus { outline: none; border-color: #778da9; }
`;

const SendButton = styled.button`
  background: #415a77;
  color: #fff;
  border: none;
  padding: 0 20px;
  cursor: pointer;
  font-family: inherit;
  
  &:hover { background: #5a7ea8; }
  &:disabled { opacity: 0.5; }
`;

// --- MOBILE COMPONENTS ---

const MobileTabBar = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    background: #111;
    border-bottom: 1px solid #333;
    padding: 0 5px;
    flex-shrink: 0; /* Prevent shrinking */
  }
`;

const TabItem = styled.button<{ $active: boolean }>`
  flex: 1;
  background: transparent;
  color: ${props => props.$active ? '#fff' : '#666'};
  border: none;
  border-bottom: 3px solid ${props => props.$active ? '#0f0' : 'transparent'};
  padding: 10px 5px;
  font-family: inherit;
  font-size: var(--type-body-lg);
  font-weight: bold;
  text-transform: uppercase;
`;

const MobileContentArea = styled.div<{ $noPadding?: boolean; $noScroll?: boolean }>`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    flex: 1;
    flex-direction: column;
    overflow-y: ${props => props.$noScroll ? 'hidden' : 'auto'};
    padding: ${props => props.$noPadding ? '0' : '10px'};
    gap: ${props => props.$noScroll ? '0' : '15px'};
    min-height: 0; /* CRITICAL: Enables proper scrolling in flex child */
  }
`;

const MobileCarousel = styled.div`
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  gap: 20px;
  /* Top/Bottom padding 20px to avoid shadow clipping */
  /* Padding left/right calculation to center the 280px card. (50% - 140px) */
  padding: 20px calc(50% - 140px);
  align-items: center; /* Center vertically */
  flex: 1; /* Fill the remaining height */
  height: 100%;
  scroll-snap-type: x mandatory;
  width: 100%;
  
  /* Hide scrollbar for cleaner look */
  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: #444; 
    border-radius: 2px;
  }
`;

const CarouselSnapItem = styled.div`
  scroll-snap-align: center;
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
  /* Removed padding to ensure strict width calculation for centering */
  width: 280px; 
`;

interface CaseHubProps {
  caseData: CaseData;
  evidenceDiscovered: Evidence[];
  timelineStatements: any[]; // Using any[] for now to avoid import issues if not exported
  notes: Record<string, string[]>;
  officerHintsRemaining: number;
  officerHistory: ChatMessage[];
  isThinking: boolean;
  onStartInterrogation: (suspectId: string) => void;
  onNavigate: (screen: ScreenState) => void;
  onSendOfficerMessage: (text: string) => void;
  unreadSuspectIds?: Set<string>;
}

const CaseHub: React.FC<CaseHubProps> = ({
  caseData,
  evidenceDiscovered,
  timelineStatements,
  notes,
  officerHintsRemaining,
  officerHistory,
  isThinking,
  onStartInterrogation,
  onNavigate,
  onSendOfficerMessage,
  unreadSuspectIds = new Set()
}) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [lightboxEvidence, setLightboxEvidence] = useState<{ title: string; description: string; imageUrl?: string; id?: string } | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);

  const openLightbox = (item: Evidence, evidenceKey: string) => {
    setSelectedEvidenceId(evidenceKey);
    setLightboxEvidence(item);
  };

  const closeLightbox = () => {
    setSelectedEvidenceId(null);
    setLightboxEvidence(null);
  };
  const [inputVal, setInputVal] = useState('');
  const [activeMobileTab, setActiveMobileTab] = useState<'BOARD' | 'FILES' | 'HQ' | 'SUSPECTS'>('BOARD');
  const logRef = useRef<HTMLDivElement>(null);
  const { startTour, completeStep, currentStep } = useOnboarding();

  useEffect(() => {
    startTour(false);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [officerHistory, isChatOpen]);

  const handleSend = () => {
    if (!inputVal.trim() || isThinking || officerHintsRemaining <= 0) return;
    onSendOfficerMessage(inputVal);
    setInputVal('');
  };

  const getDiffColor = (d: string) => {
    if (d === 'Hard') return '#f55';
    if (d === 'Medium') return '#fa0';
    return '#5f5';
  };

  const officerName = caseData.officer?.name || "Chief";
  const officerRole = caseData.officer?.role || "Police Chief";
  const officerPortrait = caseData.officer?.portraits?.[Emotion.NEUTRAL] || getPixelArtUrl('police-chief', 60);

  return (
    <HubContainer>
      <LayoutGroup>
        {/* MOBILE TABS */}
        <MobileTabBar id="mobile-tab-bar">
          <TabItem $active={activeMobileTab === 'BOARD'} onClick={() => setActiveMobileTab('BOARD')}>BOARD</TabItem>
          <TabItem $active={activeMobileTab === 'FILES'} onClick={() => setActiveMobileTab('FILES')}>BRIEF</TabItem>
          <TabItem $active={activeMobileTab === 'HQ'} onClick={() => setActiveMobileTab('HQ')}>HQ</TabItem>
          <TabItem $active={activeMobileTab === 'SUSPECTS'} onClick={() => setActiveMobileTab('SUSPECTS')}>SUSPECTS</TabItem>
        </MobileTabBar>

        {/* MOBILE CONTENT RENDERER */}
        <MobileContentArea $noPadding={activeMobileTab === 'SUSPECTS'} $noScroll={activeMobileTab === 'BOARD'}>
          {activeMobileTab === 'BOARD' && (
            <>
              <EvidenceBoard id="evidence-board-mobile">
                <h2 style={{ color: '#aaa', borderBottom: '1px dashed #444', paddingBottom: '10px' }}>
                  EVIDENCE BOARD
                </h2>
                <EvidenceGrid>
                  {evidenceDiscovered.map((ev, i) => (
                    <EvidenceItemBase key={ev.id || i}>
                      <PolaroidImage $src={ev.imageUrl}>
                        {!ev.imageUrl && 'No IMG'}
                      </PolaroidImage>
                      <PolaroidText>
                        <strong>{ev.title}</strong>
                        <span>{ev.description}</span>
                      </PolaroidText>
                    </EvidenceItemBase>
                  ))}
                  {Object.entries(notes).flatMap(([sId, noteList]) =>
                    (noteList as string[]).map((n, i) => (
                      <NoteItem key={`note-${sId}-${i}`}>
                        <strong>{caseData.suspects.find(s => s.id === sId)?.name}</strong>
                        {n}
                      </NoteItem>
                    ))
                  )}
                </EvidenceGrid>
              </EvidenceBoard>
              <TimelineButton id="timeline-button-mobile-board" onClick={() => setIsTimelineOpen(true)} style={{ flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                TIMELINE ({timelineStatements.length})
              </TimelineButton>
            </>
          )}

          {activeMobileTab === 'FILES' && (
            <BriefingWidget>
              <div id="mission-briefing-mobile" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3>Mission Briefing</h3>
                <div className="tags">
                  <Tag>{caseData.type}</Tag>
                  <Tag $color={getDiffColor(caseData.difficulty)}>{caseData.difficulty}</Tag>
                </div>
                <p>{caseData.description}</p>
              </div>
            </BriefingWidget>
          )}

          {activeMobileTab === 'HQ' && (
            <>
              <ChiefWidget>
                <ChiefStatus>
                  <img src={officerPortrait} alt={officerName} />
                  <div>
                    <span style={{ fontWeight: 'bold' }}>{officerName.toUpperCase()}</span>
                    <span style={{ color: officerHintsRemaining > 3 ? '#778da9' : '#b00' }}>
                      BATT: {officerHintsRemaining * 10}%
                    </span>
                  </div>
                </ChiefStatus>
                <SecureLineButton id="secure-line-mobile" onClick={() => setIsChatOpen(true)}>
                  [SECURE LINE]
                </SecureLineButton>
              </ChiefWidget>
              <TimelineButton id="timeline-button-mobile" onClick={() => setIsTimelineOpen(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                TIMELINE
              </TimelineButton>
              <AccuseButton onClick={() => onNavigate(ScreenState.ACCUSATION)}>
                MAKE ACCUSATION
              </AccuseButton>
            </>
          )}

          {activeMobileTab === 'SUSPECTS' && (
            <MobileCarousel id="suspect-cards-container-mobile">
              {caseData.suspects.map(s => (
                <CarouselSnapItem key={s.id}>
                  <SuspectCard
                    suspect={s}
                    width="280px"
                    height="450px"
                    variant="default"
                    onAction={() => {
                      completeStep(OnboardingStep.SUSPECT_CARDS, true);
                      onStartInterrogation(s.id);
                    }}
                    actionLabel="INTERROGATE"
                  />
                </CarouselSnapItem>
              ))}
            </MobileCarousel>
          )}
        </MobileContentArea>

        {/* DESKTOP LAYOUT */}
        <BoardSection>
          <MainLayout>
            <EvidenceBoard id="evidence-board">
              <h2 style={{
                marginTop: 0,
                marginBottom: '20px',
                fontSize: 'var(--type-h3)',
                color: '#aaa',
                borderBottom: '1px dashed #444',
                paddingBottom: '10px',
                fontWeight: 'normal'
              }}>
                EVIDENCE BOARD: <span style={{ color: '#fff', fontWeight: 'bold' }}>{caseData.title.toUpperCase()}</span>
              </h2>

              <EvidenceGrid>
                {evidenceDiscovered.map((ev, i) => {
                  const eKey = `ev-desktop-${ev.id || i}`;
                  const isSelected = selectedEvidenceId === eKey;
                  return (
                    <EvidenceItemBase
                      key={eKey}
                      layoutId={isSelected ? undefined : eKey}
                      onClick={() => !isSelected && openLightbox(ev, eKey)}
                      data-cursor="pointer"
                      whileHover={!isSelected ? { scale: 1.05, rotate: 0 } : undefined}
                      style={{
                        rotate: isSelected ? 0 : Math.random() * 6 - 3,
                        visibility: isSelected ? 'hidden' : 'visible',
                        pointerEvents: isSelected ? 'none' : 'auto'
                      }}
                    >
                      <PolaroidImage $src={ev.imageUrl}>
                        {!ev.imageUrl && 'No IMG'}
                      </PolaroidImage>
                      <PolaroidText>
                        <strong>{ev.title}</strong>
                        <span>{ev.description}</span>
                      </PolaroidText>
                    </EvidenceItemBase>
                  );
                })}
                {Object.entries(notes).flatMap(([sId, noteList]) =>
                  (noteList as string[]).map((n, i) => (
                    <NoteItem key={`note-${sId}-${i}`} style={{ transform: `rotate(${Math.random() * 6 - 3}deg)` }}>
                      <strong>Note on {caseData.suspects.find(s => s.id === sId)?.name}</strong>
                      {n}
                    </NoteItem>
                  ))
                )}
              </EvidenceGrid>
            </EvidenceBoard>

            <SidePanel>
              <BriefingWidget>
                <div id="mission-briefing" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h3>Mission Briefing</h3>
                  <div className="tags">
                    <Tag>{caseData.type}</Tag>
                    <Tag $color={getDiffColor(caseData.difficulty)}>{caseData.difficulty}</Tag>
                  </div>
                  <p>{caseData.description}</p>
                </div>
              </BriefingWidget>

              <ChiefWidget>
                <ChiefStatus>
                  <img src={officerPortrait} alt={officerName} />
                  <div>
                    <span style={{ fontWeight: 'bold', fontSize: 'var(--type-body)' }}>{officerName.toUpperCase()}</span>
                    <span style={{ fontSize: 'var(--type-small)', color: officerHintsRemaining > 3 ? '#778da9' : '#b00' }}>
                      BATT: {officerHintsRemaining * 10}%
                    </span>
                  </div>
                </ChiefStatus>
                <SecureLineButton id="secure-line" onClick={() => setIsChatOpen(true)}>
                  [SECURE LINE]
                </SecureLineButton>
              </ChiefWidget>

              <TimelineButton id="timeline-button" onClick={() => setIsTimelineOpen(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                TIMELINE
              </TimelineButton>

              <AccuseButton onClick={() => onNavigate(ScreenState.ACCUSATION)}>
                MAKE ACCUSATION
              </AccuseButton>
            </SidePanel>
          </MainLayout>

        </BoardSection>

        <SuspectCardDock
          suspects={caseData.suspects}
          onSelectSuspect={(id) => {
            completeStep(OnboardingStep.SUSPECT_CARDS, true);
            onStartInterrogation(id);
          }}
          inactiveActionLabel="TALK"
          unreadSuspectIds={unreadSuspectIds}
          onFlipCard={(flipped) => {
            if (flipped) completeStep(OnboardingStep.FLIP_CARD, false);
          }}
        />

        {isChatOpen && (
          <ModalOverlay>
            <ChatModal>
              <ChatHeader>
                <span>SECURE LINE: {officerRole.toUpperCase()}</span>
                <CloseButton onClick={() => setIsChatOpen(false)}>[X]</CloseButton>
              </ChatHeader>
              <ChatLog ref={logRef}>
                {officerHistory.map((msg, i) => (
                  <OfficerBubble key={i} $sender={msg.sender as 'player' | 'officer'}>
                    <div className="name">{msg.sender === 'player' ? 'DETECTIVE' : officerName.toUpperCase()}</div>
                    {msg.text}
                  </OfficerBubble>
                ))}
                {isThinking && <div style={{ color: '#555', fontStyle: 'italic' }}>Incoming transmission...</div>}
                {officerHintsRemaining <= 0 && <div style={{ color: '#b00', textAlign: 'center' }}>[CONNECTION LOST - BATTERY DEPLETED]</div>}
              </ChatLog>
              <InputZone>
                <ChatInput
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder={officerHintsRemaining > 0 ? "Ask for guidance..." : "Connection lost."}
                  disabled={officerHintsRemaining <= 0 || isThinking}
                />
                <SendButton onClick={handleSend} disabled={officerHintsRemaining <= 0 || isThinking}>
                  SEND
                </SendButton>
              </InputZone>
            </ChatModal>
          </ModalOverlay>
        )}

        {isTimelineOpen && (
          <TimelineModal
            statements={timelineStatements}
            suspects={caseData.suspects}
            onClose={() => setIsTimelineOpen(false)}
          />
        )}

        {/* EVIDENCE LIGHTBOX */}
        <AnimatePresence>
          {selectedEvidenceId && lightboxEvidence && (
            <LightboxOverlay
              key="lightbox-overlay"
              initial={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
              animate={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
              exit={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
              transition={{ duration: 0.25 }}
              onClick={closeLightbox}
            >
              <LightboxClose onClick={closeLightbox}>[CLOSE]</LightboxClose>
              <LightboxCardWrapper
                layoutId={selectedEvidenceId}
                onClick={e => e.stopPropagation()}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <LightboxImage $src={lightboxEvidence.imageUrl} />
                <LightboxText>
                  <strong>{lightboxEvidence.title}</strong>
                  <span>{lightboxEvidence.description}</span>
                </LightboxText>
              </LightboxCardWrapper>
            </LightboxOverlay>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </HubContainer>
  );
};

export default CaseHub;
