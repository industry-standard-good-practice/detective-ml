
import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { Evidence, Suspect } from '../types';
import { TextInput, TextArea, Button } from './ui';
import { ImageSlot } from './ui/PixelImage';
import { type } from '../theme';

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
    ${type.label}
    color: var(--color-text-disabled);
  }
`;

const AddButton = styled(Button).attrs({ $variant: 'accent' as const })`
  ${type.small}
  padding: calc(var(--space) * 0.5) calc(var(--space) * 1.25);
`;

const EvidenceCard = styled.div`
  background: var(--color-surface-raised);
  padding: calc(var(--space) * 1.25);
  display: flex;
  flex-direction: column;
  gap: var(--space);
  border-bottom: 1px dashed var(--color-border);
`;

const CardTop = styled.div`
  display: flex;
  gap: calc(var(--space) * 1.25);
`;

const RerollButton = styled.button`
  ${type.small}
  background: rgba(0,0,0,0.7);
  color: var(--color-text-bright);
  border: none;
  padding: 0;
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
  ${type.small}
  color: var(--color-text-disabled);
  border: 1px solid var(--color-border);
  padding: calc(var(--space) * 0.5) calc(var(--space) * 1.25);
  

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
  ${type.body}
  color: var(--color-text-dim);
  font-style: italic;
  padding: calc(var(--space) * 1.25);
  border: 1px dashed var(--color-border);
`;

/* ─── Custom Ownership Dropdown ─── */

const DropdownWrapper = styled.div`
  position: relative;
`;

const DropdownTrigger = styled.button`
  ${type.small}
  background: var(--color-surface-inset);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  padding: var(--space) calc(var(--space) * 3) var(--space) var(--space);
  cursor: pointer;
  text-align: left;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  position: relative;
  text-transform: none;

  /* Dropdown arrow */
  &::after {
    content: '▼';
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    ${type.xs}
    color: var(--color-text-dim);
    pointer-events: none;
  }

  &:hover {
    border-color: var(--color-border-strong);
    color: var(--color-text);
  }
`;

const DropdownMenu = styled.div`
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  background: var(--color-surface-inset);
  border: 1px solid var(--color-border-strong);
  min-width: 200px;
  max-height: 250px;
  overflow-y: auto;
  z-index: 50;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.6);

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background: var(--color-border); }
`;

const DropdownOption = styled.button<{ $active?: boolean }>`
  ${type.small}
  background: ${props => props.$active ? 'var(--color-accent-green-dark)' : 'transparent'};
  color: ${props => props.$active ? 'var(--color-accent-green)' : 'var(--color-text-muted)'};
  border: none;
  border-bottom: 1px solid var(--color-border-subtle);
  padding: var(--space) calc(var(--space) * 2);
  text-align: left;
  cursor: pointer;
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space);
  text-transform: none;

  &:last-child { border-bottom: none; }

  &:hover {
    background: var(--color-border-subtle);
    color: var(--color-text-bright);
  }
`;

const ActiveDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-accent-green);
  flex-shrink: 0;
`;

/** Ownership key: 'initial' for initial evidence, or the suspect's ID */
type OwnerKey = 'initial' | string;

interface OwnershipDropdownProps {
  value: OwnerKey;
  suspects: Suspect[];
  onChange: (newOwner: OwnerKey) => void;
}

const OwnershipDropdown: React.FC<OwnershipDropdownProps> = ({ value, suspects, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const currentLabel = value === 'initial'
    ? 'Initial Evidence'
    : suspects.find(s => s.id === value)?.name || value;

  return (
    <DropdownWrapper ref={ref}>
      <DropdownTrigger onClick={() => setOpen(!open)} title="Evidence owner">
        {currentLabel}
      </DropdownTrigger>
      {open && (
        <DropdownMenu>
          <DropdownOption
            $active={value === 'initial'}
            onClick={() => { onChange('initial'); setOpen(false); }}
          >
            {value === 'initial' && <ActiveDot />}
            Initial Evidence
          </DropdownOption>
          {suspects.map(s => (
            <DropdownOption
              key={s.id}
              $active={value === s.id}
              onClick={() => { onChange(s.id); setOpen(false); }}
            >
              {value === s.id && <ActiveDot />}
              {s.name}{s.isDeceased ? ' (Victim)' : ''}{s.isGuilty ? ' ★' : ''}
            </DropdownOption>
          ))}
        </DropdownMenu>
      )}
    </DropdownWrapper>
  );
};

/* ─── Main Component ─── */

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
              <OwnershipDropdown
                value={ownerKey!}
                suspects={suspects!}
                onChange={(newOwner) => {
                  if (newOwner !== ownerKey) {
                    onTransferEvidence(ev, ownerKey!, newOwner);
                  }
                }}
              />
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
