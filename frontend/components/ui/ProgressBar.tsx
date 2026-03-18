/**
 * ProgressBar — Reusable progress/meter bar.
 *
 * Color thresholds: normal (< 50) → warning (51-80) → danger (> 80).
 * Used for the aggravation meter in Interrogation.
 */

import styled from 'styled-components';

export const ProgressBar = styled.div<{ $level: number }>`
  height: 20px;
  width: 100%;
  background: var(--color-border-subtle);
  position: relative;

  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${props => props.$level}%;
    background: ${props =>
      props.$level > 80 ? 'var(--color-danger)' :
      props.$level > 50 ? 'var(--color-accent-orange)' :
      'var(--color-text)'};
    transition: width 0.5s ease, background 0.5s ease;
    background-image: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 5px,
      rgba(0,0,0,0.2) 5px,
      rgba(0,0,0,0.2) 10px
    );
  }
`;

export default ProgressBar;
