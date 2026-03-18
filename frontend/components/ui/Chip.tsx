/**
 * Chip — Reusable chip/badge/tag primitives.
 *
 * SuggestionChip:  rounded pill for chat suggestions
 * Badge:           status label (FEATURED, LIVE, DRAFT)
 * Tag:             metadata tag with border
 * AttachmentChip:  dashed border chip for evidence attachments
 * EvidenceChip:    animated chip for new evidence discovery
 */

import styled from 'styled-components';

export const SuggestionChip = styled.button`
  background: var(--color-border-subtle);
  border: 1px solid var(--color-border-strong);
  color: var(--color-text-muted);
  padding: calc(var(--space) * 0.625) calc(var(--space) * 1.25);
  border-radius: 15px;
  font-family: var(--font-main);
  font-size: var(--type-body);
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    border-color: var(--color-text-subtle);
    color: var(--color-text-bright);
  }
`;

export const Badge = styled.span<{ $bg: string; $color: string }>`
  background: ${props => props.$bg};
  color: ${props => props.$color};
  padding: 2px var(--space);
  font-size: var(--type-small);
  font-weight: bold;
  text-transform: uppercase;
`;

export const Tag = styled.span<{ $color?: string }>`
  background: var(--color-border-subtle);
  color: ${props => props.$color || 'var(--color-text-muted)'};
  padding: 2px calc(var(--space) * 0.75);
  font-size: var(--type-small);
  border: 1px solid var(--color-border);
  text-transform: uppercase;
`;

export const AttachmentChip = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space);
  background: #1a1a1a;
  border: 1px dashed var(--color-border-strong);
  color: var(--color-text-bright);
  padding: calc(var(--space) * 0.5) calc(var(--space) * 1.25);
  font-size: var(--type-small);

  button {
    background: transparent;
    border: none;
    color: var(--color-accent-red-bright);
    font-weight: bold;
    cursor: pointer;
    font-size: var(--type-body);
    padding: 0;
    line-height: 1;
  }
`;

export const EvidenceChip = styled.div<{ $collected: boolean }>`
  margin-top: var(--space);
  background: ${props => props.$collected ? 'var(--color-success)' : '#ffc'};
  color: var(--color-text-inverse);
  border: 2px dashed ${props => props.$collected ? 'var(--color-success)' : '#cc0'};
  padding: calc(var(--space) * 0.625) calc(var(--space) * 1.25);
  font-size: var(--type-small);
  font-weight: bold;
  cursor: ${props => props.$collected ? 'default' : 'pointer'};
  display: inline-block;
  align-self: flex-start;
  animation: fadeIn 0.5s;

  &:hover {
    background: ${props => props.$collected ? 'var(--color-success)' : 'var(--color-text-bright)'};
  }

  &::before {
    content: '${props => props.$collected ? '✓ EVIDENCE LOGGED: ' : '⚠ NEW EVIDENCE: '} ';
  }
`;
