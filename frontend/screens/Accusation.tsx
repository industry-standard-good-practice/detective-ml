
import React, { useState } from 'react';
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
  gap: 20px;
  background: radial-gradient(circle, #220000 0%, #000000 80%);
  padding: 20px;

  @media (max-width: 768px) {
    padding: 20px 0;
  }
`;

const Title = styled.h2`
  font-size: var(--type-h2);
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
  font-size: var(--type-body);
  text-align: center;

  @media (max-width: 768px) {
    padding: 0 20px;
  }
`;

const ScrollContainer = styled.div`
  display: flex;
  overflow-x: auto;
  padding: 40px;
  width: 100%;
  align-items: center;
  
  /* Scrollbar Styling */
  &::-webkit-scrollbar {
    height: 10px;
  }
  &::-webkit-scrollbar-track {
    background: #111;
    border-radius: 5px;
  }
  &::-webkit-scrollbar-thumb {
    background: #500; 
    border-radius: 5px;
    border: 1px solid #111;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: #f00; 
  }
`;

const ScrollInner = styled.div`
  display: flex;
  gap: 40px;
  margin: 0 auto;
  align-items: center;

  @media (max-width: 768px) {
    gap: 20px;
    padding: 0 20px;
  }
`;

const SuspectItem = styled.div`
  cursor: pointer;
  text-align: center;
  flex: 0 0 auto; /* Prevent shrinking, forces scroll */
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex;
  flex-direction: column;
  align-items: center;

  &:hover {
    transform: scale(1.1);
    z-index: 10;
  }
  
  h3 {
    margin-top: 15px;
    color: #fff;
    text-transform: uppercase;
    font-size: var(--type-h3);
    text-shadow: 0 2px 4px #000;
    background: rgba(0,0,0,0.5);
    padding: 2px 10px;
    border-radius: 4px;
  }
`;

const CancelButton = styled.button`
  background: transparent;
  color: #888;
  border: 1px solid #444;
  padding: 10px 30px;
  cursor: pointer;
  font-family: inherit;
  font-size: var(--type-body-lg);
  margin-top: 20px;
  text-transform: uppercase;
  transition: all 0.2s;

  &:hover {
    color: #fff;
    border-color: #fff;
    background: rgba(255,255,255,0.1);
  }
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
              style={{ 
                transform: selectedSuspectIds.includes(s.id) ? 'scale(1.1)' : 'scale(1)',
                border: selectedSuspectIds.includes(s.id) ? '4px solid #f00' : 'none',
                borderRadius: '8px'
              }}
            >
              <SuspectPortrait 
                suspect={s} 
                size={250} 
                style={{ 
                  border: '4px solid #fff', 
                  width: '250px', 
                  height: '250px', 
                  objectFit: 'cover', 
                  boxShadow: '0 0 30px rgba(0,0,0,0.8)' 
                }} 
              />
              <h3>{s.name}</h3>
            </SuspectItem>
          ))}
        </ScrollInner>
      </ScrollContainer>
      
      <CancelButton onClick={handleAccuse} style={{ background: '#800', color: '#fff', borderColor: '#f00' }}>
        {selectedSuspectIds.length > 0 
          ? `[ ACCUSE ${selectedSuspectIds.length} SUSPECT(S) ]`
          : '[ ACCUSE NOBODY ]'
        }
      </CancelButton>
      
      <CancelButton onClick={onBack}>
        [ CANCEL ]
      </CancelButton>
    </Container>
  );
};

export default Accusation;
