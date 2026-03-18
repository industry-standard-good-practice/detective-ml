
import React, { useState, useEffect } from 'react';
import { type } from '../theme';
import styled, { keyframes } from 'styled-components';

const scanline = keyframes`
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
`;

const flash = keyframes`
  0%, 50%, 100% { opacity: 1; }
  25%, 75% { opacity: 0; }
`;

const popIn = keyframes`
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
`;

const spin = keyframes`
  0% { transform: rotateY(0deg); }
  100% { transform: rotateY(360deg); }
`;

const Container = styled.div`
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 5, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  overflow: hidden;
  pointer-events: auto;
  cursor: pointer;
  flex-direction: column;
  gap: calc(var(--space) * 3);
`;

const ScanlineLayer = styled.div`
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: linear-gradient(to bottom, transparent 50%, rgba(0, 0, 0, 0.5) 51%);
  background-size: 100% 4px;
  pointer-events: none;
  z-index: 10;
  opacity: 0.3;
`;

const MovingScanline = styled.div`
  position: absolute;
  top: 0; left: 0; width: 100%; height: 20%;
  background: linear-gradient(to bottom, transparent, rgba(0, 255, 0, 0.2), transparent);
  animation: ${scanline} 2s linear infinite;
  pointer-events: none;
  z-index: 11;
`;

const EvidenceBox = styled.div`
  width: 400px;
  max-width: 90%;
  border: 4px double #0f0;
  background: #001100;
  padding: calc(var(--space) * 4);
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  box-shadow: 0 0 30px #0f0, inset 0 0 20px #0f0;
  animation: ${popIn} 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);

  &::before {
    content: '';
    position: absolute;
    top: -5px; left: -5px;
    width: 20px; height: 20px;
    border-top: 4px solid #0f0;
    border-left: 4px solid #0f0;
  }
  &::after {
    content: '';
    position: absolute;
    bottom: -5px; right: -5px;
    width: 20px; height: 20px;
    border-bottom: 4px solid #0f0;
    border-right: 4px solid #0f0;
  }
`;

const Header = styled.h1`
  color: #0f0;
  font-family: 'VT323', monospace;
  ${type.h1}
  margin: 0;
  text-transform: uppercase;
  text-shadow: 0 0 10px #0f0;
  animation: ${flash} 2s infinite;
  text-align: center;
`;

const IconWrapper = styled.div`
  width: 150px;
  height: 150px;
  margin: 20px 0;
  border: 2px solid #050;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    box-shadow: inset 0 0 20px rgba(0, 255, 0, 0.3);
  }
`;

const PixelIcon = styled.div`
  ${type.h1}
  color: #0f0;
  text-shadow: 2px 2px 0 #030;
  animation: ${spin} 3s infinite linear;
`;

const EvidenceName = styled.h2`
  color: #fff;
  font-family: 'VT323', monospace;
  ${type.h2}
  margin: 0;
  text-transform: uppercase;
  text-align: center;
  letter-spacing: 2px;
`;

const SubText = styled.div`
  color: #0a0;
  ${type.body}
  margin-top: var(--space);
  text-transform: uppercase;
`;

const ContinueText = styled.div`
  margin-top: calc(var(--space) * 4);
  color: #0f0;
  ${type.bodyLg}
  animation: ${flash} 1s infinite;
  cursor: pointer;
  
  &:hover {
    text-decoration: underline;
  }
`;

interface AsciiCelebrationProps {
  evidenceName: string;
  evidenceImage?: string;
  onComplete: () => void;
}

const AsciiCelebration: React.FC<AsciiCelebrationProps> = ({ evidenceName, evidenceImage, onComplete }) => {
  return (
    <Container onClick={onComplete} data-cursor="pointer">
      <ScanlineLayer />
      <MovingScanline />
      
      <EvidenceBox>
        <Header>EVIDENCE ACQUIRED</Header>
        
        <IconWrapper>
          {evidenceImage ? (
             <img 
               src={evidenceImage} 
               alt="Evidence" 
               style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }} 
             />
          ) : (
             <PixelIcon>💾</PixelIcon>
          )}
        </IconWrapper>
        
        <EvidenceName>"{evidenceName}"</EvidenceName>
        <SubText>Logged to Case File</SubText>
        
        <ContinueText>[ CLICK TO DISMISS ]</ContinueText>
      </EvidenceBox>
    </Container>
  );
};

export default AsciiCelebration;
