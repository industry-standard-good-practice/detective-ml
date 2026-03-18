
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { type } from '../theme';
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
  padding: 20px var(--screen-edge-horizontal) calc(var(--screen-edge-bottom) + 50px + 10px) var(--screen-edge-horizontal);
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const MainLayout = styled.div`
  display: flex;
  gap: calc(var(--space) * 3);
  flex: 1;
  overflow: hidden;
  margin-top: 0;
  
  @media (max-width: 768px) {
    display: none; /* Desktop layout hidden on mobile */
  }
`;

const EvidenceBoard = styled.div`
  flex: 1;
  border: 2px dashed var(--color-border);
  background: rgba(0,0,0,0.2);
  padding: calc(var(--space) * 3);
  overflow-y: auto;
  position: relative;
  display: flex;
  flex-direction: column;
  
  @media (max-width: 768px) {
    padding: calc(var(--space) * 2);
    padding-top: 0;
    border: 1px dashed var(--color-border);
    background: rgba(0,0,0,0.2);
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }
`;

const EvidenceGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--space) * 3);
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  align-content: flex-start; 
`;

const EvidenceItemBase = styled(motion.div)`
  background: var(--color-polaroid-bg);
  color: var(--color-text-inverse);
  padding: calc(var(--space) * 2) calc(var(--space) * 2) calc(var(--space) * 3) calc(var(--space) * 2);
  width: 260px;
  box-shadow: 3px 3px 12px var(--color-polaroid-shadow);
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
  padding: calc(var(--space) * 5) calc(var(--space) * 3);
`;

const LightboxCardWrapper = styled(motion.div)`
  background: var(--color-polaroid-bg);
  color: var(--color-text-inverse);
  padding: calc(var(--space) * 3) calc(var(--space) * 3) calc(var(--space) * 5) calc(var(--space) * 3);
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
  background-color: var(--color-border);
  background-image: ${props => props.$src ? `url(${props.$src})` : 'none'};
  background-size: cover;
  background-position: center;
  image-rendering: pixelated;
  border: 1px solid #ddd; /* light frame on white polaroid */
  margin-bottom: calc(var(--space) * 2);
`;

const LightboxText = styled.div`
  text-align: center;
  width: 100%;
  
  strong {
    display: block;
    font-size: var(--type-h2);
    margin-bottom: var(--space);
    font-weight: 700;
  }
  
  span {
    font-size: var(--type-h3);
    color: var(--color-border);
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
  ${type.bodyLg}
  font-family: 'VT323', monospace;
  padding: var(--space) calc(var(--space) * 2);
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
  background-color: var(--color-border);
  background-image: ${props => props.$src ? `url(${props.$src})` : 'none'};
  background-size: cover;
  background-position: center;
  image-rendering: pixelated;
  border: 1px solid #ddd; /* light frame on white polaroid */
  margin-bottom: var(--space);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-subtle);
  font-size: var(--type-small);
`;

const PolaroidText = styled.div`
  text-align: center;
  width: 100%;
  
  strong {
    display: block;
    font-size: var(--type-h3);
    margin-bottom: 0;
    font-weight: 700;
  }
  
  span {
    font-size: var(--type-body-lg);
    color: var(--color-text-inverse);
    display: block;
    padding: 0 5px;
  }
`;

const NoteItem = styled(EvidenceItemBase)`
  background: var(--color-note-yellow); /* Light yellow post-it */
  width: 260px;
  min-height: 180px;
  align-items: flex-start;
  font-family: 'Caveat', cursive;
  font-size: var(--type-h3);
  color: var(--color-text-inverse);
  
  strong {
      display: block;
      width: 100%;
      border-bottom: 1px dashed #990; /* unique note style */
      margin-bottom: var(--space);
      font-weight: 700;
  }
  
  @media (max-width: 768px) {
    width: 100%;
  }
`;

const SidePanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: calc(var(--space) * 2);
  width: 320px;
  flex-shrink: 0;
  z-index: 20;
`;

const ChiefWidget = styled.div`
  background: #0d1b2a;
  border: 2px solid #415a77;
  padding: var(--space);
  box-shadow: 0 4px 10px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  gap: var(--space);
  
  @media (max-width: 768px) {
    width: 100%;
    flex-shrink: 1;
    gap: var(--space);
    justify-content: center;
    min-height: 0;
    overflow: hidden;
  }
`;

