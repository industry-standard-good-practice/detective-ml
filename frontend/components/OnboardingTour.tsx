
import React, { useEffect, useState, useRef } from 'react';
import { type } from '../theme';
import styled, { keyframes } from 'styled-components';
import { useOnboarding, OnboardingStep } from '../contexts/OnboardingContext';
import { motion, AnimatePresence } from 'motion/react';

export const OnboardingOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9990;
  pointer-events: none;
  overflow: hidden;
`;

export const OnboardingHighlight = styled(motion.div)`
  position: absolute;
  background: transparent;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.85);
  border: 2px solid var(--color-accent-green);
  pointer-events: none;
  z-index: 9991;
`;

const CenteredBackdrop = styled(motion.div)`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  pointer-events: auto;
`;

export const OnboardingTooltip = styled(motion.div) <{ $position: 'top' | 'bottom' | 'left' | 'right'; $hideTail?: boolean }>`
  position: absolute;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-accent-green);
  padding: calc(var(--space) * 3);
  width: 300px;
  color: var(--color-text-bright);
  z-index: 9992;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: calc(var(--space) * 2);
  pointer-events: none; /* Allow clicks to pass through to target if overlapping */

  &::after {
    content: '';
    position: absolute;
    border: 10px solid transparent;
    ${props => props.$hideTail && 'display: none;'}
    ${props => props.$position === 'top' && `
      bottom: -20px;
      left: 50%;
      transform: translateX(-50%);
      border-top-color: var(--color-accent-green);
    `}
    ${props => props.$position === 'bottom' && `
      top: -20px;
      left: 50%;
      transform: translateX(-50%);
      border-bottom-color: var(--color-accent-green);
    `}
    ${props => props.$position === 'left' && `
      right: -20px;
      top: 50%;
      transform: translateY(-50%);
      border-left-color: var(--color-accent-green);
    `}
    ${props => props.$position === 'right' && `
      left: -20px;
      top: 50%;
      transform: translateY(-50%);
      border-right-color: var(--color-accent-green);
    `}
  }
`;

const Title = styled.h4`
  margin: 0;
  color: var(--color-accent-green);
  text-transform: uppercase;
  ${type.h3}
`;

const Description = styled.p`
  margin: 0;
  ${type.body}
  line-height: 1.4;
  color: var(--color-text);
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: space-between;
  gap: var(--space);
  margin-top: var(--space);
  pointer-events: none; /* Don't capture clicks in the gap */
`;

const NavButton = styled.button<{ $primary?: boolean }>`
  background: ${props => props.$primary ? 'var(--color-accent-green)' : 'transparent'};
  color: ${props => props.$primary ? 'var(--color-text-inverse)' : 'var(--color-accent-green)'};
  border: 1px solid var(--color-accent-green);
  padding: var(--space) calc(var(--space) * 2);
  font-family: inherit;
  font-weight: bold;
  cursor: pointer;
  text-transform: uppercase;
  ${type.small}
  pointer-events: auto; /* Only buttons capture clicks */

  &:hover {
    background: ${props => props.$primary ? 'var(--color-partner-name)' : 'rgba(0, 255, 0, 0.1)'};
  }
`;

const StepIndicator = styled.div`
  ${type.xs}
  color: var(--color-text-disabled);
  text-align: right;
