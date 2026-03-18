
import React from 'react';
import styled from 'styled-components';
import { Evidence, Suspect } from '../types';
import { TextInput, TextArea, Select, Button } from './ui';
import { ImageSlot } from './ui/PixelImage';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: calc(var(--space) * 1.25);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: calc(var(--space) * 0.625);

  label {
    color: var(--color-text-disabled);
    font-size: var(--type-small);
    text-transform: uppercase;
  }
`;

const AddButton = styled(Button).attrs({ $variant: 'accent' as const })`
  padding: calc(var(--space) * 0.5) calc(var(--space) * 1.25);
  font-size: var(--type-small);
  border-radius: 4px;
`;

const EvidenceCard = styled.div`
  background: #151515;
  padding: calc(var(--space) * 1.25);
  display: flex;
  flex-direction: column;
  gap: var(--space);
  border-bottom: 1px dashed var(--color-border);

  &:hover {
    background: #1a1a1a;
  }
`;

const CardTop = styled.div`
  display: flex;
  gap: calc(var(--space) * 1.25);
`;

const RerollButton = styled.button`
  background: rgba(0,0,0,0.7);
  color: var(--color-text-bright);
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
  gap: calc(var(--space) * 0.625);
  min-width: 0;
`;

const CardBottom = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: calc(var(--space) * 1.25);
`;

const RemoveButton = styled(Button).attrs({ $variant: 'ghost' as const })`
  color: var(--color-text-disabled);
  border: 1px solid var(--color-border);
  padding: calc(var(--space) * 0.5) calc(var(--space) * 1.25);
  font-size: var(--type-small);
  border-radius: 4px;

  &:hover {
    color: var(--color-accent-red-bright);
    border-color: var(--color-accent-red-bright);
    background: rgba(255, 85, 85, 0.15);
  }
  
  @media (max-width: 768px) {
    color: var(--color-accent-red-bright);
    border-color: var(--color-accent-red-bright);
  }
`;

const EmptyState = styled.div`
  color: var(--color-text-dim);
  font-style: italic;
  padding: calc(var(--space) * 1.25);
  border: 1px dashed var(--color-border);
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
              <TextInput
                value={ev.title}
                onChange={(e) => handleChange(i, 'title', e.target.value)}
                placeholder="Title"
              />
              <TextArea
                value={ev.description}
                onChange={(e) => handleChange(i, 'description', e.target.value)}
                placeholder="Description..."
              />
            </ContentCol>
          </CardTop>

          <CardBottom>
            {showOwnership ? (
              <Select
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
              </Select>
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
        <EmptyState>No evidence items listed.</EmptyState>
      )}
    </Container>
  );
};

export default EvidenceEditor;
