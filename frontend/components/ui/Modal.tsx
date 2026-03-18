/**
 * Modal — Reusable overlay and modal box primitives.
 *
 * Overlay:        full-screen darkened backdrop
 * ModalBox:       centered container with border and glow
 * ModalTitle:     styled heading for modals
 * ModalText:      body text for modals
 * ModalButtonRow: flex row for modal action buttons
 */

import styled from 'styled-components';
import { media, type } from '../../theme';

export const Overlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-surface-overlay-heavy);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  flex-direction: column;
  gap: calc(var(--space) * 2.5);
`;

export const ModalBox = styled.div<{ $borderColor?: string; $glowColor?: string }>`
  background: var(--color-surface-inset);
  border: 2px solid ${props => props.$borderColor || 'var(--color-danger)'};
  padding: calc(var(--space) * 3.75);
  width: 500px;
  max-width: 90%;
  display: flex;
  flex-direction: column;
  gap: calc(var(--space) * 2.5);
  box-shadow: 0 0 30px ${props => props.$glowColor || 'var(--color-danger-bg)'};
  text-align: center;
`;

export const ModalTitle = styled.h2<{ $color?: string }>`
  ${type.h2}
  color: ${props => props.$color || 'var(--color-danger)'};
  margin: 0;
  text-shadow: 0 0 10px ${props => props.$color || 'var(--color-danger)'};
`;

export const ModalText = styled.p`
  ${type.bodyLg}
  color: var(--color-text);
  margin: 0;
`;

export const ModalButtonRow = styled.div`
  display: flex;
  gap: calc(var(--space) * 2.5);
  justify-content: center;
  margin-top: calc(var(--space) * 1.25);
`;
