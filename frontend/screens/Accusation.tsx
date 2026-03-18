
import React, { useState } from 'react';
import { type } from '../theme';
import styled from 'styled-components';
import { Suspect } from '../types';
import SuspectPortrait from '../components/SuspectPortrait';

interface AccusationProps {
  suspects: Suspect[];
  onAccuse: (suspectIds: string[]) => void;
  onBack: () => void;
}

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  flex-direction: column;
  gap: calc(var(--space) * 3);
  background: radial-gradient(circle, #220000 0%, #000000 80%);
  padding: calc(var(--space) * 3) 0;

  @media (max-width: 768px) {
    padding: 20px 0;
  }
`;

const Title = styled.h2`
  ${type.h2}
  color: #ff0000;
  text-shadow: 0 0 10px #ff0000;
  text-transform: uppercase;
  margin: 0;
  text-align: center;

  @media (max-width: 768px) {
    padding: 0 20px;
  }
`;

const SubTitle = styled.p`
  color: #aaa;
  margin-top: -10px;
  ${type.body}
  text-align: center;

  @media (max-width: 768px) {
    padding: 0 20px;
  }
`;

const ScrollContainer = styled.div`
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  padding: calc(var(--space) * 5);
  width: 100%;
  align-items: center;
  
  /* Scrollbar Styling */
  &::-webkit-scrollbar {
    height: 10px;
  }
  &::-webkit-scrollbar-track {
    background: #111;
  
  }
  &::-webkit-scrollbar-thumb {
    background: #500; 
  
    border: 1px solid #111;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: #f00; 
  }
`;

const ScrollInner = styled.div`
  display: flex;
  gap: calc(var(--space) * 5);
  margin: 0 auto;
  align-items: center;

  @media (max-width: 768px) {
    gap: calc(var(--space) * 3);
    padding: 0 calc(var(--space) * 3);
  }
`;

const SuspectItem = styled.div<{ $selected?: boolean }>`
  cursor: pointer;
  text-align: center;
  flex: 0 0 auto; /* Prevent shrinking, forces scroll */
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: ${props => props.$selected ? 'scale(1.1)' : 'scale(1)'};
  border: ${props => props.$selected ? '4px solid var(--color-accent-red)' : 'none'};

  @media (hover: hover) {
    &:hover {
      transform: scale(1.1);
      z-index: 10;
    }
  }
  
  h3 {
    margin-top: calc(var(--space) * 2);
    color: var(--color-text-bright);
    text-transform: uppercase;
    ${type.h3}
    text-shadow: 0 2px 4px #000;
    background: rgba(0,0,0,0.5);
    padding: 0 var(--space);
  }
`;

const CancelButton = styled.button`
  background: transparent;
  color: var(--color-text-subtle);
  border: 1px solid var(--color-border-strong);
  padding: var(--space) calc(var(--space) * 4);
  cursor: pointer;
  font-family: inherit;
  ${type.bodyLg}
  margin-top: calc(var(--space) * 3);
  text-transform: uppercase;
  transition: all 0.2s;

  &:hover {
    color: var(--color-text-bright);
    border-color: var(--color-text-bright);
    background: rgba(255,255,255,0.1);
  }
`;

const AccuseButton = styled(CancelButton)`
  background: #800;
  color: var(--color-text-bright);
  border-color: var(--color-accent-red);
`;

const Accusation: React.FC<AccusationProps> = ({ suspects, onAccuse, onBack }) => {
  // Filter out the victim (isDeceased) so they cannot be accused
  const accusableSuspects = suspects.filter(s => !s.isDeceased);

  const [selectedSuspectIds, setSelectedSuspectIds] = useState<string[]>([]);

  const toggleSuspect = (id: string) => {
    setSelectedSuspectIds(prev =>
      prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
    );
  };

  const handleAccuse = () => {
    onAccuse(selectedSuspectIds);
  };

  return (
    <Container>
      <Title>MAKE YOUR ACCUSATION</Title>
      <SubTitle>Select the perpetrator(s) to close the case, or accuse nobody. This action is final.</SubTitle>

      <ScrollContainer>
        <ScrollInner>
          {accusableSuspects.map(s => (
            <SuspectItem
              key={s.id}
              onClick={() => toggleSuspect(s.id)}
              data-cursor="pointer"
              $selected={selectedSuspectIds.includes(s.id)}
            >
              <SuspectPortrait
                suspect={s}
                size={250}
              />
              <h3>{s.name}</h3>
            </SuspectItem>
          ))}
        </ScrollInner>
      </ScrollContainer>

      <AccuseButton onClick={handleAccuse}>
        {selectedSuspectIds.length > 0
          ? `[ ACCUSE ${selectedSuspectIds.length} SUSPECT(S) ]`
          : '[ ACCUSE NOBODY ]'
        }
      </AccuseButton>

      <CancelButton onClick={onBack}>
        [ CANCEL ]
      </CancelButton>
    </Container>
  );
};

export default Accusation;
