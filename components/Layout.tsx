
import React, { useState } from 'react';
import styled, { createGlobalStyle, keyframes, css } from 'styled-components';
import { ScreenState } from '../types';
import CRTOverlay from './CRTOverlay';
import { User } from 'firebase/auth';

import { useOnboarding } from '../contexts/OnboardingContext';
import ExitCaseDialog from './ExitCaseDialog';

const GlobalStyle = createGlobalStyle`
  :root {
    --font-main: 'VT323', monospace;
    
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
      --type-h1: 2.2rem;
      --type-h2: 1.8rem;
      --type-h3: 1.5rem;
      --type-body-lg: 1.3rem; /* Larger for readability on mobile */
      --type-body: 1.15rem;
      --type-small: 0.95rem;
    }
  }

  /* Large Screen / 2K+ Breakpoint */
  
  body {
    background: #050505;
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
  background: radial-gradient(circle at center, #1a1a1a 0%, #000 100%);
  
  @media (max-width: 768px) {
    background: #000;
  }
`;

// The Monitor Frame
const MonitorBezel = styled.div`
  width: 95vw;
  height: 90vh;
  background: #222;
  border-radius: 40px;
  padding: 20px;
  box-shadow: 
    inset 0 0 20px #000,
    0 0 50px rgba(0,0,0,0.8);
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
  
  &::before {
    content: '';
    position: absolute;
    top: 5px; left: 5px; right: 5px; bottom: 5px;
    border-radius: 35px;
    background: #111;
    z-index: -1;
  }

  @media (max-width: 768px) {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    border-radius: 0;
    padding: 0;
    box-shadow: none;
    
    &::before {
      display: none;
    }
  }
`;

// The Inner Screen
const Screen = styled.div<{ $powerState: 'on' | 'off' | 'turning-on' | 'turning-off' }>`
  width: 100%;
  height: 100%;
  background-color: #0a0a0a;
  border-radius: 20px; /* CRT curve corner */
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: inset 0 0 80px rgba(0,0,0,0.8);
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
  
  @media (max-width: 768px) {
    border-radius: 0;
    box-shadow: none;
  }
  
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
  padding: 10px 30px;
  font-size: var(--type-body-lg);
  border-bottom: 2px solid #333;
  background: #0f0f0f;
  z-index: 5;
  height: 70px;
  position: relative;
  justify-content: space-between;

  @media (max-width: 768px) {
    padding: 5px 15px;
    height: 60px;
    justify-content: center; /* Center the title on mobile */
  }
`;

const TitleContainer = styled.div`
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
    max-width: 50%;
  }
`;

const Title = styled.h1`
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

const NavGroup = styled.div`
  display: flex; 
  gap: 20px; 
  min-width: 200px; 
  align-items: center;
  
  @media (max-width: 768px) {
    display: none; /* Hidden on mobile, replaced by Menu */
  }
`;

const HamburgerButton = styled.button`
  display: none;
  background: transparent;
  border: none;
  color: #0f0;
  font-family: inherit;
  font-size: var(--type-h3);
  font-weight: bold;
  cursor: pointer;
  z-index: 20;
  text-transform: uppercase;
  
  @media (max-width: 768px) {
    display: block;
    position: absolute;
    left: 15px;
    top: 50%;
    transform: translateY(-50%);
  }
`;

const MobileActionButton = styled.button<{ $active?: boolean }>`
  display: none;
  @media (max-width: 768px) {
    display: block;
    background: ${props => props.$active ? '#0f0' : 'transparent'};
    color: ${props => props.$active ? '#000' : '#0f0'};
    border: 1px solid #0f0;
    padding: 5px 10px;
    font-family: inherit;
    font-size: var(--type-body);
    font-weight: bold;
    text-transform: uppercase;
    position: absolute;
    right: 15px;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;
    z-index: 20;
    
    &:hover {
      background: ${props => props.$active ? '#0d0' : '#003300'};
    }
  }
