
import React from 'react';
import styled from 'styled-components';
import { Evidence, Suspect } from '../types';

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
  flex-direction: column;
  gap: 8px;
  border-bottom: 1px dashed #333;
  
  &:hover {
    background: #1a1a1a;
  }
`;

const CardTop = styled.div`
  display: flex;
  gap: 10px;
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
  min-width: 0;
`;

const TitleInput = styled.input`
  background: transparent;
  border: none;
  border-bottom: 1px solid #333;
  color: #fff;
  font-family: inherit;
  font-weight: bold;
  font-size: var(--type-body);
  width: 100%;
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
  resize: none;
  padding: 2px 0;
  field-sizing: content;
  
  &:focus { outline: none; color: #ddd; }
  &::placeholder { color: #444; }
`;

const CardBottom = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 10px;
`;

const OwnerSelect = styled.select`
  background: #0a0a0a;
  color: #888;
  border: 1px solid #333;
  font-family: inherit;
  font-size: var(--type-small);
  padding: 3px 22px 3px 6px;
  border-radius: 3px;
  cursor: pointer;
  max-width: 180px;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath fill='%23888888' d='M4 5L0 0h8z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  background-size: 8px;

  &:focus { outline: none; border-color: #0f0; color: #ccc; }
`;

const RemoveButton = styled.button`
  background: transparent;
  color: #555;
  border: 1px solid #333;
  cursor: pointer;
  font-family: inherit;
  font-size: var(--type-small);
  padding: 4px 10px;
  border-radius: 4px;
  transition: all 0.2s;
  text-transform: uppercase;
  font-weight: bold;
  white-space: nowrap;
  flex-shrink: 0;
  
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

/** Ownership key: 'initial' for initial evidence, or the suspect's ID */
type OwnerKey = 'initial' | string;

interface EvidenceEditorProps {
  label: string;
  evidenceList: Evidence[];
  onChange: (newList: Evidence[]) => void;
  onRerollImage?: (ev: Evidence) => void;
  /** Current owner key – 'initial' or a suspect ID */
  ownerKey?: OwnerKey;
  /** All suspects (for ownership dropdown options) */
  suspects?: Suspect[];
  /** Callback when evidence should be transferred to a different owner */
  onTransferEvidence?: (evidence: Evidence, fromOwner: OwnerKey, toOwner: OwnerKey) => void;
}

const EvidenceEditor: React.FC<EvidenceEditorProps> = ({
  label,
  evidenceList = [],
  onChange,
  onRerollImage,
  ownerKey,
  suspects,
  onTransferEvidence,
}) => {

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

  const showOwnership = ownerKey !== undefined && suspects && onTransferEvidence;

  return (
    <Container>
      <Header>
        <label>{label}</label>
        <AddButton onClick={handleAdd}>+ ADD CARD</AddButton>
      </Header>
      {evidenceList.map((ev, i) => (
        <EvidenceCard key={ev.id || i}>
          <CardTop>
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
          </CardTop>

          <CardBottom>
            {showOwnership ? (
              <OwnerSelect
                value={ownerKey}
                onChange={(e) => {
                  const newOwner = e.target.value as OwnerKey;
                  if (newOwner !== ownerKey) {
                    onTransferEvidence(ev, ownerKey!, newOwner);
                  }
                }}
                title="Evidence owner"
              >
                <option value="initial">Initial Evidence</option>
                {suspects!.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.isDeceased ? ' (Victim)' : ''}{s.isGuilty ? ' ★' : ''}
                  </option>
                ))}
              </OwnerSelect>
            ) : (
              <span />
            )}
            <RemoveButton onClick={() => handleDelete(i)} title="Remove Item">
              REMOVE
            </RemoveButton>
          </CardBottom>
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
