/**
 * Select — Reusable styled dropdown.
 *
 * Custom arrow indicator, consistent dark theme styling.
 * Used for ownership dropdowns, voice selectors, etc.
 */

import styled from 'styled-components';
import { type } from '../../theme';

export const Select = styled.select`
  ${type.small}
  background: var(--color-surface);
  color: var(--color-text-subtle);
  border: 1px solid var(--color-border);
  padding: 0 calc(var(--space) * 3) 0 var(--space);
  cursor: pointer;
  max-width: 180px;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath fill='%23888888' d='M4 5L0 0h8z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  background-size: 8px;

  &:focus {
    outline: none;
    border-color: var(--color-accent-green);
    color: var(--color-text);
  }
`;

export default Select;
