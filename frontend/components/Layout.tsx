
import React, { useState, useRef, useEffect } from 'react';
import SwipeableToaster from './SwipeableToaster';
import styled, { createGlobalStyle, keyframes, css } from 'styled-components';
import { ScreenState } from '../types';
import CRTOverlay from './CRTOverlay';
import { User } from 'firebase/auth';
import { cssTokens, media, type } from '../theme';

import { useOnboarding } from '../contexts/OnboardingContext';
import ExitCaseDialog from './ExitCaseDialog';
import { OnboardingTour } from './OnboardingTour';

const GlobalStyle = createGlobalStyle`
  :root {
    --font-main: 'VT323', monospace;
    
    /* CRT Screen Edge Padding — controls how far content sits from the curved CRT border */
    --screen-edge-top: 50px;
    --screen-edge-bottom: 30px;
    --screen-edge-horizontal: 80px;
    
    /* Typographic Scale */
    --type-h1: 3rem;
    --type-h2: 2rem;
    --type-h3: 1.5rem;
    --type-body-lg: 1.2rem;
    --type-body: 1rem;
    --type-small: 0.85rem;
    --type-xs: 0.75rem;

    /* Design Tokens (from theme.ts) */
    ${cssTokens}
  }

  @media (max-width: 768px) {
    :root {
      --screen-edge-top: 20px;
      --screen-edge-bottom: 10px;
      --screen-edge-horizontal: 15px;
      
      --type-h1: 2.2rem;
      --type-h2: 1.8rem;
      --type-h3: 1.5rem;
      --type-body-lg: 1.3rem; /* Larger for readability on mobile */
      --type-body: 1.15rem;
      --type-small: 0.95rem;
      --type-xs: 0.85rem;
    }
  }

  /* Large Screen / 2K+ Breakpoint */
  
  html {
    background: var(--color-bg);
  }

  body {
    background: var(--color-bg);
    color: var(--color-text);
    margin: 0;
    padding: 0;
    overflow: hidden;
    text-align: pretty;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes notif-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.3); opacity: 0.7; }
  }
  
  /* Ensure inputs and buttons use the font */
  button, input, textarea, select {
  }
  
  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
  }
  ::-webkit-scrollbar-track {
    background: var(--color-surface-raised); 
  }
  ::-webkit-scrollbar-thumb {
    background: var(--color-border); 
  }
  ::-webkit-scrollbar-thumb:hover {
    background: var(--color-border-strong); 
  }
  
  * {
    box-sizing: border-box;
  }
`;

const turnOn = keyframes`
  0% {
    transform: scale(1, 0.002);
    opacity: 0;
    filter: brightness(0);
  }
  30% {
    transform: scale(1, 0.002);
    opacity: 1;
    filter: brightness(5);
  }
  60% {
    transform: scale(1, 1);
    opacity: 1;
    filter: brightness(1.5);
  }
  100% {
    transform: scale(1, 1);
    opacity: 1;
    filter: brightness(1);
  }
`;

const turnOff = keyframes`
  0% {
    transform: scale(1, 1);
    filter: brightness(1);
    opacity: 1;
  }
  40% {
    transform: scale(1, 0.005);
    filter: brightness(2);
    opacity: 1;
  }
  70% {
    transform: scale(0.01, 0.005);
    filter: brightness(10);
    opacity: 1;
  }
  100% {
    transform: scale(0, 0);
    opacity: 0;
  }
`;

const MainContainer = styled.div`
  width: 100vw;
  height: 100vh;
  /* Use dynamic viewport height for mobile if supported */
  height: 100dvh; 
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: var(--color-bg);
  padding: calc(var(--space) * 2);
  cursor: none !important;
  
  &, & * {
    cursor: none !important;
  }
  
  @media (max-width: 768px) {
    padding: 0;
  }
`;