const ChiefStatus = styled.div`
  display: flex;
  gap: var(--space);
  align-items: center;
  color: var(--color-officer-text);
  
  img {
    border: 2px solid var(--color-officer-border);
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
    flex-direction: row;
    text-align: left;
    align-items: center;
    gap: calc(var(--space) * 2);
    
    img {
      width: 80px;
      height: 80px;
      flex-shrink: 0;
      object-fit: cover;
    }
    
    div {
      align-items: flex-start;
    }
    
    div span:first-child {
      ${type.h3}
      color: var(--color-text-bright);
    }
    
    div span:last-child {
      ${type.bodyLg}
    }
  }
`;

const SecureLineButton = styled.button`
  background: #1b263b;
  color: #e0e1dd;
  border: 1px solid #415a77;
  padding: var(--space);
  cursor: pointer;
  font-family: inherit;
  ${type.small}
  text-transform: uppercase;
  
  &:hover:not(:disabled) {
    background: var(--color-officer-button-hover);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    padding: calc(var(--space) * 2);
    ${type.bodyLg}
    background: #253855; /* slightly lighter officer button on mobile */
  }
`;

const AccuseButton = styled.button`
  background: #700;
  color: var(--color-text-bright);
  border: 2px solid #a00;
  padding: calc(var(--space) * 2);
  font-family: inherit;
  ${type.bodyLg}
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(0,0,0,0.5);
  
  &:hover {
    background: #900;
    transform: scale(1.02);
  }
  
  @media (max-width: 768px) {
    ${type.h3}
    padding: calc(var(--space) * 3);
  }
`;

const TimelineButton = styled.button`
  background: #1b263b;
  color: #4af;
  border: 2px solid #415a77;
  padding: calc(var(--space) * 2);
  font-family: inherit;
  ${type.body}
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space);
  text-transform: uppercase;
  letter-spacing: 1px;
  
  &:hover {
    background: #253855;
    border-color: var(--color-accent-blue);
  }

  svg {
    width: 20px;
    height: 20px;
  }
  
  @media (max-width: 768px) {
    ${type.bodyLg}
    padding: calc(var(--space) * 2);
  }
`;

const BriefingWidget = styled.div`
  background: #111;
  border: 1px solid #444;
  padding: calc(var(--space) * 2);
  display: flex;
  flex-direction: column;
  gap: var(--space);
  flex: 1;
  overflow-y: auto;
  box-shadow: 0 4px 10px rgba(0,0,0,0.5);
  
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: var(--color-border); }

  h3 {
    margin: 0;
    color: var(--color-text-subtle);
    ${type.bodyLg}
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: var(--space);
  }
  
  p {
    margin: 0;
    ${type.bodyLg}
    line-height: 1.6;
    color: var(--color-text);
    font-family: 'VT323', monospace;
  }

  .tags {
    display: flex;
    gap: var(--space);
    flex-wrap: wrap;
  }
  
  @media (max-width: 768px) {
    width: 100%;
    max-height: none;
    
    h3 {
        ${type.bodyLg}
        color: var(--color-text-muted);
    }
    
    p {
        ${type.bodyLg}
        line-height: 1.6;
    }
    
    .tags {
        gap: calc(var(--space) * 2);
    }
  }
`;

const Tag = styled.span<{ $color?: string }>`
  background: #222;
  color: ${props => props.$color || '#aaa'};
  padding: 0 var(--space);
  ${type.small}
  border: 1px solid var(--color-border);
  text-transform: uppercase;
  
  @media (max-width: 768px) {
    ${type.body}
    padding: var(--space) var(--space);
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
  background: var(--color-officer-surface);
  border: 2px solid var(--color-officer-border);
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 30px var(--color-bg);
  
  @media (max-width: 768px) {
    width: 95%;
    height: 80%;
  }
`;

const ChatHeader = styled.div`
  background: #0d1b2a;
  color: #778da9;
  padding: var(--space) calc(var(--space) * 3);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-officer-border);
`;

