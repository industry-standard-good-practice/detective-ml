/**
 * theme.ts — Design Token System
 *
 * Centralized tokens for colors, spacing, breakpoints, and typography.
 * Colors and spacing are exposed as CSS custom properties via GlobalStyle in Layout.tsx.
 * Breakpoints are exported as JS constants + media query helpers for styled-components.
 *
 * RULE: Never use raw hex colors or magic-number px values in component styles.
 *       Use var(--color-*), var(--space), var(--type-*), and ${media.*} instead.
 */

/* ─── Breakpoints (px) ─── */

export const breakpoints = {
  mobile: 768,
  tablet: 1080,
  desktop: 1280,
  wide: 1400,
} as const;

/** Media query helpers for styled-components template literals.
 *  Usage: `${media.mobile} { display: none; }`
 */
export const media = {
  mobile: `@media (max-width: ${breakpoints.mobile}px)`,
  tablet: `@media (max-width: ${breakpoints.tablet}px)`,
  desktop: `@media (max-width: ${breakpoints.desktop}px)`,
  wide: `@media (max-width: ${breakpoints.wide}px)`,
  /** min-width counterparts for desktop-first overrides */
  aboveMobile: `@media (min-width: ${breakpoints.mobile + 1}px)`,
} as const;

/* ─── Color Tokens ─── */

export const colors = {
  /* Surfaces */
  bg: '#000',
  surface: '#0a0a0a',
  surfaceRaised: '#111',
  surfaceInset: '#050505',
  surfaceOverlay: 'rgba(0,0,0,0.8)',
  surfaceOverlayHeavy: 'rgba(0,0,0,0.95)',

  /* Borders */
  border: '#333',
  borderSubtle: '#222',
  borderStrong: '#555',
  borderFocus: '#fff',

  /* Text */
  text: '#e0e0e0',
  textBright: '#fff',
  textMuted: '#aaa',
  textSubtle: '#888',
  textDim: '#666',
  textDisabled: '#555',
  textInverse: '#000',

  /* Accent Colors — the CRT detective palette */
  accentGreen: '#0f0',
  accentGreenDim: '#0a0',
  accentGreenDark: 'rgba(0, 50, 0, 0.2)',
  accentCyan: '#0ff',
  accentCyanDim: '#0aa',
  accentRed: '#f00',
  accentRedBright: '#f55',
  accentGold: '#fc0',
  accentGoldDim: '#a80',
  accentOrange: '#fa0',
  accentBlue: '#4af',

  /* Semantic */
  success: '#0f0',
  danger: '#f00',
  dangerBg: '#500',
  dangerBgSubtle: 'rgba(255, 0, 0, 0.1)',
  warning: '#fa0',
  warningBg: '#442',

  /* Player / Partner / System message colors */
  playerText: '#eee',
  playerBg: '#311',
  playerName: '#f55',
  partnerText: '#afa',
  partnerBg: '#131',
  partnerName: '#5f5',
  partnerBorder: '#252',
  systemText: '#f55',
  systemBg: 'rgba(50, 0, 0, 0.5)',
  suspectName: '#5af',

  /* Officer / Secure Line palette */
  officerBg: '#0d1b2a',
  officerSurface: '#050a10',
  officerBorder: '#415a77',
  officerText: '#778da9',
  officerAccent: '#e0e1dd',
  officerButton: '#1b263b',
  officerButtonHover: '#415a77',

  /* Evidence / Polaroid colors */
  polaroidBg: '#fff',
  polaroidShadow: 'rgba(0,0,0,0.6)',
  evidenceYellow: '#ffc',
  evidenceBorder: '#cc0',
  evidenceCollected: '#2d4',
  noteYellow: '#fff9c4',
} as const;

/* ─── Spacing ─── */

/** Base spacing unit in px. Use as var(--space) in CSS, or multiply: calc(var(--space) * N) */
export const SPACE = 8;

/* ─── Typography ─── */

export const fonts = {
  main: "'VT323', monospace",
  handwritten: "'Caveat', cursive",
} as const;

/**
 * Comprehensive typography tokens as styled-components CSS mixins.
 * Each token bundles font-family, font-size, letter-spacing, line-height, and text-transform.
 *
 * Usage in styled-components:
 *   import { type } from '../theme';
 *   const Title = styled.h1`${type.h1}`;
 *
 * Headings (h1–h3) are uppercase with wide letter-spacing.
 * Body text (bodyLg–xs) is normal case.
 * Labels are uppercase small text.
 */
