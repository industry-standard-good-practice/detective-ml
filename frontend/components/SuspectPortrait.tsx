import React, { useState, useEffect } from 'react';
import { type } from '../theme';
import styled from 'styled-components';
import { Suspect, Emotion } from '../types';
import { getSuspectPortrait } from '../services/geminiService';

const Container = styled.div<{ $size?: number }>`
  width: ${props => props.$size ? `${props.$size}px` : '100%'};
  height: ${props => props.$size ? `${props.$size}px` : '100%'};
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  background-color: var(--color-bg);
`;

const Img = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
`;

const Placeholder = styled.div`
  width: 100%;
  height: 100%;
  background: var(--color-surface-raised);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-border);
  font-family: 'VT323', monospace;
  ${type.small}
  text-transform: uppercase;
  text-align: center;
  padding: var(--space);
`;

interface SuspectPortraitProps {
  suspect: Suspect;
  emotion?: Emotion;
  aggravation?: number;
  size?: number;
  turnId?: string;
  style?: React.CSSProperties;
  className?: string;
}

const SuspectPortrait: React.FC<SuspectPortraitProps> = ({ 
  suspect, 
  emotion = Emotion.NEUTRAL, 
  aggravation = 0, 
  size,
  turnId,
  style, 
  className 
}) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const load = async () => {
      try {
        const url = await getSuspectPortrait(suspect, emotion, aggravation, turnId);
        if (mounted) {
          setImgSrc(url);
        }
      } catch (e) {
        console.error("Portrait load error", e);
      }
    };

    load();

    return () => { mounted = false; };
  }, [suspect, emotion, aggravation, turnId, suspect.avatarSeed, suspect.portraits]);

  return (
    <Container $size={size} style={style} className={className}>
      {imgSrc ? (
        <Img src={imgSrc} alt={suspect.name} />
      ) : (
        <Placeholder>LOADING...</Placeholder>
      )}
    </Container>
  );
};

export default SuspectPortrait;