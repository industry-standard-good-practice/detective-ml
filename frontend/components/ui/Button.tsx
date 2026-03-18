/**
 * Button — Reusable button primitive with variants.
 *
 * Variants:
 *   - ghost:   transparent bg, subtle border, muted text (default nav/menu buttons)
 *   - primary: white bg, dark text (send / submit actions)
 *   - danger:  red-tinted bg, red border (delete / destructive)
 *   - accent:  green/cyan-tinted accent (upload / feature / publish)
 *   - icon:    minimal padding, icon-only (close / plus buttons)
 */

import styled, { css } from 'styled-components';
import { media, type } from '../../theme';

export type ButtonVariant = 'ghost' | 'primary' | 'danger' | 'accent' | 'icon';

const variantStyles: Record<ButtonVariant, ReturnType<typeof css>> = {
  ghost: css`
    background: transparent;
    border: none;
    color: var(--color-text-muted);

    &:hover:not(:disabled) {
      color: var(--color-text-bright);
      text-shadow: 0 0 5px var(--color-text-bright);
    }
  `,
  primary: css`
    background: var(--color-text-bright);
    color: var(--color-text-inverse);
    border: none;
    font-weight: bold;

    &:hover:not(:disabled) {
      background: var(--color-text);
    }

    &:disabled {
      background: var(--color-border-subtle);
      color: var(--color-text-disabled);
    }
  `,
  danger: css`
    background: var(--color-danger-bg);
    color: var(--color-text-bright);
    border: 1px solid var(--color-danger);

    &:hover:not(:disabled) {
      background: var(--color-danger);
      box-shadow: 0 0 15px var(--color-danger);
    }
  `,
  accent: css`
    background: transparent;
    color: var(--color-accent-green);
    border: 1px solid var(--color-accent-green);

    &:hover:not(:disabled) {
      background: rgba(0, 255, 0, 0.1);
    }
  `,
  icon: css`
    background: transparent;
    border: none;
    color: var(--color-text-dim);
    padding: var(--space);
    min-width: 0;

    &:hover:not(:disabled) {
      color: var(--color-text-bright);
      text-shadow: 0 0 5px var(--color-text-bright);
    }
  `,
};

export const Button = styled.button<{ $variant?: ButtonVariant }>`
  ${type.bodyLg}
  text-transform: uppercase;
  cursor: pointer;
  padding: calc(var(--space) * 1.25) calc(var(--space) * 2.5);
  transition: all 0.2s;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space);

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  ${props => variantStyles[props.$variant || 'ghost']}
`;

export default Button;
