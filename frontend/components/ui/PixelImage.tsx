/**
 * PixelImage — Reusable pixel-art image wrapper.
 *
 * Renders a div with a background-image, pixelated rendering,
 * and consistent border styling. Used for evidence photos,
 * suspect portraits, case cards, and lightbox views.
 */

import styled from 'styled-components';
import { type } from '../../theme';

export const PixelImage = styled.div<{ $src?: string; $size?: string }>`
  ${type.label}
  width: ${props => props.$size || '100%'};
  aspect-ratio: 1;
  background-color: var(--color-border);
  background-image: ${props => props.$src && props.$src !== 'PLACEHOLDER' ? `url(${props.$src})` : 'none'};
  background-size: cover;
  background-position: center;
  image-rendering: pixelated;
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-subtle);
  flex-shrink: 0;
`;

/** Smaller image slot for inline evidence previews */
export const ImageSlot = styled(PixelImage)`
  width: 60px;
  height: 60px;
  aspect-ratio: auto;
  background-color: var(--color-bg);
  border-color: var(--color-border-strong);
  flex-direction: column;
  justify-content: flex-end;
`;

export default PixelImage;