// The Inner Screen
const Screen = styled.div<{ $powerState: 'on' | 'off' | 'turning-on' | 'turning-off' }>`
  width: 100%;
  height: 100%;
  background-color: var(--color-bg);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transform-origin: center center;

  /* Apply animations to the whole screen container so it masks the content + overlay */
  ${props => props.$powerState === 'turning-on' && css`
    animation: ${turnOn} 1.2s cubic-bezier(0.23, 1, 0.32, 1) forwards;
  `}

  ${props => props.$powerState === 'turning-off' && css`
    animation: ${turnOff} 0.5s ease-out forwards;
  `}

  ${props => props.$powerState === 'off' && css`
    opacity: 0;
    transform: scale(0);
  `}
  
  /* Subtle generic distortion for DOM elements */
  &::after {
    content: " ";
    display: block;
    position: absolute;
    top: 0; left: 0; bottom: 0; right: 0;
    background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
    z-index: 2;
    background-size: 100% 2px, 3px 100%;
    pointer-events: none;
  }
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  padding: var(--screen-edge-top) var(--screen-edge-horizontal) 10px var(--screen-edge-horizontal);
  ${type.bodyLg}
  border-bottom: 2px solid var(--color-border);
  background: #0f0f0f;
  z-index: 101;
  min-height: 70px;
  position: relative;
  justify-content: space-between;

  @media (max-width: 768px) {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    grid-template-rows: 1fr;
    align-items: center;
    padding: var(--screen-edge-top) var(--screen-edge-horizontal) 10px var(--screen-edge-horizontal);
    min-height: 60px;
  }
`;

const TitleContainer = styled.div<{ $marquee?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: 50%;
  
  @media (max-width: 768px) {
    position: static;
    transform: none;
    width: auto;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    grid-column: 2;
    grid-row: 1;
    
    ${props => props.$marquee && css`
      -webkit-mask-image: linear-gradient(to right, transparent, black 10px, black calc(100% - 10px), transparent);
      mask-image: linear-gradient(to right, transparent, black 10px, black calc(100% - 10px), transparent);
    `}
  }
`;

const Title = styled.h1`
  margin: 0;
  ${type.h3}
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--color-text-bright);
  text-shadow: 0 0 5px var(--color-text-bright);
  line-height: 1.1;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  
  @media (max-width: 768px) {
    ${type.h3}
  }
`;

const SubTitle = styled.div`
  ${type.small}
  color: var(--color-text-disabled);
  letter-spacing: 1px;
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const NavButton = styled.button`
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  font-family: inherit;
  ${type.bodyLg}
  cursor: pointer;
  padding: 0;
  transition: color 0.2s;
  text-transform: uppercase;
  text-align: left;
  
  &:hover {
    color: var(--color-text-bright);
    text-shadow: 0 0 5px var(--color-text-bright);
  }

  &[disabled] {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    ${type.h3}
    padding: 10px 0;
    width: 100%;
    text-align: left;
    border-bottom: 1px solid var(--color-border-subtle);
    color: var(--color-text);
  }
`;

const UploadButton = styled(NavButton)`
  color: var(--color-accent-cyan); 
  border: 1px solid #044; /* subtle cyan border */
  background: rgba(0, 100, 100, 0.1);
  margin-right: calc(var(--space) * 2);

  &:hover {
    background: rgba(0, 255, 255, 0.2);
    color: var(--color-text-bright);
    border-color: var(--color-accent-cyan);
    box-shadow: 0 0 10px var(--color-accent-cyan);
  }
  
  @media (max-width: 768px) {
    border: none;
    background: transparent;
    margin: 0;
    color: var(--color-accent-cyan); 
  }
`;

const ScreenContent = styled.div`
  flex: 1;
  position: relative;
  overflow-y: auto;
`;

const ContentInset = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1;
`;

const NavGroup = styled.div`
  display: flex; 
  gap: calc(var(--space) * 3); 
  min-width: 200px; 
  align-items: center;
  
  @media (max-width: 768px) {
    min-width: auto;
    gap: var(--space);
    grid-column: 1;
    grid-row: 1;
    justify-self: start;
  }