const CloseButton = styled.button`
  background: transparent;
  color: var(--color-officer-text);
  border: none;
  ${type.bodyLg}
  cursor: pointer;
  &:hover { color: var(--color-text-bright); }
`;

const ChatLog = styled.div`
  flex: 1;
  padding: calc(var(--space) * 3);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: calc(var(--space) * 2);
`;

const OfficerBubble = styled.div<{ $sender: 'player' | 'officer' }>`
  align-self: ${props => props.$sender === 'player' ? 'flex-end' : 'flex-start'};
  max-width: 80%;
  background: ${props => props.$sender === 'player' ? 'var(--color-officer-button)' : 'var(--color-officer-bg)'};
  color: ${props => props.$sender === 'player' ? 'var(--color-officer-accent)' : 'var(--color-officer-text)'};
  padding: var(--space);
  border: 1px solid var(--color-officer-border);
  
  .name { ${type.small} margin-bottom: var(--space); opacity: 0.7; }
`;

const InputZone = styled.div`
  padding: calc(var(--space) * 2);
  border-top: 1px solid var(--color-officer-border);
  display: flex;
  gap: var(--space);
  background: var(--color-officer-bg);
`;

const ChatInput = styled.input`
  flex: 1;
  background: var(--color-officer-surface);
  border: 1px solid var(--color-officer-border);
  color: var(--color-officer-accent);
  padding: var(--space);
  font-family: inherit;
  ${type.body}
  
  &:focus { outline: none; border-color: var(--color-officer-text); }
`;

const SendButton = styled.button`
  background: var(--color-officer-button-hover);
  color: var(--color-text-bright);
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
    border-top: 1px solid #333;
    padding: 0 var(--screen-edge-horizontal);
    padding-bottom: var(--screen-edge-bottom);
    flex-shrink: 0;
  }
`;

const TabItem = styled.button<{ $active: boolean }>`
  flex: 1;
  background: transparent;
  color: ${props => props.$active ? 'var(--color-text-bright)' : 'var(--color-text-dim)'};
  border: none;
  border-top: 3px solid ${props => props.$active ? 'var(--color-accent-green)' : 'transparent'};
  padding: calc(var(--space) * 2) var(--space);
  font-family: inherit;
  ${type.bodyLg}
  font-weight: bold;
  text-transform: uppercase;
`;

const MobileContentArea = styled.div<{ $noScroll?: boolean }>`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    flex: 1;
    flex-direction: column;
    overflow-y: ${props => props.$noScroll ? 'hidden' : 'auto'};
    gap: ${props => props.$noScroll ? '0' : '15px'};
    min-height: 0; /* CRITICAL: Enables proper scrolling in flex child */
  }
`;

const CarouselCardItem = styled.div`
  scroll-snap-align: center;
  flex: 0 0 auto;
  width: auto;
  height: 100%;
  max-height: 450px;
  max-width: 280px;
  aspect-ratio: 280 / 450;
  display: flex;
  justify-content: center;
  align-items: center;
`;

// --- MOBILE ACCORDION SYSTEM ---

const AccordionContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const AccordionButton = styled.button<{ $color: string; $isOpen: boolean }>`
  background: ${props => {
    const c = props.$color;
    if (c === 'green') return 'linear-gradient(180deg, #1a2a1a 0%, #0d1a0d 100%)';
    if (c === 'orange') return 'linear-gradient(180deg, #2a1f0a 0%, #1a1200 100%)';
    return 'linear-gradient(180deg, #1b263b 0%, #0d1520 100%)';
  }};
  color: ${props => {
    const c = props.$color;
    if (c === 'green') return '#0f0';
    if (c === 'orange') return '#f90';
    return '#4af';
  }};
  border: 2px solid ${props => {
    const c = props.$color;
    if (c === 'green') return props.$isOpen ? '#0f0' : '#1a3a1a';
    if (c === 'orange') return props.$isOpen ? '#f90' : '#3a2a0a';
    return props.$isOpen ? '#4af' : '#1a3a3a';
  }};
  padding: calc(var(--space) * 2);
  font-family: inherit;
  ${type.bodyLg}
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space);
  text-transform: uppercase;
  letter-spacing: 2px;
  flex-shrink: 0;
  transition: all 0.2s;
  position: relative;
  z-index: 1;
  
  svg {
    width: 20px;
    height: 20px;
  }
`;