export const type = {
  /** Display / Page heading — 3rem, uppercase, wide spacing */
  h1: `
    font-family: ${fonts.main};
    font-size: var(--type-h1);
    letter-spacing: 3px;
    text-transform: uppercase;
    line-height: 1.1;
  `,
  /** Section heading — 2rem, uppercase */
  h2: `
    font-family: ${fonts.main};
    font-size: var(--type-h2);
    letter-spacing: 2px;
    text-transform: uppercase;
    line-height: 1.2;
  `,
  /** Subsection heading — 1.5rem, uppercase */
  h3: `
    font-family: ${fonts.main};
    font-size: var(--type-h3);
    letter-spacing: 1px;
    text-transform: uppercase;
    line-height: 1.2;
  `,
  /** Large body text — 1.2rem */
  bodyLg: `
    font-family: ${fonts.main};
    font-size: var(--type-body-lg);
    line-height: 1.4;
  `,
  /** Base body text — 1rem */
  body: `
    font-family: ${fonts.main};
    font-size: var(--type-body);
    line-height: 1.4;
  `,
  /** Small text — 0.85rem */
  small: `
    font-family: ${fonts.main};
    font-size: var(--type-small);
    line-height: 1.3;
  `,
  /** Extra-small text — 0.75rem */
  xs: `
    font-family: ${fonts.main};
    font-size: var(--type-xs);
    letter-spacing: 0.5px;
    line-height: 1.3;
  `,
  /** Uppercase label — small, wide-spaced, uppercase */
  label: `
    font-family: ${fonts.main};
    font-size: var(--type-xs);
    letter-spacing: 1px;
    text-transform: uppercase;
    line-height: 1.3;
  `,
} as const;

/**
 * CSS custom property declarations to inject into :root via GlobalStyle.
 * This string can be spread directly into a createGlobalStyle block.
 */
export const cssTokens = `
  /* Colors — Surfaces */
  --color-bg: ${colors.bg};
  --color-surface: ${colors.surface};
  --color-surface-raised: ${colors.surfaceRaised};
  --color-surface-inset: ${colors.surfaceInset};
  --color-surface-overlay: ${colors.surfaceOverlay};
  --color-surface-overlay-heavy: ${colors.surfaceOverlayHeavy};

  /* Colors — Borders */
  --color-border: ${colors.border};
  --color-border-subtle: ${colors.borderSubtle};
  --color-border-strong: ${colors.borderStrong};
  --color-border-focus: ${colors.borderFocus};

  /* Colors — Text */
  --color-text: ${colors.text};
  --color-text-bright: ${colors.textBright};
  --color-text-muted: ${colors.textMuted};
  --color-text-subtle: ${colors.textSubtle};
  --color-text-dim: ${colors.textDim};
  --color-text-disabled: ${colors.textDisabled};
  --color-text-inverse: ${colors.textInverse};

  /* Colors — Accents */
  --color-accent-green: ${colors.accentGreen};
  --color-accent-green-dim: ${colors.accentGreenDim};
  --color-accent-cyan: ${colors.accentCyan};
  --color-accent-cyan-dim: ${colors.accentCyanDim};
  --color-accent-red: ${colors.accentRed};
  --color-accent-red-bright: ${colors.accentRedBright};
  --color-accent-gold: ${colors.accentGold};
  --color-accent-gold-dim: ${colors.accentGoldDim};
  --color-accent-orange: ${colors.accentOrange};
  --color-accent-blue: ${colors.accentBlue};

  /* Colors — Semantic */
  --color-success: ${colors.success};
  --color-danger: ${colors.danger};
  --color-danger-bg: ${colors.dangerBg};
  --color-danger-bg-subtle: ${colors.dangerBgSubtle};
  --color-warning: ${colors.warning};
  --color-warning-bg: ${colors.warningBg};

  /* Colors — Player / Partner / System */
  --color-player-text: ${colors.playerText};
  --color-player-bg: ${colors.playerBg};
  --color-player-name: ${colors.playerName};
  --color-partner-text: ${colors.partnerText};
  --color-partner-bg: ${colors.partnerBg};
  --color-partner-name: ${colors.partnerName};
  --color-partner-border: ${colors.partnerBorder};
  --color-system-text: ${colors.systemText};
  --color-system-bg: ${colors.systemBg};
  --color-suspect-name: ${colors.suspectName};

  /* Colors — Officer / Secure Line */
  --color-officer-bg: ${colors.officerBg};
  --color-officer-surface: ${colors.officerSurface};
  --color-officer-border: ${colors.officerBorder};
  --color-officer-text: ${colors.officerText};
  --color-officer-accent: ${colors.officerAccent};
  --color-officer-button: ${colors.officerButton};
  --color-officer-button-hover: ${colors.officerButtonHover};

  /* Colors — Evidence / Polaroid */
  --color-polaroid-bg: ${colors.polaroidBg};
  --color-polaroid-shadow: ${colors.polaroidShadow};
  --color-evidence-yellow: ${colors.evidenceYellow};
  --color-evidence-border: ${colors.evidenceBorder};
  --color-evidence-collected: ${colors.evidenceCollected};
  --color-note-yellow: ${colors.noteYellow};

  /* Colors — Accent extras */
  --color-accent-green-dark: ${colors.accentGreenDark};

  /* Spacing */
  --space: ${SPACE}px;

  /* Fonts */
  --font-main: ${fonts.main};
  --font-handwritten: ${fonts.handwritten};
`;
