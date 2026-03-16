
import React from 'react';
import styled from 'styled-components';
import { Evidence } from '../types';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
  
  label {
    color: #555;
    font-size: var(--type-small);
    text-transform: uppercase;
  }
`;

const AddButton = styled.button`
  background: transparent;
  color: #0f0;
  border: 1px solid #0f0;
  cursor: pointer;
  padding: 4px 10px;
  font-family: inherit;
  font-size: var(--type-small);
  font-weight: bold;
  text-transform: uppercase;
  border-radius: 4px;
  transition: all 0.2s;
  
  &:hover { background: rgba(0, 255, 0, 0.1); }
`;

const EvidenceCard = styled.div`
  background: #151515;
  padding: 10px;
  display: flex;
  gap: 10px;
  position: relative;
  border-bottom: 1px dashed #333;
  
  &:hover {
    background: #1a1a1a;
  }
`;

const ImageSlot = styled.div<{ $src?: string }>`
  width: 60px;
  height: 60px;
  background-color: #000;
  background-image: ${props => props.$src ? `url(${props.$src})` : 'none'};
  background-size: cover;
  background-position: center;
  border: 1px solid #444;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  image-rendering: pixelated;
`;

const RerollButton = styled.button`
  background: rgba(0,0,0,0.7);
  color: #fff;
  border: none;
  font-size: var(--type-small);
  padding: 2px;
  cursor: pointer;
  width: 100%;
  text-align: center;
  
  &:hover { background: rgba(50,50,50,0.9); }
`;

const ContentCol = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const DeleteButton = styled.button`
  position: absolute;
  top: 5px;
  right: 5px;
  background: transparent;
  color: #555;
  border: 1px solid #333;
  cursor: pointer;
  font-family: inherit;
  font-size: var(--type-body);
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 4px;
  line-height: 0;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    color: #f55;
    border-color: #f55;
    background: rgba(255, 85, 85, 0.15);
  }
  
  @media (max-width: 768px) {
    color: #f55;
    border-color: #f55;
  }
`;

const XIcon = styled.span`
  display: inline-block;
  width: 10px;
  height: 10px;
  position: relative;
  flex-shrink: 0;
  
  &::before, &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100%;
    height: 2px;
    background: currentColor;
    border-radius: 1px;
  }
  &::before { transform: translate(-50%, -50%) rotate(45deg); }
  &::after { transform: translate(-50%, -50%) rotate(-45deg); }
`;

const TitleInput = styled.input`
  background: transparent;
  border: none;
  border-bottom: 1px solid #333;
  color: #fff;
  font-family: inherit;
  font-weight: bold;
  font-size: var(--type-body);
  width: 90%;
  padding: 2px 0;
  
  &:focus { outline: none; border-bottom-color: #0f0; }
  &::placeholder { color: #444; }
`;

const DescInput = styled.textarea`
  background: transparent;
  border: none;
  color: #aaa;
  font-family: inherit;
  font-size: var(--type-small);
  resize: vertical;
  min-height: 40px;
  padding: 2px 0;
  
  &:focus { outline: none; color: #ddd; }
  &::placeholder { color: #444; }
`;

interface EvidenceEditorProps {
  label: string;
  evidenceList: Evidence[];
  onChange: (newList: Evidence[]) => void;
  onRerollImage?: (ev: Evidence) => void;
}

const EvidenceEditor: React.FC<EvidenceEditorProps> = ({ label, evidenceList = [], onChange, onRerollImage }) => {
  
  const handleChange = (index: number, field: 'title' | 'description', value: string) => {
    const newList = [...evidenceList];
    newList[index] = { ...newList[index], [field]: value };
    onChange(newList);
  };

  const handleAdd = () => {
    onChange([...evidenceList, {
      id: `new-${Date.now()}`,
      title: "New Item",
      description: "Description...",
      imageUrl: undefined
    }]);
  };

  const handleDelete = (index: number) => {
    const newList = [...evidenceList];
    newList.splice(index, 1);
    onChange(newList);
  };

  return (
    <Container>
      <Header>
        <label>{label}</label>
        <AddButton onClick={handleAdd}>+ ADD CARD</AddButton>
      </Header>
      {evidenceList.map((ev, i) => (
        <EvidenceCard key={ev.id || i}>
          <DeleteButton onClick={() => handleDelete(i)} title="Remove Item"><XIcon /></DeleteButton>
          
          <ImageSlot $src={ev.imageUrl}>
             {onRerollImage && (
               <RerollButton onClick={() => onRerollImage(ev)} title="Generate new pixel art">
                 REROLL
               </RerollButton>
             )}
          </ImageSlot>

          <ContentCol>
            <TitleInput 
              value={ev.title} 
              onChange={(e) => handleChange(i, 'title', e.target.value)} 
              placeholder="Title"
            />
            <DescInput 
              value={ev.description} 
              onChange={(e) => handleChange(i, 'description', e.target.value)}
              placeholder="Description..."
            />
          </ContentCol>
        </EvidenceCard>
      ))}
      {evidenceList.length === 0 && (
          <div style={{ color: '#444', fontStyle: 'italic', padding: '10px', border: '1px dashed #333' }}>
              No evidence items listed.
          </div>
      )}
    </Container>
  );
};

export default EvidenceEditor;