`;

const HamburgerButton = styled.button<{ $visible?: boolean }>`
  display: ${props => props.$visible ? 'flex' : 'none'};
  background: transparent;
  border: none;
  color: var(--color-accent-green);
  font-family: inherit;
  ${type.bodyLg}
  font-weight: bold;
  cursor: pointer;
  padding: 0;
  z-index: 20;
  text-transform: uppercase;
  flex-shrink: 0;
  align-items: center;
  
  &:hover {
    color: var(--color-text-bright);
    text-shadow: 0 0 5px var(--color-accent-green);
  }
  
  @media (max-width: 768px) {
    display: flex;
  }
`;

const MobileActionButton = styled.button<{ $active?: boolean }>`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    background: transparent;
    color: var(--color-accent-green);
    border: none;
    font-family: inherit;
    ${type.bodyLg}
    font-weight: bold;
    text-transform: uppercase;
    cursor: pointer;
    z-index: 20;
    align-items: center;
    flex-shrink: 0;
    grid-column: 3;
    grid-row: 1;
    justify-self: end;
    
    &:hover {
      color: var(--color-text-bright);
      text-shadow: 0 0 5px var(--color-accent-green);
    }
  }
`;

const SlideMenu = styled.div<{ $isOpen: boolean }>`
  position: absolute;
  top: calc(var(--screen-edge-top) + 30px);
  left: 0;
  width: 400px;
  height: calc(100% - 80px);
  background: var(--color-surface);
  border-right: 2px solid var(--color-accent-green);
  display: flex;
  flex-direction: column;
  padding: calc(var(--space) * 3);
  padding-left: calc(var(--screen-edge-horizontal) + 2px);
  padding-bottom: var(--screen-edge-bottom);
  gap: var(--space);
  z-index: 100;
  transform: ${props => props.$isOpen ? 'translateX(0)' : 'translateX(-110%)'};
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  overflow-y: auto;

  /* Force all buttons left-aligned and full-width in menu */
  button {
    text-align: left;
    width: 100%;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border-subtle);
  }

  ${UploadButton} {
    margin-right: 0;
    border: none;
    background: transparent;
    border-bottom: 1px solid var(--color-border-subtle);
  }

  @media (max-width: 768px) {
    top: 60px;
    width: 100%;
    height: auto;
    max-height: calc(100% - 60px);
    border-right: none;
    border-bottom: 2px solid var(--color-accent-green);
    padding-left: var(--screen-edge-horizontal);
    padding-right: var(--screen-edge-horizontal);
    transform: ${props => props.$isOpen ? 'translateY(0)' : 'translateY(calc(-100% - 60px))'};
    box-shadow: ${props => props.$isOpen ? '0 10px 30px rgba(0,0,0,0.9)' : 'none'};
  }
`;

const SlideMenuBackdrop = styled.div<{ $isOpen: boolean }>`
  position: absolute;
  top: 70px;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 99;
  opacity: ${props => props.$isOpen ? 1 : 0};
  pointer-events: ${props => props.$isOpen ? 'auto' : 'none'};
  transition: opacity 0.3s;

  @media (max-width: 768px) {
    top: 60px;
  }
`;

const UserInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: auto;
  flex-shrink: 0;

  @media (max-width: 768px) {
    position: absolute;
    right: 15px;
    top: 50%;
    transform: translateY(-50%);
  }
`;

/* ─── Layout Inline-Style Replacements ─── */

const NavGroupLeft = styled(NavGroup)`
  justify-content: flex-start;
  min-width: auto;
`;

const NavGroupRight = styled(NavGroup)`
  justify-content: flex-end;
  min-width: auto;
  position: absolute;
  right: var(--screen-edge-horizontal);
`;

const UnsavedBadge = styled.span`
  color: var(--color-accent-orange);
  ${type.xs}
  text-transform: uppercase;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: var(--space);
`;

const UnsavedDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-accent-orange);
  display: inline-block;