`;

interface StepConfig {
  title: string;
  description: string;
  completedDescription?: string;
  targetId: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  mobilePosition?: 'top' | 'bottom' | 'left' | 'right';
  requiresAction?: boolean;
  mobileTab?: 'BOARD' | 'HQ';
  mobileAccordion?: 'evidence' | 'timeline' | 'suspects';
  requiresMenu?: boolean;
  requiresProfile?: boolean;
  requiresIntel?: boolean;
  completedTargetId?: string;
  centered?: boolean;
}

const STEPS: Record<number, StepConfig> = {
  [OnboardingStep.MISSION_BRIEFING]: {
    title: "Mission Briefing",
    description: "This is your primary source of truth. Read the case summary here to understand the crime, the victim, and the initial circumstances. Knowledge is your best weapon.",
    targetId: "mission-briefing",
    position: "left",
    mobileTab: "HQ"
  },
  [OnboardingStep.SECURE_LINE]: {
    title: "Secure Line",
    description: "Stuck on a lead? Use the Secure Line to contact HQ. The Chief can provide hints, but remember: the battery is limited. Use it wisely.",
    targetId: "secure-line",
    position: "left",
    mobileTab: "HQ"
  },
  [OnboardingStep.EVIDENCE_BOARD]: {
    title: "Evidence Board",
    description: "As you interrogate suspects and find clues, they will appear here.",
    targetId: "evidence-board",
    position: "bottom",
    mobileTab: "BOARD",
    mobileAccordion: "evidence"
  },
  [OnboardingStep.TIMELINE]: {
    title: "The Timeline",
    description: "Keep track of everyone's movements. The timeline shows confirmed events and contradictions. Use it to spot lies and build your case.",
    targetId: "timeline-button",
    position: "bottom",
    mobileTab: "BOARD",
    mobileAccordion: "timeline"
  },
  [OnboardingStep.SUSPECT_CARDS]: {
    title: "Persons of Interest",
    description: "These are the people involved in the case — suspects and victims alike. Click on any card to begin. Suspects can be interrogated; the victim's body can be examined for clues.",
    targetId: "suspect-cards-container",
    position: "top",
    requiresAction: true,
    mobileTab: "BOARD",
    mobileAccordion: "suspects"
  },
  [OnboardingStep.FLIP_CARD]: {
    title: "Deep Dive",
    description: "Every card has information on the back. Click the [Flip Card] button to see their background and role.",
    completedDescription: "Great! Always check a profile before diving in. Their background, profession, and role can reveal motives and help you ask the right questions — or know where to look on the body.",
    targetId: "flip-card-button",
    completedTargetId: "active-suspect-card",
    position: "right",
    mobilePosition: "bottom",
    requiresAction: true,
    requiresProfile: true
  },
  [OnboardingStep.TALK_ACTION]: {
    title: "Interrogation Tools",
    description: "Use the input bar to interact. Question suspects, perform actions on the victim's body, or present evidence by clicking the [+] button.",
    targetId: "unified-input-bar",
    position: "top"
  },
  [OnboardingStep.AGGRAVATION]: {
    title: "Aggravation Meter",
    description: "This tracks how agitated a suspect is during interrogation. Push too hard and they'll shut down and call their lawyer. It doesn't apply to the victim — the dead don't get angry.",
    targetId: "aggravation-meter",
    position: "left",
    requiresIntel: true
  },
  [OnboardingStep.PARTNER_SUPPORT]: {
    title: "Partner Support",
    description: "Your partner is here to help. Ask them to intervene if you're having trouble getting evidence. They can perform an initial exam, be a good cop, or be a bad cop. Choose wisely, their actions can have an effect on the aggravation meter if you're interrogating a suspect.",
    targetId: "partner-support",
    position: "left",
    requiresIntel: true
  },
  [OnboardingStep.FINAL_GOOD_LUCK]: {
    title: "Good Luck, Detective",
    description: "You're ready. The clock is ticking, and the truth is out there. Trust your instincts, follow the evidence, and bring the guilty to justice. We're counting on you.",
    targetId: "hub-button",
    position: "bottom",
    centered: true
  }
};

export const OnboardingTour: React.FC = () => {
  const { currentStep, isActive, nextStep, skipTour, isActionCompleted } = useOnboarding();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [renderedPosition, setRenderedPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom');
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = STEPS[currentStep];

  useEffect(() => {
    if (!isActive || !step) return;

    const updatePosition = () => {
      const isMobile = window.innerWidth <= 768;

      // Auto-switch tabs on mobile if needed
      if (isMobile && step.mobileTab) {
        let tabBar = document.getElementById('mobile-tab-bar');

        // If we're on a Hub step but tabBar isn't found, we might be in Interrogation.
        // Try to navigate back to Hub.
        if (!tabBar) {
          const hubBtn = document.getElementById('hub-button') || document.getElementById('hub-button-mobile');
          if (hubBtn) {
            console.log("[DEBUG] Auto-navigating to Hub for step:", currentStep);
            hubBtn.click();
            return;
          }
        }

        tabBar = document.getElementById('mobile-tab-bar');
        if (tabBar) {
          const tabs = tabBar.querySelectorAll('button');
          const tabBtn = Array.from(tabs).find(t => t.textContent?.trim() === step.mobileTab);
          if (tabBtn) {
            const style = window.getComputedStyle(tabBtn);
            // active color is #0f0 (rgb(0, 255, 0))
            const isActive = style.borderBottomColor === 'rgb(0, 255, 0)' || style.color === 'rgb(255, 255, 255)';
            if (!isActive) {
              console.log("[DEBUG] Switching to mobile tab:", step.mobileTab);
              (tabBtn as HTMLElement).click();
            }
          }
        }
      }

      // Auto-open the correct accordion panel on mobile if needed
      if (isMobile && step.mobileAccordion) {
        const accordionBtn = document.getElementById(`accordion-${step.mobileAccordion}`);
        if (accordionBtn) {
          const isOpen = accordionBtn.getAttribute('data-open') === 'true';
          if (!isOpen) {
            console.log("[DEBUG] Opening mobile accordion:", step.mobileAccordion);
            accordionBtn.click();
            // Give the accordion time to animate open before measuring
            return;
          }
        }
      }

      // Auto-open menu on mobile if needed
      if (isMobile && step.requiresMenu && currentStep !== OnboardingStep.FINAL_GOOD_LUCK) {
        const hamburger = document.getElementById('hamburger-button');
        if (hamburger && hamburger.textContent?.includes('MENU')) {
          console.log("[DEBUG] Opening mobile menu");
          (hamburger as HTMLElement).click();
        }
      } else if (isMobile && (!step.requiresMenu || currentStep === OnboardingStep.FINAL_GOOD_LUCK)) {
        // Close menu if it's open and not required
        const hamburger = document.getElementById('hamburger-button');
        if (hamburger && hamburger.textContent?.includes('X')) {
          console.log("[DEBUG] Closing mobile menu");
          (hamburger as HTMLElement).click();
        }
      }

      // 3. Handle Mobile Profile (Interrogation)
      if (isMobile && step.requiresProfile) {
        const profileModal = document.getElementById('mobile-profile-modal');
        if (!profileModal) {
          const profileBtn = document.getElementById('mobile-profile-button');
          if (profileBtn) {
            console.log("[DEBUG] Opening mobile profile modal");
            profileBtn.click();
            return;
          }
        }
      } else if (isMobile && !step.requiresProfile) {
        // Close profile if open but not required
        const profileModal = document.getElementById('mobile-profile-modal');
        if (profileModal) {
          console.log("[DEBUG] Closing mobile profile modal");
          (profileModal as HTMLElement).click();
        }
      }

      // 4. Handle Mobile Intel (Interrogation)
      if (isMobile && step.requiresIntel) {
        const intelPanel = document.getElementById('right-panel');
        if (intelPanel) {
          const rect = intelPanel.getBoundingClientRect();
          const isVisible = rect.left < window.innerWidth;
          if (!isVisible) {
            const intelBtn = document.getElementById('mobile-action-button');
            if (intelBtn) {
              console.log("[DEBUG] Opening mobile intel panel");
              intelBtn.click();
              return;
            }
          }
        }
      } else if (isMobile && !step.requiresIntel && !step.requiresProfile && !step.mobileTab) {
        // Close intel if open but not required
        const intelPanel = document.getElementById('right-panel');
        if (intelPanel) {
          const rect = intelPanel.getBoundingClientRect();
          const isVisible = rect.left < window.innerWidth;
          if (isVisible) {
            const intelBtn = document.getElementById('mobile-action-button');
            if (intelBtn) {
              console.log("[DEBUG] Closing mobile intel panel");
              intelBtn.click();
            }
          }
        }
      }

      // If step is centered, just place tooltip in the middle of the screen
      if (step.centered) {
        const tooltipWidth = isMobile ? Math.min(280, window.innerWidth - 20) : 300;
        const estimatedHeight = tooltipRef.current?.offsetHeight || 200;
        setRect(null);
        setTooltipPos({
          top: (window.innerHeight - estimatedHeight) / 2,
          left: (window.innerWidth - tooltipWidth) / 2
        });
        setRenderedPosition('bottom');
        return;
      }

      const targetId = (step.completedTargetId && isActionCompleted) ? step.completedTargetId : step.targetId;
      const elements = document.querySelectorAll(`[id="${targetId}"], [id="${targetId}-mobile"]`);
      const el = Array.from(elements).find(e => {
        const style = window.getComputedStyle(e);
        return style.display !== 'none' && style.visibility !== 'hidden' && (e as HTMLElement).offsetParent !== null;
      }) as HTMLElement | null;

      if (el) {
        const r = el.getBoundingClientRect();

        // Account for the fact that the overlay might be inside a transformed parent (like the CRT screen)
        const overlayEl = document.getElementById('onboarding-overlay');
        let offsetTop = 0;
        let offsetLeft = 0;
        let vWidth = window.innerWidth;
        let vHeight = window.innerHeight;

        if (overlayEl) {
          const overlayRect = overlayEl.getBoundingClientRect();
          offsetTop = overlayRect.top;
          offsetLeft = overlayRect.left;
          vWidth = overlayRect.width;
          vHeight = overlayRect.height;
        }

        const adjustedRect = {
          top: r.top - offsetTop,
          left: r.left - offsetLeft,
          width: r.width,
          height: r.height,
          bottom: r.bottom - offsetTop,
          right: r.right - offsetLeft
        };

        setRect(adjustedRect as DOMRect);

        // Calculate tooltip position
        let tTop = 0;
        let tLeft = 0;
        const padding = isMobile ? 20 : 25;
        const tooltipWidth = isMobile ? Math.min(280, vWidth - 20) : 300;

        // Use actual height if available, otherwise fallback to a safer estimate
        const actualHeight = tooltipRef.current?.offsetHeight || (isMobile ? 250 : 320);
        const estimatedHeight = actualHeight;

        let finalPos = step.position;

        // Mobile specific position overrides
        if (isMobile) {
          if (step.mobilePosition) {
            finalPos = step.mobilePosition;
          } else if (adjustedRect.top > vHeight / 2) {
            finalPos = 'top';
          } else {
            finalPos = 'bottom';
          }

          // Mobile safety check: if 'top' would go off screen or overlap top bar, flip to 'bottom'
          if (finalPos === 'top' && adjustedRect.top < estimatedHeight + padding + 60) {
            finalPos = 'bottom';
          }
          // If 'bottom' would go off screen, flip to 'top'
          if (finalPos === 'bottom' && adjustedRect.bottom + estimatedHeight + padding + 60 > vHeight) {
            finalPos = 'top';
          }
        } else {
          // Flip if necessary
          if (finalPos === 'top' && adjustedRect.top < estimatedHeight + padding) finalPos = 'bottom';
          if (finalPos === 'bottom' && adjustedRect.bottom + estimatedHeight + padding > vHeight) finalPos = 'top';
          if (finalPos === 'left' && adjustedRect.left < tooltipWidth + padding) finalPos = 'right';
          if (finalPos === 'right' && adjustedRect.right + tooltipWidth + padding > vWidth) finalPos = 'left';
        }

        setRenderedPosition(finalPos);

        switch (finalPos) {
          case 'top':
            tTop = adjustedRect.top - estimatedHeight - padding;
            tLeft = adjustedRect.left + adjustedRect.width / 2 - tooltipWidth / 2;
            break;
          case 'bottom':
            tTop = adjustedRect.bottom + padding;
            tLeft = adjustedRect.left + adjustedRect.width / 2 - tooltipWidth / 2;
            break;
          case 'left':
            tTop = adjustedRect.top + adjustedRect.height / 2 - estimatedHeight / 2;
            tLeft = adjustedRect.left - tooltipWidth - padding;
            break;
          case 'right':
            tTop = adjustedRect.top + adjustedRect.height / 2 - estimatedHeight / 2;
            tLeft = adjustedRect.right + padding;
            break;
        }

        // Strict clamping within the overlay boundaries
        tLeft = Math.max(10, Math.min(vWidth - tooltipWidth - 10, tLeft));
        tTop = Math.max(10, Math.min(vHeight - estimatedHeight - 10, tTop));

        setTooltipPos({ top: tTop, left: tLeft });
      } else {
        setRect(null);
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    const interval = setInterval(updatePosition, 500); // Poll for dynamic elements

    return () => {
      window.removeEventListener('resize', updatePosition);
      clearInterval(interval);
    };
  }, [currentStep, isActive, step, isActionCompleted]);

  if (!isActive || !step) return null;

  return (
    <AnimatePresence>
      <OnboardingOverlay
        id="onboarding-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {step.centered && (
          <CenteredBackdrop
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
        {rect && !step.centered && (
          <OnboardingHighlight
            initial={false}
            animate={{
              top: rect.top - 5,
              left: rect.left - 5,
              width: rect.width + 10,
              height: rect.height + 10,
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          />
        )}

        <OnboardingTooltip
          ref={tooltipRef}
          $position={renderedPosition}
          $hideTail={!!step.centered}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
            top: tooltipPos.top,
            left: tooltipPos.left
          }}
          transition={{ delay: 0.2 }}
        >
          <Title>{step.title}</Title>
          <Description>{(isActionCompleted && step.completedDescription) ? step.completedDescription : step.description}</Description>

          <ButtonGroup>
            <NavButton onClick={skipTour}>Skip Tour</NavButton>
            {(!step.requiresAction || isActionCompleted) && (
              <NavButton $primary onClick={nextStep}>
                {currentStep === OnboardingStep.FINAL_GOOD_LUCK ? "Finish" : "Next"}
              </NavButton>
            )}
            {step.requiresAction && !isActionCompleted && (
              <StepIndicator style={{ alignSelf: 'center' }}>
                Action Required
              </StepIndicator>
            )}
          </ButtonGroup>

          <StepIndicator>Step {currentStep} of 10</StepIndicator>
        </OnboardingTooltip>
      </OnboardingOverlay>
    </AnimatePresence>
  );
};
