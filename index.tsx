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
    
    if (instance.cursorEl.dataset.animecursorHide) {
      instance.cursorEl.style.display = 'block';
    }
    
    if (instance.debugEl) {
      instance.debugEl.style.left = x + 'px';
      instance.debugEl.style.top = y + 'px';
    }
    
    let nextCursorType: string | null = null;
    
    // Walk up from the target to find data-cursor
    let el = document.elementFromPoint(x, y) as HTMLElement | null;
    while (el && el !== document.body) {
      if (el.dataset?.cursor) {
        nextCursorType = el.dataset.cursor;
        break;
      }
      el = el.parentElement;
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

const root = createRoot(document.getElementById('root')!);
root.render(
  <OnboardingProvider>
    <App />
  </OnboardingProvider>
);
