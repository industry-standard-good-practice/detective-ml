import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { OnboardingProvider } from './contexts/OnboardingContext';

const root = createRoot(document.getElementById('root')!);
root.render(
  <OnboardingProvider>
    <App />
  </OnboardingProvider>
);
