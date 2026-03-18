import React, { useState, useEffect } from 'react';
import { type } from '../theme';
import { createPortal } from 'react-dom';
import styled, { keyframes } from 'styled-components';

// Types for the beforeinstallprompt event (not in standard TS types)
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

const slideUp = keyframes`
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 8px rgba(0, 255, 136, 0.3); }
  50% { box-shadow: 0 0 20px rgba(0, 255, 136, 0.6); }
`;

const Banner = styled.div`
  position: fixed;
  bottom: 16px;
  left: 16px;
  right: 16px;
  background: linear-gradient(135deg, var(--color-surface) 0%, #1a1a2e 100%);
  border: 1px solid #00ff88;
  padding: calc(var(--space) * 2);
  display: flex;
  align-items: center;
  gap: calc(var(--space) * 2);
  z-index: 99999;
  animation: ${slideUp} 0.4s ease-out, ${pulse} 2s ease-in-out infinite;

  @media (min-width: 769px) {
    display: none; /* Only show on mobile */
  }
`;

const IconImg = styled.img`
  width: 48px;
  height: 48px;
  flex-shrink: 0;
`;

const TextCol = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  color: #00ff88;
  ${type.bodyLg}
  font-weight: bold;
  line-height: 1.2;
`;

const Subtitle = styled.div`
  color: var(--color-text-subtle);
  ${type.small}
  line-height: 1.3;
  margin-top: 0;
`;

const InstallBtn = styled.button`
  background: #00ff88;
  color: var(--color-text-inverse);
  border: none;
  padding: var(--space) calc(var(--space) * 2);
  ${type.body}
  font-weight: bold;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  text-transform: uppercase;

  &:active {
    transform: scale(0.95);
  }
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  color: var(--color-text-dim);
  ${type.bodyLg}
  cursor: pointer;
  padding: var(--space);
  line-height: 1;
  position: absolute;
  top: 6px;
  right: 8px;
`;

/* ─── Helpers ─── */

function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // On iOS, all browsers use WebKit, but only Safari shows the A2HS option.
  // CriOS = Chrome on iOS, FxiOS = Firefox on iOS, etc.
  const isSafari = !(/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua));
  return isIOS && isSafari;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true; // iOS Safari standalone check
}

const DISMISS_KEY = 'pwa-install-dismissed';

/* ─── Component ─── */

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Already running as a PWA
    if (isStandalone()) {
      setIsInstalled(true);
      return;
    }

    // Check if user previously dismissed
    if (localStorage.getItem(DISMISS_KEY) === 'true') {
      setDismissed(true);
    }

    // iOS Safari: no beforeinstallprompt, show custom banner
    if (isIOSSafari()) {
      setShowIOSBanner(true);
      return;
    }

    // Android / Chrome: listen for native install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    const installedHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, 'true');
  };

  // Don't show if already installed or explicitly dismissed
  if (isInstalled || dismissed) return null;

  // iOS Safari banner
  if (showIOSBanner) {
    return createPortal(
      <Banner>
        <CloseBtn onClick={handleDismiss}>×</CloseBtn>
        <IconImg src="/icon-192.png" alt="DetectiveML" />
        <TextCol>
          <Title>Install DetectiveML</Title>
          <Subtitle>
            Tap{' '}
            <span style={{ verticalAlign: 'middle' }}>
              {/* iOS share icon (box with arrow) */}
              <svg width="16" height="18" viewBox="0 0 16 18" fill="none" style={{ verticalAlign: 'middle', marginBottom: '0' }}>
                <path d="M8 0L8 11M8 0L4 4M8 0L12 4" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1 7V15C1 16.1 1.9 17 3 17H13C14.1 17 15 16.1 15 15V7" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            {' '}then <strong style={{ color: 'var(--color-text-bright)' }}>{"\"Add to Home Screen\""}</strong>
          </Subtitle>
        </TextCol>
      </Banner>,
      document.body
    );
  }

  // Android/Chrome banner — only show when native prompt is available
  if (!deferredPrompt) return null;

  return createPortal(
    <Banner>
      <CloseBtn onClick={handleDismiss}>×</CloseBtn>
      <IconImg src="/icon-192.png" alt="DetectiveML" />
      <TextCol>
        <Title>Install DetectiveML</Title>
        <Subtitle>Add to home screen for fullscreen experience</Subtitle>
      </TextCol>
      <InstallBtn onClick={handleInstall}>Install</InstallBtn>
    </Banner>,
    document.body
  );
};

export default InstallPrompt;