const AccordionChevron = styled(motion.span)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  ${type.bodyLg}
  line-height: 1;
`;

const AccordionPanel = styled.div<{ $isOpen: boolean }>`
  display: grid;
  grid-template-rows: ${props => props.$isOpen ? '1fr' : '0fr'};
  transition: grid-template-rows 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              flex-grow 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              opacity ${props => props.$isOpen ? '0.15s ease 0.3s' : '0.1s ease 0s'};
  flex: ${props => props.$isOpen ? '1' : '0'};
  min-height: 0;
  opacity: ${props => props.$isOpen ? 1 : 0};
  overflow: hidden;
`;

const AccordionPanelContent = styled.div`
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.3);
`;

const AccordionInner = styled.div`
  padding: 0;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

/* Inline timeline for mobile accordion */
const InlineTimelineWrap = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
`;

/* Inline suspect carousel for mobile accordion */
const InlineSuspectCarousel = styled.div`
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  gap: calc(var(--space) * 2);
  align-items: center;
  flex: 1;
  min-height: 0;
  height: 100%;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  user-select: none;
  -webkit-user-select: none;
  width: 100%;
  box-sizing: border-box;
  -webkit-overflow-scrolling: touch;
  /* Generous padding so first/last items can reach center.
     Using 50vw ensures consistent behavior on iOS Safari. */
  padding: 25px 50vw 25px 50vw;
  
  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
  }
