import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { OnboardingProvider } from './contexts/OnboardingContext';
import AnimeCursor from 'anime-cursor';

// Initialize retro pixel cursor
new AnimeCursor({
  cursors: {
    default: {
      size: [32, 32],
      image: 'https://animecursor.js.org/i/cursor/cursor_default.gif',
      pixel: true,
      default: true
    },
    pointer: {
      tags: ['a', 'button', 'label', 'select'],
      size: [32, 36],
      image: 'https://animecursor.js.org/i/cursor/cursor_pointer.png',
      frames: 3,
      duration: 0.3,
      pingpong: true,
      offset: [10, 4],
      pixel: true
    },
    text: {
      tags: ['p', 'h1', 'h2', 'h3', 'h4', 'span', 'td', 'th', 'pre', 'code', 'textarea', 'input'],
      size: [32, 32],
      image: 'https://animecursor.js.org/i/cursor/cursor_text.png',
      offset: [10, 16],
      pixel: true
    }
  }
});

// Monkey-patch: the library only checks data-cursor on the direct element
// from elementFromPoint. We need to walk up the DOM to find data-cursor on
// parent elements (e.g., hovering text inside a card with data-cursor="pointer").
const initPatch = () => {
  const instance = AnimeCursor.instance;
  if (!instance || !instance._onMouseMove) return;
  
  // Remove original handler
  document.removeEventListener('mousemove', instance._onMouseMove);
  
  // Create patched handler that walks up the DOM
  const patchedHandler = (e: MouseEvent) => {
    if (instance.disabled) return;
    
    const x = e.clientX;
    const y = e.clientY;
    
    instance.cursorEl.style.left = x + 'px';
    instance.cursorEl.style.top = y + 'px';
    
    // Check if mouse is inside the monitor screen area
    const targetEl = document.elementFromPoint(x, y) as HTMLElement | null;
    const insideMonitor = targetEl?.closest('[data-monitor]') !== null;
    
    if (!insideMonitor) {
      // Outside monitor — hide custom cursor, show OS cursor
      instance.cursorEl.style.display = 'none';
      document.body.style.cursor = '';
      return;
    }
    
    // Inside monitor — show custom cursor
    instance.cursorEl.style.display = 'block';
    
    if (instance.debugEl) {
      instance.debugEl.style.left = x + 'px';
      instance.debugEl.style.top = y + 'px';
    }
    
    let nextCursorType: string | null = null;
    
    // Walk up from the target to find data-cursor.
    // Pointer on an ancestor overrides text on a descendant.
    let el = targetEl;
    while (el && el !== document.body) {
      if (el.dataset?.cursor) {
        const cursorVal = el.dataset.cursor;
        if (cursorVal === 'pointer') {
          // Pointer always wins — stop searching
          nextCursorType = 'pointer';
          break;
        }
        // Only take the first non-pointer cursor found (e.g. text)
        if (!nextCursorType) {
          nextCursorType = cursorVal;
        }
      }
      el = el.parentElement as HTMLElement | null;
    }
    
    // Fallback to default
    if (!nextCursorType && instance.defaultCursorType) {
      nextCursorType = instance.defaultCursorType;
    }
    
    if (!nextCursorType) return;
    if (instance.debugEl) { instance.debugEl.textContent = `(${x}px , ${y}px) ${nextCursorType}`; }
    
    if (nextCursorType !== instance.lastCursorType) {
      instance.cursorEl.className = instance.debugEl 
        ? `cursor-${nextCursorType} cursor-debugmode`
        : `cursor-${nextCursorType}`;
      instance.lastCursorType = nextCursorType;
    }
  };
  
  instance._onMouseMove = patchedHandler;
  document.addEventListener('mousemove', patchedHandler);
};

// Also refresh bindings when React updates the DOM
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
const observer = new MutationObserver(() => {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => AnimeCursor.refresh(), 300);
});

const startObserving = () => {
  observer.observe(document.body, { childList: true, subtree: true });
  // Apply the monkey-patch once DOM is ready
  setTimeout(initPatch, 100);
};
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startObserving);
} else {
  startObserving();
}

import InstallPrompt from './components/InstallPrompt';

const root = createRoot(document.getElementById('root')!);
root.render(
  <OnboardingProvider>
    <App />
    <InstallPrompt />
  </OnboardingProvider>
);

// Register service worker for PWA installability (production only)
// During dev, the SW caches stale content and blocks hot reload
if ('serviceWorker' in navigator) {
  const isDev = ['localhost', '127.0.0.1'].includes(location.hostname) ||
    location.hostname.match(/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/);

  if (isDev) {
    // Unregister any existing SW during dev so cached content doesn't interfere
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => {
          console.log('SW registered:', registration.scope);
        },
        (error) => {
          console.log('SW registration failed:', error);
        }
      );
    });
  }
}