`;

const AccentNavButton = styled(NavButton) <{ $accentColor?: string }>`
  color: ${props => props.$accentColor || 'var(--color-accent-green)'};
  ${props => props.$accentColor === 'var(--color-accent-green)' ? 'font-weight: bold;' : ''}
`;

const VolumeRow = styled.div`
  display: flex;
  align-items: center;
  gap: calc(var(--space) * 1.25);
  padding: 4px 0 var(--space) 0;
  border-bottom: 1px solid var(--color-border-subtle);
`;

const VolumeLabel = styled.span`
  color: var(--color-text-disabled);
  ${type.small}
  min-width: 50px;
`;

const VolumeSlider = styled.input`
  flex: 1;
  height: 4px;
  appearance: none;
  background: var(--color-border);
  outline: none;
  accent-color: var(--color-accent-green);
`;

const VolumeValue = styled.span`
  color: var(--color-text-disabled);
  ${type.small}
  min-width: 30px;
  text-align: right;
`;

const MenuDivider = styled.div`
  border-top: 1px solid var(--color-border-subtle);
  padding-top: calc(var(--space) * 1.25);
  margin-top: calc(var(--space) * 1.25);
`;

const MenuSectionLabel = styled.div`
  color: var(--color-text-subtle);
  ${type.xs}
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: calc(var(--space) * 0.625);
`;

const UserSection = styled.div`
  border-top: 1px solid var(--color-border-subtle);
  padding-top: calc(var(--space) * 1.25);
  margin-top: auto;
`;

const UserName = styled.div`
  color: var(--color-accent-green);
  ${type.small}
  margin-bottom: calc(var(--space) * 0.625);
`;

const MenuUnsavedBadge = styled.div`
  color: var(--color-accent-orange);
  ${type.small}
  text-transform: uppercase;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: var(--space);
  padding: 5px 0;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--space);
`;

const MobileActionPlaceholder = styled(MobileActionButton).attrs({ as: 'div' as const })`
  pointer-events: none;
  visibility: hidden;
`;

const MobileUnsavedAction = styled(MobileActionButton).attrs({ as: 'div' as const })`
  pointer-events: none;
`;

const MarqueeWrapper = styled.div<{ $width?: number }>`
  width: ${props => props.$width && props.$width > 0 ? props.$width + 'px' : '100%'};
  overflow: hidden;
`;

const MarqueeSpan = styled.span<{ $animName?: string }>`
  display: inline-block;
  white-space: nowrap;
  ${type.h3}
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--color-text-bright);
  text-shadow: 0 0 5px var(--color-text-bright);
  line-height: 1.1;
  font-family: inherit;
  padding: 0 calc(var(--space) * 1.25);
  animation: ${props => props.$animName ? `${props.$animName} 8s ease-in-out infinite alternate` : 'none'};
`;

const HiddenTitle = styled(Title)`
  position: absolute;
  visibility: hidden;
  pointer-events: none;