`;

const MobileMenu = styled.div<{ $isOpen: boolean }>`
  position: absolute;
  top: 60px; /* Below header */
  left: 0;
  width: 100%;
  background: #0a0a0a;
  border-bottom: 2px solid #0f0;
  display: flex;
  flex-direction: column;
  padding: 20px;
  gap: 10px;
  z-index: 100;
  transform: ${props => props.$isOpen ? 'translateY(0)' : 'translateY(-150%)'};
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 10px 30px rgba(0,0,0,0.9);

  @media (min-width: 769px) {
    display: none;
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
  onLogout
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const { startTour } = useOnboarding();

  // Logic to determine if we are in "Gameplay" mode
  const isGameplay = 
    screenState === ScreenState.CASE_HUB || 
    screenState === ScreenState.INTERROGATION || 
    screenState === ScreenState.ACCUSATION ||
    screenState === ScreenState.ENDGAME;

  const toggleMenu = () => setMenuOpen(!menuOpen);
  const handleMobileNav = (action: () => void) => {
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
      <MainContainer>
        <MonitorBezel>
          <Screen $powerState={powerState}>
            <CRTOverlay />
            {!isBooting && (
              <>
                <TopBar>
                  {/* MOBILE HAMBURGER */}
                    <HamburgerButton id="hamburger-button" onClick={toggleMenu}>
                      {menuOpen ? '[X]' : '[MENU]'}
                    </HamburgerButton>
                    
                  {/* MOBILE CUSTOM ACTION */}
                    {mobileAction && (
                      <MobileActionButton id="mobile-action-button" onClick={mobileAction.onClick} $active={mobileAction.active}>
                        {mobileAction.label}
                      </MobileActionButton>
                    )}

                  {/* DESKTOP LEFT */}
                  <NavGroup>
                    {isGameplay && <NavButton onClick={() => setShowExitDialog(true)}>[Exit Case]</NavButton>}
                    <NavButton onClick={onToggleMute} style={{ color: isMuted ? '#777' : '#0f0' }}>
                      {isMuted ? '[SOUND: OFF]' : '[SOUND: ON]'}
                    </NavButton>
                    {screenState === ScreenState.CASE_HUB && (
                      <NavButton onClick={() => startTour()} title="Restart Tutorial" style={{ color: '#0f0' }}>
                        [?]
                      </NavButton>
                    )}
                    {canEdit && (
                      <NavButton onClick={onEdit} style={{ color: '#eb0' }}>
                        [Edit]
                      </NavButton>
                    )}
                  </NavGroup>

                  {/* CENTER TITLE */}
                  <TitleContainer>
                    <Title title={caseTitle || 'DetectiveML'}>
                      {caseTitle || 'DetectiveML'}
                    </Title>
                    <SubTitle>v1.0.0 // SYSTEM READY</SubTitle>
                  </TitleContainer>

                  {/* DESKTOP RIGHT */}
                  <NavGroup style={{ justifyContent: 'flex-end' }}>
                    {user && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: '15px' }}>
                        <span style={{ color: '#0f0', fontSize: '0.8rem' }}>{user.displayName}</span>
                        <button 
                          onClick={onLogout} 
                          style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 0, textTransform: 'uppercase', fontSize: '0.7rem' }}
                        >
                          [Logout]
                        </button>
                      </div>
                    )}
                    {canPublish && (
                      <UploadButton onClick={onPublish} disabled={isPublishing}>
                        {isPublishing ? '...' : '[PUBLISH TO NETWORK]'}
                      </UploadButton>
                    )}
                    {isGameplay && screenState !== ScreenState.ENDGAME && (
                      <>
                        <NavButton id="hub-button" onClick={() => onNavigate(ScreenState.CASE_HUB)}>[Hub]</NavButton>
                      </>
                    )}
                  </NavGroup>
                </TopBar>

                {/* MOBILE MENU DROPDOWN */}
                <MobileMenu $isOpen={menuOpen}>
                    {isGameplay && (
                      <NavButton onClick={() => handleMobileNav(() => setShowExitDialog(true))}>
                          [Exit Game]
                      </NavButton>
                    )}
                    
                    <NavButton onClick={() => handleMobileNav(onToggleMute)} style={{ color: isMuted ? '#777' : '#0f0' }}>
                        {isMuted ? '[SOUND: OFF]' : '[SOUND: ON]'}
                    </NavButton>

                    {screenState === ScreenState.CASE_HUB && (
                      <NavButton onClick={() => handleMobileNav(startTour)} style={{ color: '#0f0' }}>
                        [Tutorial]
                      </NavButton>
                    )}

                    {isGameplay && screenState !== ScreenState.ENDGAME && (
                        <NavButton id="hub-button-mobile" onClick={() => handleMobileNav(() => onNavigate(ScreenState.CASE_HUB))}>
                            [Return to Hub]
                        </NavButton>
                    )}

                    {canEdit && (
                        <NavButton onClick={() => handleMobileNav(onEdit!)} style={{ color: '#eb0' }}>
                            [Edit Case]
                        </NavButton>
                    )}

                    {canPublish && (
                        <UploadButton onClick={() => handleMobileNav(onPublish!)} disabled={isPublishing}>
                            {isPublishing ? 'PUBLISHING...' : '[PUBLISH TO NETWORK]'}
                        </UploadButton>
                    )}

                    {user && (
                      <div style={{ borderTop: '1px solid #222', paddingTop: '10px', marginTop: '10px' }}>
                        <div style={{ color: '#0f0', fontSize: '0.9rem', marginBottom: '5px' }}>USER: {user.displayName}</div>
                        <NavButton onClick={onLogout}>[Logout]</NavButton>
                      </div>
                    )}
                </MobileMenu>
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
            
          </Screen>
        </MonitorBezel>
      </MainContainer>
    </>
  );
};

export default Layout;
