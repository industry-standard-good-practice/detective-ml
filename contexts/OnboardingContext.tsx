
import React, { createContext, useContext, useState, useEffect } from 'react';

export enum OnboardingStep {
  NONE = 0,
  MISSION_BRIEFING = 1,
  SECURE_LINE = 2,
  EVIDENCE_BOARD = 3,
  TIMELINE = 4,
  SUSPECT_CARDS = 5,
  FLIP_CARD = 6,
  TALK_ACTION = 7,
  AGGRAVATION = 8,
  PARTNER_SUPPORT = 9,
  FINAL_GOOD_LUCK = 10,
  COMPLETED = 11
}

interface OnboardingContextType {
  currentStep: OnboardingStep;
  isActive: boolean;
  startTour: (force?: boolean) => void;
  nextStep: () => void;
  skipTour: () => void;
  completeStep: (step: OnboardingStep, autoNext?: boolean) => void;
  isActionCompleted: boolean;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(OnboardingStep.NONE);
  const [isActive, setIsActive] = useState(false);
  const [isActionCompleted, setIsActionCompleted] = useState(false);

  useEffect(() => {
    setIsActionCompleted(false);
  }, [currentStep]);

  useEffect(() => {
    const completed = localStorage.getItem('onboarding_completed');
    if (!completed) {
      // We don't start automatically here, we wait for the CaseHub to trigger it
      // or we can start it when a case is active.
    }
  }, []);

  const startTour = (force = true) => {
    if (!force) {
      const completed = localStorage.getItem('onboarding_completed');
      if (completed === 'true') return;
    }
    setCurrentStep(OnboardingStep.MISSION_BRIEFING);
    setIsActive(true);
  };

  const nextStep = () => {
    if (currentStep < OnboardingStep.COMPLETED) {
      setCurrentStep(prev => prev + 1);
    } else {
      skipTour();
    }
  };

  const skipTour = () => {
    setIsActive(false);
    setCurrentStep(OnboardingStep.COMPLETED);
    localStorage.setItem('onboarding_completed', 'true');
  };

  const completeStep = (step: OnboardingStep, autoNext = false) => {
    if (currentStep === step) {
      if (autoNext) {
        nextStep();
      } else {
        setIsActionCompleted(true);
      }
    }
  };

  return (
    <OnboardingContext.Provider value={{ currentStep, isActive, startTour, nextStep, skipTour, completeStep, isActionCompleted }}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