`;

interface LayoutProps {
  children: React.ReactNode;
  screenState: ScreenState;
  caseTitle?: string;
  onNavigate: (screen: ScreenState) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onPublish?: () => void;
  canPublish?: boolean;
  isPublishing?: boolean;
  onEdit?: () => void;
  canEdit?: boolean;
  isBooting?: boolean;
  powerState?: 'on' | 'off' | 'turning-on' | 'turning-off';
  mobileAction?: {
    label: string;
    onClick: () => void;
    active?: boolean;
  };
  user?: User | null;
  onLogout?: () => void;
  hasUnsavedChanges?: boolean;
  onSaveCase?: () => void;
  onCloseCase?: () => void;
  onCheckConsistency?: () => void;
  onTestInvestigation?: () => void;
  volume?: number;
  onVolumeChange?: (v: number) => void;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  screenState,
  caseTitle,
  onNavigate,
  isMuted,
  onToggleMute,
  onPublish,
  canPublish,
  isPublishing,
  onEdit,
  canEdit,
  isBooting,
  powerState = 'on',
  mobileAction,
  user,
  onLogout,
  hasUnsavedChanges,
  onSaveCase,
  onCloseCase,
  onCheckConsistency,
  onTestInvestigation,
  volume = 0.7,
  onVolumeChange
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const { startTour } = useOnboarding();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const marqueeSpanRef = useRef<HTMLSpanElement>(null);
  const [isTitleOverflowing, setIsTitleOverflowing] = useState(false);
  const [marqueeWidth, setMarqueeWidth] = useState(0);
  const [marqueeAnimName, setMarqueeAnimName] = useState('');
  const marqueeStyleRef = useRef<HTMLStyleElement | null>(null);

  // Phase 1: Detect overflow. Title stays in original layout for reliable measurement.
  useEffect(() => {
    setIsTitleOverflowing(false);
    setMarqueeAnimName('');
    if (marqueeStyleRef.current) {
      marqueeStyleRef.current.remove();
      marqueeStyleRef.current = null;
    }

    const el = titleRef.current;
    if (!el) return;

    const timer = setTimeout(() => {
      requestAnimationFrame(() => {
        if (window.innerWidth > 768) return;
        if (el.scrollWidth > el.clientWidth + 2) {
          setMarqueeWidth(el.clientWidth);
          setIsTitleOverflowing(true);
        }
      });
    }, 200);

    return () => {
      clearTimeout(timer);
      if (marqueeStyleRef.current) {
        marqueeStyleRef.current.remove();
        marqueeStyleRef.current = null;
      }
    };
  }, [caseTitle, screenState, mobileAction]);

  // Phase 2: After the animated span renders, measure it and create the keyframe.
  useEffect(() => {
    if (!isTitleOverflowing) return;

    const timer = setTimeout(() => {
      requestAnimationFrame(() => {
        const span = marqueeSpanRef.current;
        const wrapper = span?.parentElement;
        if (!span || !wrapper) return;

        // Real measurement: span width vs wrapper width
        const scrollDist = span.offsetWidth - wrapper.clientWidth;
        if (scrollDist <= 0) return;

        // Clean up any previous keyframe
        if (marqueeStyleRef.current) {
          marqueeStyleRef.current.remove();
        }

        const name = `mq_${Date.now()}`;
        const style = document.createElement('style');
        style.textContent = `@keyframes ${name}{0%,15%{transform:translateX(0)}85%,100%{transform:translateX(-${scrollDist}px)}}`;
        document.head.appendChild(style);
        marqueeStyleRef.current = style;
        setMarqueeAnimName(name);
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [isTitleOverflowing, caseTitle]);

  // Logic to determine if we are in "Gameplay" mode
  const isGameplay =
    screenState === ScreenState.CASE_HUB ||
    screenState === ScreenState.INTERROGATION ||
    screenState === ScreenState.ACCUSATION ||
    screenState === ScreenState.ENDGAME;

  const isCaseReview = screenState === ScreenState.CASE_REVIEW;

  const toggleMenu = () => setMenuOpen(!menuOpen);
  const handleMenuNav = (action: () => void) => {
    action();
    setMenuOpen(false);
  };

  const handleExitCase = () => {
    setShowExitDialog(false);
    onNavigate(ScreenState.CASE_SELECTION);
  };

  return (
    <>
      <GlobalStyle />
      <MainContainer data-monitor>
        <Screen $powerState={powerState}>
          <CRTOverlay />
          <OnboardingTour />
          <ContentInset>
            {!isBooting && (
              <>
                <TopBar>
                  {/* LEFT SIDE — hamburger or case-review desktop buttons */}
                  <NavGroupLeft>
                    {/* Desktop CaseReview: show Close + Check Consistency inline */}
                    {isCaseReview ? (
                      <>
                        <HamburgerButton
                          id="hamburger-button"
                          $visible
                          onClick={() => {
                            const isMobile = window.innerWidth <= 768;
                            if (isMobile) {
                              toggleMenu();
                            } else if (onCloseCase) {
                              onCloseCase();
                            }
                          }}
                        >
                          {(() => {
                            const isMobileCheck = typeof window !== 'undefined' && window.innerWidth <= 768;
                            if (isMobileCheck) return menuOpen ? '[X]' : '[Menu]';
                            return '[Close Case]';
                          })()}
                        </HamburgerButton>
                        {onCheckConsistency && (
                          <NavButton className="hide-on-mobile" onClick={onCheckConsistency}>[Check Consistency]</NavButton>
                        )}
                      </>
                    ) : screenState !== ScreenState.ACCUSATION ? (
                      <HamburgerButton
                        id="hamburger-button"
                        $visible
                        onClick={() => {
                          const isMobile = window.innerWidth <= 768;
                          if (isMobile && screenState === ScreenState.INTERROGATION) {
                            onNavigate(ScreenState.CASE_HUB);
                          } else {
                            toggleMenu();
                          }
                        }}
                      >
                        {(() => {
                          const isMobileCheck = typeof window !== 'undefined' && window.innerWidth <= 768;
                          if (isMobileCheck && screenState === ScreenState.INTERROGATION) return '[Back]';
                          return menuOpen ? '[X]' : '[Menu]';
                        })()}
                      </HamburgerButton>
                    ) : null}
                  </NavGroupLeft>

                  {/* MOBILE CUSTOM ACTION — always occupy grid-column 3 for consistent title width */}
                  {mobileAction ? (
                    <MobileActionButton id="mobile-action-button" onClick={mobileAction.onClick} $active={mobileAction.active}>
                      [{mobileAction.label}]
                    </MobileActionButton>
                  ) : isCaseReview && hasUnsavedChanges ? (
                    <MobileUnsavedAction>
                      <UnsavedBadge>
                        <UnsavedDot />
                        UNSAVED
                      </UnsavedBadge>
                    </MobileUnsavedAction>
                  ) : (
                    <MobileActionPlaceholder>
                      [_]
                    </MobileActionPlaceholder>
                  )}

                  {/* CENTER TITLE */}
                  <TitleContainer $marquee={isTitleOverflowing}>
                    {isTitleOverflowing ? (
                      <HiddenTitle ref={titleRef} title={caseTitle || 'DetectiveML'}>
                        {caseTitle || 'DetectiveML'}
                      </HiddenTitle>
                    ) : (
                      <Title ref={titleRef} title={caseTitle || 'DetectiveML'}>
                        {caseTitle || 'DetectiveML'}
                      </Title>
                    )}
                    {isTitleOverflowing && (
                      <MarqueeWrapper $width={marqueeWidth}>
                        <MarqueeSpan ref={marqueeSpanRef} $animName={marqueeAnimName || undefined}>
                          {caseTitle || 'DetectiveML'}
                        </MarqueeSpan>
                      </MarqueeWrapper>
                    )}
                    <SubTitle>v1.0.0 // SYSTEM READY</SubTitle>
                  </TitleContainer>

                  {/* RIGHT — always-visible key items */}
                  <NavGroupRight className="hide-on-mobile">
                    {hasUnsavedChanges && (
                      <UnsavedBadge>
                        <UnsavedDot />
                        UNSAVED
                      </UnsavedBadge>
                    )}
                    {isGameplay && screenState !== ScreenState.ENDGAME && screenState !== ScreenState.ACCUSATION && (
                      <NavButton id="hub-button" className="hide-on-mobile" onClick={() => onNavigate(ScreenState.CASE_HUB)}>[Case Hub]</NavButton>
                    )}
                    {/* Desktop CaseReview: Case Hub + Save on right */}
                    {isCaseReview && (
                      <>
                        {onTestInvestigation && (
                          <AccentNavButton className="hide-on-mobile" onClick={onTestInvestigation}>[Play Case]</AccentNavButton>
                        )}
                        {onSaveCase && (
                          <AccentNavButton className="hide-on-mobile" onClick={onSaveCase} $accentColor="var(--color-accent-green)">[Save]</AccentNavButton>
                        )}
                      </>
                    )}
                  </NavGroupRight>
                </TopBar>

                {/* SLIDE-OUT MENU */}
                <SlideMenuBackdrop $isOpen={menuOpen} onClick={() => setMenuOpen(false)} />
                <SlideMenu $isOpen={menuOpen}>
                  {hasUnsavedChanges && (
                    <>
                      <MenuUnsavedBadge>
                        <UnsavedDot />
                        UNSAVED CHANGES
                      </MenuUnsavedBadge>
                      {onSaveCase && !isCaseReview && (
                        <AccentNavButton onClick={() => handleMenuNav(onSaveCase)} $accentColor="var(--color-accent-green)">[Save Case]</AccentNavButton>
                      )}
                    </>
                  )}

                  <AccentNavButton onClick={onToggleMute} $accentColor={isMuted ? 'var(--color-text-dim)' : 'var(--color-accent-green)'}>
                    {isMuted ? '[Sound: OFF]' : '[Sound: ON]'}
                  </AccentNavButton>

                  {!isMuted && onVolumeChange && (
                    <VolumeRow>
                      <VolumeLabel>VOL</VolumeLabel>
                      <VolumeSlider
                        type="range"
                        min="0" max="1" step="0.05"
                        value={volume}
                        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                        data-cursor="pointer"
                      />
                      <VolumeValue>
                        {Math.round(volume * 100)}%
                      </VolumeValue>
                    </VolumeRow>
                  )}

                  {screenState === ScreenState.CASE_HUB && (
                    <AccentNavButton onClick={() => handleMenuNav(startTour)}>
                      [Tutorial]
                    </AccentNavButton>
                  )}

                  {canEdit && (
                    <AccentNavButton onClick={() => handleMenuNav(onEdit!)} $accentColor="var(--color-accent-gold)">
                      [Edit Case]
                    </AccentNavButton>
                  )}

                  {canPublish && (
                    <UploadButton onClick={() => handleMenuNav(onPublish!)} disabled={isPublishing}>
                      {isPublishing ? 'Publishing...' : '[Publish to Network]'}
                    </UploadButton>
                  )}

                  {isGameplay && (
                    <AccentNavButton onClick={() => handleMenuNav(() => setShowExitDialog(true))} $accentColor="var(--color-accent-red-bright)">
                      [Exit Case]
                    </AccentNavButton>
                  )}

                  {isCaseReview && (
                    <>
                      <MenuDivider>
                        <MenuSectionLabel>Case Editor</MenuSectionLabel>
                      </MenuDivider>
                      {onTestInvestigation && (
                        <AccentNavButton onClick={() => handleMenuNav(onTestInvestigation)} $accentColor="var(--color-accent-green)">
                          [Play Case]
                        </AccentNavButton>
                      )}
                      {onSaveCase && (
                        <AccentNavButton onClick={() => handleMenuNav(onSaveCase)} $accentColor="var(--color-accent-green)">
                          [Save]
                        </AccentNavButton>
                      )}
                      {onCheckConsistency && (
                        <NavButton onClick={() => handleMenuNav(onCheckConsistency)}>
                          [Check Consistency]
                        </NavButton>
                      )}
                      {onCloseCase && (
                        <AccentNavButton onClick={() => handleMenuNav(onCloseCase)} $accentColor="var(--color-accent-red-bright)">
                          [Close]
                        </AccentNavButton>
                      )}
                    </>
                  )}

                  {user && (
                    <UserSection>
                      <UserName>User: {user.displayName}</UserName>
                      <NavButton onClick={onLogout}>[Logout]</NavButton>
                    </UserSection>
                  )}
                </SlideMenu>
              </>
            )}

            {showExitDialog && (
              <ExitCaseDialog
                onConfirm={handleExitCase}
                onCancel={() => setShowExitDialog(false)}
              />
            )}

            <ScreenContent>
              {children}
            </ScreenContent>

            <SwipeableToaster />

          </ContentInset>
        </Screen>
      </MainContainer>
    </>
  );
};

export default Layout;
