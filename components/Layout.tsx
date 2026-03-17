
import React, { useState, useRef, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import styled, { createGlobalStyle, keyframes, css } from 'styled-components';
import { ScreenState } from '../types';
import CRTOverlay from './CRTOverlay';
import { User } from 'firebase/auth';

import { useOnboarding } from '../contexts/OnboardingContext';
import ExitCaseDialog from './ExitCaseDialog';

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
    }
  }

  /* Large Screen / 2K+ Breakpoint */
  
  html {
    background: #000;
  }

  body {
    background: #000;
    color: #e0e0e0;
    margin: 0;
    padding: 0;
    font-family: var(--font-main);
    overflow: hidden;
  }
  
  /* Ensure inputs and buttons use the font */
  button, input, textarea, select {
    font-family: var(--font-main);
  }
  
  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
  }
  ::-webkit-scrollbar-track {
    background: #111; 
  }
  ::-webkit-scrollbar-thumb {
    background: #333; 
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #555; 
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
  background: #000;
  padding: 15px;
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
  background-color: #000;
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
  font-size: var(--type-body-lg);
  border-bottom: 2px solid #333;
  background: #0f0f0f;
  z-index: 5;
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
      -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
      mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
    `}
  }
`;

const Title = styled.h1<{ $marquee?: boolean }>`
  margin: 0;
  font-size: var(--type-h3);
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #fff;
  text-shadow: 0 0 5px #fff;
  line-height: 1.1;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  
  @media (max-width: 768px) {
    font-size: 1.4rem;
    
    ${props => props.$marquee && css`
      overflow: visible;
      text-overflow: clip;
      text-align: left;
      width: auto;
      display: inline-block;
      padding: 0 10px 0 20px;
    `}
  }
`;

const SubTitle = styled.div`
  font-size: var(--type-small);
  color: #555;
  letter-spacing: 1px;
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const NavButton = styled.button`
  background: transparent;
  border: none;
  color: #aaa;
  font-family: inherit;
  font-size: var(--type-body-lg);
  cursor: pointer;
  padding: 0 10px;
  transition: color 0.2s;
  text-transform: uppercase;
  text-align: left;
  
  &:hover {
    color: #fff;
    text-shadow: 0 0 5px #fff;
  }

  &[disabled] {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    font-size: 1.4rem;
    padding: 10px 0;
    width: 100%;
    text-align: left;
    border-bottom: 1px solid #222;
    color: #ccc;
  }
`;

const UploadButton = styled(NavButton)`
  color: #0ff; 
  border: 1px solid #044; 
  border-radius: 4px;
  background: rgba(0, 100, 100, 0.1);
  margin-right: 15px;

  &:hover {
    background: rgba(0, 255, 255, 0.2);
    color: #fff;
    border-color: #0ff;
    box-shadow: 0 0 10px #0ff;
  }
  
  @media (max-width: 768px) {
    border: none;
    background: transparent;
    margin: 0;
    color: #0ff; 
  }
`;

const ScreenContent = styled.div`
  flex: 1;
  position: relative;
  z-index: 10;
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
  gap: 20px; 
  min-width: 200px; 
  align-items: center;
  
  @media (max-width: 768px) {
    min-width: auto;
    gap: 10px;
    grid-column: 1;
    grid-row: 1;
    justify-self: start;
  }
`;

const HamburgerButton = styled.button<{ $visible?: boolean }>`
  display: ${props => props.$visible ? 'flex' : 'none'};
  background: transparent;
  border: none;
  color: #0f0;
  font-family: inherit;
  font-size: var(--type-body-lg);
  font-weight: bold;
  cursor: pointer;
  z-index: 20;
  text-transform: uppercase;
  flex-shrink: 0;
  padding: 0 10px;
  align-items: center;
  
  &:hover {
    color: #fff;
    text-shadow: 0 0 5px #0f0;
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
    color: #0f0;
    border: none;
    padding: 0 10px;
    font-family: inherit;
    font-size: var(--type-body-lg);
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
      color: #fff;
      text-shadow: 0 0 5px #0f0;
    }
  }
