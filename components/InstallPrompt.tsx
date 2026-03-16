import React, { useState, useEffect } from 'react';
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
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
  border: 1px solid #00ff88;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  z-index: 99999;
  animation: ${slideUp} 0.4s ease-out, ${pulse} 2s ease-in-out infinite;
  font-family: 'VT323', monospace;

  @media (min-width: 769px) {
    display: none; /* Only show on mobile */
  }
`;

const IconImg = styled.img`
  width: 48px;
  height: 48px;
  border-radius: 10px;
  flex-shrink: 0;
`;

const TextCol = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  color: #00ff88;
  font-size: 18px;
  font-weight: bold;
  line-height: 1.2;
`;

const Subtitle = styled.div`
  color: #999;
  font-size: 14px;
  line-height: 1.3;
  margin-top: 2px;
`;

const InstallBtn = styled.button`
  background: #00ff88;
  color: #000;
  border: none;
  border-radius: 8px;
  padding: 10px 18px;
  font-family: 'VT323', monospace;
  font-size: 16px;
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
  color: #666;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  position: absolute;
  top: 6px;
  right: 8px;
`;

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if user previously dismissed
    if (localStorage.getItem('pwa-install-dismissed') === 'true') {
      setDismissed(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
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
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if: already installed, no prompt available, or user dismissed
  if (isInstalled || !deferredPrompt || dismissed) return null;

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