`;

const InlineEvidenceWrap = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: calc(var(--space) * 2);
  
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: var(--color-border); }
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
  unreadSuspectIds?: Map<string, number>;
  initialMobileTab?: 'BOARD' | 'HQ';
  initialAccordion?: string;
  onAccordionChange?: (tab: string) => void;
  scrollToSuspectId?: string | null;
  thinkingSuspectIds?: Set<string>;
  newEvidenceTitles?: Set<string>;
  newTimelineIds?: Set<string>;
  onClearNewEvidence?: (title: string) => void;
  onClearAllNewEvidence?: () => void;
  onClearNewTimeline?: () => void;
  suspectEmotions?: Record<string, Emotion>;
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
  unreadSuspectIds = new Map(),
  initialMobileTab = 'HQ',
  initialAccordion = 'evidence',
  onAccordionChange,
  scrollToSuspectId,
  thinkingSuspectIds = new Set(),
  newEvidenceTitles = new Set(),
  newTimelineIds = new Set(),
  onClearNewEvidence,
  onClearAllNewEvidence,
  onClearNewTimeline,
  suspectEmotions = {}
}) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [lightboxEvidence, setLightboxEvidence] = useState<{ title: string; description: string; imageUrl?: string; id?: string } | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);

  const openLightbox = (item: Evidence, evidenceKey: string) => {
    setSelectedEvidenceId(evidenceKey);
    setLightboxEvidence(item);
    // Mark this evidence as seen (desktop)
    onClearNewEvidence?.(item.title);
  };

  const closeLightbox = () => {
    setSelectedEvidenceId(null);
    setLightboxEvidence(null);
  };
  const [inputVal, setInputVal] = useState('');
  const [activeMobileTab, setActiveMobileTab] = useState<'BOARD' | 'HQ'>(initialMobileTab);
  // Mobile accordion state — always one panel open, default to evidence
  const [openAccordion, setOpenAccordionLocal] = useState<string>(initialAccordion);
  const setOpenAccordion = (val: string | ((prev: string) => string)) => {
    setOpenAccordionLocal(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      onAccordionChange?.(next);
      return next;
    });
  };
  const inlineCarouselRef = useRef<HTMLDivElement>(null);
  const inlineCarouselDrag = useRef({ isDown: false, startX: 0, scrollLeft: 0 });

  const ACCORDION_ORDER = ['evidence', 'timeline', 'suspects'] as const;
  const toggleAccordion = useCallback((key: string) => {
    setOpenAccordion(prev => {
      if (prev === key) {
        // Clicking the already-open panel → advance to the next one
        const idx = ACCORDION_ORDER.indexOf(key as any);
        return ACCORDION_ORDER[(idx + 1) % ACCORDION_ORDER.length];
      }
      return key;
    });
  }, []);

  // Clear notification dots when navigating AWAY from a panel
  const prevAccordionRef = useRef(openAccordion);
  useEffect(() => {
    const prev = prevAccordionRef.current;
    prevAccordionRef.current = openAccordion;
    if (prev === openAccordion) return;
    if (prev === 'evidence') onClearAllNewEvidence?.();
    if (prev === 'timeline') onClearNewTimeline?.();
  }, [openAccordion]);
  const logRef = useRef<HTMLDivElement>(null);
  const { startTour, completeStep, currentStep } = useOnboarding();

  useEffect(() => {
    startTour(false);
  }, []);

  // Scroll to the suspect that was being interrogated when returning
  useEffect(() => {
    if (!scrollToSuspectId || openAccordion !== 'suspects') return;
    const timer = setTimeout(() => {
      const el = inlineCarouselRef.current;
      if (!el) return;
      const card = el.querySelector(`[data-suspect-id="${scrollToSuspectId}"]`) as HTMLElement;
      if (card) {
        card.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [scrollToSuspectId, openAccordion]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [officerHistory, isChatOpen]);


  // Mouse-drag scrolling for the inline accordion carousel (desktop mouse only)
  useEffect(() => {
    const el = inlineCarouselRef.current;
    if (!el || openAccordion !== 'suspects') return;

    const state = inlineCarouselDrag.current;
    const onDragStart = (e: DragEvent) => e.preventDefault();
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      state.isDown = true;
      state.startX = e.pageX;
      state.scrollLeft = el.scrollLeft;
      (state as any).didDrag = false;
      el.style.cursor = 'grabbing';
      el.style.scrollSnapType = 'none';
      el.style.scrollBehavior = 'auto';
    };
    const onMove = (e: PointerEvent) => {
      if (!state.isDown) return;
      if (Math.abs(e.pageX - state.startX) > 5) (state as any).didDrag = true;
      el.scrollLeft = state.scrollLeft - (e.pageX - state.startX) * 1.5;
    };
    const onUp = () => {
      if (!state.isDown) return;
      state.isDown = false;
      el.style.cursor = 'grab';
      requestAnimationFrame(() => {
        el.style.scrollBehavior = 'smooth';
        el.style.scrollSnapType = 'x mandatory';
      });
      setTimeout(() => { (state as any).didDrag = false; }, 0);
    };
    const onClick = (e: MouseEvent) => {
      if ((state as any).didDrag) { e.stopPropagation(); e.preventDefault(); }
    };

    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('click', onClick, { capture: true });
    return () => {
      el.removeEventListener('dragstart', onDragStart);
      el.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('click', onClick, { capture: true });
    };
  }, [openAccordion]);

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
        {/* MOBILE CONTENT RENDERER */}
        <MobileContentArea $noScroll={activeMobileTab === 'BOARD'}>
          {activeMobileTab === 'BOARD' && (
            <AccordionContainer>
              {/* EVIDENCE ACCORDION */}
              <AccordionButton
                $color="orange"
                $isOpen={openAccordion === 'evidence'}
                onClick={() => {
                  toggleAccordion('evidence');
                }}
                id="accordion-evidence"
                data-open={openAccordion === 'evidence' ? 'true' : 'false'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="18" rx="2" />
                  <path d="M2 8h20" />
                  <path d="M8 8v13" />
                </svg>
                EVIDENCE ({evidenceDiscovered.length})
                {newEvidenceTitles.size > 0 && (
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#fa0',
                    boxShadow: '0 0 6px #fa0, 0 0 12px rgba(255,170,0,0.4)',
                    animation: 'notif-pulse 1.5s ease-in-out infinite',
                    marginLeft: 6, flexShrink: 0,
                  }} />
                )}
                <AccordionChevron
                  animate={{ rotate: openAccordion === 'evidence' ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  ▾
                </AccordionChevron>
              </AccordionButton>
              <AccordionPanel $isOpen={openAccordion === 'evidence'}>
                <AccordionPanelContent>
                  <AccordionInner id="evidence-board-mobile">
                    <InlineEvidenceWrap>
                      <EvidenceGrid>
                        {[...evidenceDiscovered].sort((a, b) => {
                          const aNew = newEvidenceTitles.has(a.title) ? 0 : 1;
                          const bNew = newEvidenceTitles.has(b.title) ? 0 : 1;
                          return aNew - bNew;
                        }).map((ev, i) => (
                          <EvidenceItemBase key={ev.id || i} style={{ position: 'relative' }}>
                            {newEvidenceTitles.has(ev.title) && (
                              <span style={{
                                position: 'absolute', top: -4, right: -4, zIndex: 10,
                                width: 10, height: 10, borderRadius: '50%',
                                background: '#fa0',
                                boxShadow: '0 0 6px #fa0, 0 0 12px rgba(255,170,0,0.4)',
                                animation: 'notif-pulse 1.5s ease-in-out infinite',
                              }} />
                            )}
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
                    </InlineEvidenceWrap>
                  </AccordionInner>
                </AccordionPanelContent>
              </AccordionPanel>

              {/* TIMELINE ACCORDION */}
              <AccordionButton
                $color="blue"
                $isOpen={openAccordion === 'timeline'}
                onClick={() => {
                  toggleAccordion('timeline');
                }}
                id="accordion-timeline"
                data-open={openAccordion === 'timeline' ? 'true' : 'false'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                TIMELINE ({timelineStatements.length})
                {newTimelineIds.size > 0 && (
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#4af',
                    boxShadow: '0 0 6px #4af, 0 0 12px rgba(68,170,255,0.4)',
                    animation: 'notif-pulse 1.5s ease-in-out infinite',
                    marginLeft: 6, flexShrink: 0,
                  }} />
                )}
                <AccordionChevron
                  animate={{ rotate: openAccordion === 'timeline' ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  ▾
                </AccordionChevron>
              </AccordionButton>
              <AccordionPanel $isOpen={openAccordion === 'timeline'}>
                <AccordionPanelContent>
                  <AccordionInner id="timeline-button-mobile">
                    <InlineTimelineWrap>
                      <TimelineModal
                        statements={timelineStatements}
                        suspects={caseData.suspects}
                        onClose={() => setOpenAccordion('evidence')}
                        inline
                        newTimelineIds={newTimelineIds}
                      />
                    </InlineTimelineWrap>
                  </AccordionInner>
                </AccordionPanelContent>
              </AccordionPanel>

              {/* INTERROGATE SUSPECTS ACCORDION */}
              <AccordionButton
                $color="green"
                $isOpen={openAccordion === 'suspects'}
                onClick={() => toggleAccordion('suspects')}
                id="accordion-suspects"
                data-open={openAccordion === 'suspects' ? 'true' : 'false'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                INTERROGATE SUSPECTS ({caseData.suspects.filter(s => !s.isDeceased).length})
                <AccordionChevron
                  animate={{ rotate: openAccordion === 'suspects' ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  ▾
                </AccordionChevron>
              </AccordionButton>
              <AccordionPanel $isOpen={openAccordion === 'suspects'}>
                <AccordionPanelContent>
                  <AccordionInner>
                    <InlineSuspectCarousel
                      id="suspect-cards-container-mobile"
                      ref={inlineCarouselRef}
                      style={{ cursor: 'grab' }}
                    >
                      {caseData.suspects.map(s => (
                        <CarouselCardItem key={s.id} data-suspect-id={s.id}>
                          <SuspectCard
                            suspect={s}
                            emotion={suspectEmotions[s.id] || Emotion.NEUTRAL}
                            width="100%"
                            height="100%"
                            variant="default"
                            disableTouchRotation
                            notificationCount={unreadSuspectIds.get(s.id) || 0}
                            isLoading={thinkingSuspectIds.has(s.id)}
                            onAction={() => {
                              completeStep(OnboardingStep.SUSPECT_CARDS, true);
                              onStartInterrogation(s.id);
                            }}
                            actionLabel="INTERROGATE"
                          />
                        </CarouselCardItem>
                      ))}
                    </InlineSuspectCarousel>
                  </AccordionInner>
                </AccordionPanelContent>
              </AccordionPanel>
            </AccordionContainer>
          )}

          {activeMobileTab === 'HQ' && (
            <div style={{ padding: 'calc(var(--space) * 2)', display: 'flex', flexDirection: 'column', gap: 'calc(var(--space) * 2)', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <ChiefWidget style={{ flexShrink: 1, minHeight: 0 }}>
                <ChiefStatus>
                  <img src={officerPortrait} alt={officerName} />
                  <div>
                    <span style={{ fontWeight: 'bold' }}>{officerName.toUpperCase()}</span>
                    <span style={{ color: officerHintsRemaining > 3 ? 'var(--color-officer-text)' : '#b00' }}>
                      BATT: {officerHintsRemaining * 10}%
                    </span>
                  </div>
                </ChiefStatus>
                <SecureLineButton id="secure-line-mobile" onClick={() => setIsChatOpen(true)}>
                  [SECURE LINE]
                </SecureLineButton>
              </ChiefWidget>
              <BriefingWidget id="mission-briefing-mobile" style={{ flex: 1, minHeight: '30vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space)' }}>
                  <h3>Mission Briefing</h3>
                  <div className="tags">
                    <Tag>{caseData.type}</Tag>
                    <Tag $color={getDiffColor(caseData.difficulty)}>{caseData.difficulty}</Tag>
                  </div>
                  <p>{caseData.description}</p>
                </div>
              </BriefingWidget>
              <AccuseButton style={{ flexShrink: 0 }} onClick={() => onNavigate(ScreenState.ACCUSATION)}>
                MAKE ACCUSATION
              </AccuseButton>
            </div>
          )}
        </MobileContentArea>

        {/* MOBILE TABS - Bottom bar */}
        <MobileTabBar id="mobile-tab-bar">
          <TabItem $active={activeMobileTab === 'HQ'} onClick={() => setActiveMobileTab('HQ')}>HQ</TabItem>
          <TabItem $active={activeMobileTab === 'BOARD'} onClick={() => setActiveMobileTab('BOARD')}>BOARD</TabItem>
        </MobileTabBar>


        {/* DESKTOP LAYOUT */}
        <BoardSection>
          <MainLayout>
            <EvidenceBoard id="evidence-board">
              <h2 style={{
                marginTop: 0,
                marginBottom: 'calc(var(--space) * 3)',
                fontSize: 'var(--type-h3)',
                color: '#aaa',
                borderBottom: '1px dashed #444',
                paddingBottom: 'var(--space)',
                fontWeight: 'normal'
              }}>
                EVIDENCE BOARD: <span style={{ color: 'var(--color-text-bright)', fontWeight: 'bold' }}>{caseData.title.toUpperCase()}</span>
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
                        pointerEvents: isSelected ? 'none' : 'auto',
                        position: 'relative',
                      }}
                    >
                      {newEvidenceTitles.has(ev.title) && (
                        <span style={{
                          position: 'absolute', top: -4, right: -4, zIndex: 10,
                          width: 10, height: 10, borderRadius: '50%',
                          background: '#fa0',
                          boxShadow: '0 0 6px #fa0, 0 0 12px rgba(255,170,0,0.4)',
                          animation: 'notif-pulse 1.5s ease-in-out infinite',
                        }} />
                      )}
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
                <div id="mission-briefing" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space)' }}>
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
                    <span style={{ fontSize: 'var(--type-small)', color: officerHintsRemaining > 3 ? 'var(--color-officer-text)' : '#b00' }}>
                      BATT: {officerHintsRemaining * 10}%
                    </span>
                  </div>
                </ChiefStatus>
                <SecureLineButton id="secure-line" onClick={() => setIsChatOpen(true)}>
                  [SECURE LINE]
                </SecureLineButton>
              </ChiefWidget>

              <TimelineButton id="timeline-button" onClick={() => {
                setIsTimelineOpen(true);
              }} style={{ position: 'relative' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                TIMELINE
                {newTimelineIds.size > 0 && (
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#4af',
                    boxShadow: '0 0 6px #4af, 0 0 12px rgba(68,170,255,0.4)',
                    animation: 'notif-pulse 1.5s ease-in-out infinite',
                    marginLeft: 6, flexShrink: 0,
                  }} />
                )}
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
          thinkingSuspectIds={thinkingSuspectIds}
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
            onClose={() => { setIsTimelineOpen(false); onClearNewTimeline?.(); }}
            newTimelineIds={newTimelineIds}
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