`;

const SlideMenu = styled.div<{ $isOpen: boolean }>`
  position: absolute;
  top: calc(var(--screen-edge-top) + 30px);
  left: 0;
  width: 400px;
  height: calc(100% - 80px);
  background: #0a0a0a;
  border-right: 2px solid #0f0;
  display: flex;
  flex-direction: column;
  padding: 20px;
  padding-left: calc(var(--screen-edge-horizontal) + 10px);
  padding-bottom: var(--screen-edge-bottom);
  gap: 10px;
  z-index: 100;
  transform: ${props => props.$isOpen ? 'translateX(0)' : 'translateX(-110%)'};
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  overflow-y: auto;

  /* Force all buttons left-aligned and full-width in menu */
  button {
    text-align: left;
    width: 100%;
    padding: 8px 0;
    border-bottom: 1px solid #1a1a1a;
  }

  ${UploadButton} {
    margin-right: 0;
    border: none;
    background: transparent;
    border-bottom: 1px solid #1a1a1a;
    border-radius: 0;
  }

  @media (max-width: 768px) {
    top: 60px;
    width: 100%;
    height: auto;
    max-height: calc(100% - 60px);
    border-right: none;
    border-bottom: 2px solid #0f0;
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
  const [isTitleOverflowing, setIsTitleOverflowing] = useState(false);
  const marqueeStyleRef = useRef<HTMLStyleElement | null>(null);
  const [marqueeAnimName, setMarqueeAnimName] = useState('');

  // Detect title overflow and create marquee animation
  useEffect(() => {
    // Reset so React re-renders with non-marquee styles
    setIsTitleOverflowing(false);
    setMarqueeAnimName('');
    if (marqueeStyleRef.current) {
      marqueeStyleRef.current.remove();
      marqueeStyleRef.current = null;
    }

    const el = titleRef.current;
    if (!el) return;

    // Wait for React re-render + double-rAF for iOS Safari layout
    const timer = setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (window.innerWidth > 768 || !el.parentElement) return;

          // Check if text overflows: el has width:100% + overflow:hidden in non-marquee state
          // Temporarily left-align for accurate scrollWidth
          el.style.textAlign = 'left';
          const overflows = el.scrollWidth > el.clientWidth + 2;
          el.style.textAlign = '';

          if (!overflows) return;

          setIsTitleOverflowing(true);

          // Use calc(containerWidth - 100%) in translateX
          // 100% in translateX = the element's own rendered width (inline-block)
          // So translateX(calc(Cpx - 100%)) positions the right edge at the container's right edge
          const cw = el.parentElement.clientWidth;
          const animName = `marquee_${Date.now()}`;
          const styleEl = document.createElement('style');
          styleEl.textContent = `@keyframes ${animName}{0%,20%{transform:translateX(0)}80%,100%{transform:translateX(calc(${cw}px - 100%))}}`;
          document.head.appendChild(styleEl);
          marqueeStyleRef.current = styleEl;
          setMarqueeAnimName(animName);
        });
      });
    }, 300);

    return () => {
      clearTimeout(timer);
      if (marqueeStyleRef.current) {
        marqueeStyleRef.current.remove();
        marqueeStyleRef.current = null;
      }
    };
  }, [caseTitle, screenState, mobileAction]);

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
          <ContentInset>
            {!isBooting && (
              <>
                <TopBar>
                  {/* LEFT SIDE — hamburger or case-review desktop buttons */}
                  <NavGroup style={{ justifyContent: 'flex-start', minWidth: 'auto' }}>
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
                    ) : (
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
                    )}
                  </NavGroup>

                  {/* MOBILE CUSTOM ACTION */}
                  {mobileAction && (
                    <MobileActionButton id="mobile-action-button" onClick={mobileAction.onClick} $active={mobileAction.active}>
                      [{mobileAction.label}]
                    </MobileActionButton>
                  )}

                  {/* CENTER TITLE */}
                  <TitleContainer $marquee={isTitleOverflowing}>
                    <Title
                      ref={titleRef}
                      $marquee={isTitleOverflowing}
                      title={caseTitle || 'DetectiveML'}
                      style={marqueeAnimName ? { animation: `${marqueeAnimName} 6s ease-in-out infinite alternate` } : undefined}
                    >
                      {caseTitle || 'DetectiveML'}
                    </Title>
                    <SubTitle>v1.0.0 // SYSTEM READY</SubTitle>
                  </TitleContainer>

                  {/* RIGHT — always-visible key items */}
                  <NavGroup className="hide-on-mobile" style={{ justifyContent: 'flex-end', minWidth: 'auto', position: 'absolute', right: 'var(--screen-edge-horizontal)' }}>
                    {hasUnsavedChanges && (
                      <span style={{
                        color: '#fa0', fontSize: '0.75rem',
                        textTransform: 'uppercase', letterSpacing: '1px',
                        display: 'flex', alignItems: 'center', gap: '5px',
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fa0', display: 'inline-block' }} />
                        UNSAVED
                      </span>
                    )}
                    {isGameplay && screenState !== ScreenState.ENDGAME && (
                      <NavButton id="hub-button" className="hide-on-mobile" onClick={() => onNavigate(ScreenState.CASE_HUB)}>[Case Hub]</NavButton>
                    )}
                    {/* Desktop CaseReview: Case Hub + Save on right */}
                    {isCaseReview && (
                      <>
                        {onTestInvestigation && (
                          <NavButton className="hide-on-mobile" onClick={onTestInvestigation} style={{ color: '#0f0' }}>[Play Case]</NavButton>
                        )}
                        {onSaveCase && (
                          <NavButton className="hide-on-mobile" onClick={onSaveCase} style={{ color: '#0f0', fontWeight: 'bold' }}>[Save]</NavButton>
                        )}
                      </>
                    )}
                  </NavGroup>
                </TopBar>

                {/* SLIDE-OUT MENU */}
                <SlideMenuBackdrop $isOpen={menuOpen} onClick={() => setMenuOpen(false)} />
                <SlideMenu $isOpen={menuOpen}>
                  {hasUnsavedChanges && (
                    <>
                      <div style={{
                        color: '#fa0', fontSize: '0.9rem',
                        textTransform: 'uppercase', letterSpacing: '1px',
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: '5px 0', borderBottom: '1px solid #333', marginBottom: '5px'
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fa0', display: 'inline-block' }} />
                        UNSAVED CHANGES
                      </div>
                      {onSaveCase && !isCaseReview && (
                        <NavButton onClick={() => handleMenuNav(onSaveCase)} style={{ color: '#0f0', fontWeight: 'bold' }}>[Save Case]</NavButton>
                      )}
                    </>
                  )}

                  {isGameplay && screenState !== ScreenState.ENDGAME && (
                    <NavButton id="hub-button-mobile" className="hide-on-desktop" onClick={() => handleMenuNav(() => onNavigate(ScreenState.CASE_HUB))}>
                      [Return to Case Hub]
                    </NavButton>
                  )}

                  <NavButton onClick={onToggleMute} style={{ color: isMuted ? '#777' : '#0f0' }}>
                    {isMuted ? '[Sound: OFF]' : '[Sound: ON]'}
                  </NavButton>

                  {!isMuted && onVolumeChange && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '4px 0 8px 0', borderBottom: '1px solid #1a1a1a'
                    }}>
                      <span style={{ color: '#555', fontSize: '0.8rem', minWidth: '50px' }}>VOL</span>
                      <input
                        type="range"
                        min="0" max="1" step="0.05"
                        value={volume}
                        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                        data-cursor="pointer"
                        style={{
                          flex: 1, height: '4px', appearance: 'none', background: '#333',
                          outline: 'none', accentColor: '#0f0'
                        }}
                      />
                      <span style={{ color: '#555', fontSize: '0.8rem', minWidth: '30px', textAlign: 'right' }}>
                        {Math.round(volume * 100)}%
                      </span>
                    </div>
                  )}

                  {screenState === ScreenState.CASE_HUB && (
                    <NavButton onClick={() => handleMenuNav(startTour)} style={{ color: '#0f0' }}>
                      [Tutorial]
                    </NavButton>
                  )}

                  {canEdit && (
                    <NavButton onClick={() => handleMenuNav(onEdit!)} style={{ color: '#eb0' }}>
                      [Edit Case]
                    </NavButton>
                  )}

                  {canPublish && (
                    <UploadButton onClick={() => handleMenuNav(onPublish!)} disabled={isPublishing}>
                      {isPublishing ? 'Publishing...' : '[Publish to Network]'}
                    </UploadButton>
                  )}

                  {isGameplay && (
                    <NavButton onClick={() => handleMenuNav(() => setShowExitDialog(true))} style={{ color: '#f55' }}>
                      [Exit Game]
                    </NavButton>
                  )}

                  {isCaseReview && (
                    <>
                      <div style={{ borderTop: '1px solid #222', paddingTop: '10px', marginTop: '10px' }}>
                        <div style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>Case Editor</div>
                      </div>
                      {onSaveCase && (
                        <NavButton onClick={() => handleMenuNav(onSaveCase)} style={{ color: '#0f0' }}>
                          [Save]
                        </NavButton>
                      )}
                      {onCheckConsistency && (
                        <NavButton onClick={() => handleMenuNav(onCheckConsistency)}>
                          [Check Consistency]
                        </NavButton>
                      )}
                      {onTestInvestigation && (
                        <NavButton onClick={() => handleMenuNav(onTestInvestigation)} style={{ color: '#0ff' }}>
                          [Case Hub]
                        </NavButton>
                      )}
                      {onCloseCase && (
                        <NavButton onClick={() => handleMenuNav(onCloseCase)} style={{ color: '#f55' }}>
                          [Close]
                        </NavButton>
                      )}
                    </>
                  )}

                  {user && (
                    <div style={{ borderTop: '1px solid #222', paddingTop: '10px', marginTop: 'auto' }}>
                      <div style={{ color: '#0f0', fontSize: '0.9rem', marginBottom: '5px' }}>User: {user.displayName}</div>
                      <NavButton onClick={onLogout}>[Logout]</NavButton>
                    </div>
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

            <Toaster
              position="bottom-right"
              containerStyle={{
                position: 'absolute',
                bottom: 30,
                right: 30,
                zIndex: 50,
              }}
              toastOptions={{
                style: {
                  background: '#111',
                  color: '#0f0',
                  border: '1px solid #333',
                  fontFamily: "'VT323', monospace",
                  fontSize: '1rem',
                  boxShadow: '0 0 15px rgba(0,255,0,0.1)',
                },
                success: {
                  iconTheme: { primary: '#0f0', secondary: '#111' },
                  duration: 3000,
                },
                error: {
                  style: { color: '#f55', borderColor: '#500' },
                  iconTheme: { primary: '#f55', secondary: '#111' },
                  duration: 6000,
                },
              }}
            />

          </ContentInset>
        </Screen>
      </MainContainer>
    </>
  );
};

export default Layout;
