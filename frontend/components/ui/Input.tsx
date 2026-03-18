/**
 * Input — Reusable text input and textarea primitives.
 *
 * GhostInput:    transparent, border-less inline input (chat input bar)
 * TextInput:     underline-style input (title fields)
 * TextArea:      auto-sizing textarea (descriptions, notes)
 * ChatInput:     bordered input for modal chat (officer line)
 */

import styled from 'styled-components';
import { media } from '../../theme';

export const GhostInput = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  color: var(--color-text-bright);
  font-family: var(--font-main);
  font-size: var(--type-body-lg);
  padding: 0 calc(var(--space) * 2);
  height: 100%;
  min-width: 0;

  &:focus { outline: none; }
  &::placeholder { color: var(--color-border); }
  &:disabled { color: var(--color-danger-bg); cursor: not-allowed; }
`;

export const TextInput = styled.input`
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-bright);
  font-family: var(--font-main);
  font-weight: bold;
  font-size: var(--type-body);
  width: 100%;
  padding: 2px 0;

  &:focus { outline: none; border-bottom-color: var(--color-accent-green); }
  &::placeholder { color: var(--color-text-dim); }
`;

export const TextArea = styled.textarea`
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  font-family: var(--font-main);
  font-size: var(--type-small);
  resize: none;
  padding: 2px 0;
  field-sizing: content;

  &:focus { outline: none; color: var(--color-text); }
  &::placeholder { color: var(--color-text-dim); }
`;

export const ChatInput = styled.input`
  flex: 1;
  background: var(--color-surface-inset);
  border: 1px solid var(--color-border-strong);
  color: var(--color-text);
  padding: var(--space);
  font-family: var(--font-main);
  font-size: var(--type-body);

  &:focus { outline: none; border-color: var(--color-text-subtle); }
`;
