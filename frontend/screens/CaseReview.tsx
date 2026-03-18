
import React, { useState, useEffect, useRef } from 'react';
import { type } from '../theme';
import styled, { keyframes } from 'styled-components';
import toast from 'react-hot-toast';
import Markdown from 'react-markdown';
import { CaseData, Suspect, Emotion, Evidence, Relationship, TimelineEvent } from '../types';
import { TTS_VOICES, getRandomVoice } from '../constants';
import { generateTTS } from '../services/geminiTTS';
import { playAudioFromUrl } from '../services/audioPlayer';
import { pregenerateCaseImages, generateEvidenceImage, regenerateSingleSuspect, checkCaseConsistency, editCaseWithPrompt, generateSuspectFromUpload, calculateDifficulty, editImageWithPrompt, generateEmotionalVariantsFromBase } from '../services/geminiService';
import EvidenceEditor from '@/components/EvidenceEditor';
import SuspectPortrait from '@/components/SuspectPortrait';
import ExitCaseDialog from '@/components/ExitCaseDialog';
import ImageEditorModal from '@/components/ImageEditorModal';
import { PIXEL_ART_BASE } from '@/services/geminiStyles';

const Container = styled.div`
  display: flex;
  height: 100%;
  padding: 20px var(--screen-edge-horizontal) calc(var(--screen-edge-bottom) + 20px) var(--screen-edge-horizontal);
  gap: calc(var(--space) * 3);
  position: relative;

  @media (max-width: 1080px) {
    flex-direction: column;
    padding: 10px var(--screen-edge-horizontal) calc(var(--screen-edge-bottom) + 20px) var(--screen-edge-horizontal);
    gap: 0;
  }
`;

const MobileTabBar = styled.div`
  display: none;
  
  @media (max-width: 1080px) {
    display: flex;
    gap: 0;
    margin-bottom: var(--space);
    flex-shrink: 0;
  }
`;

const MobileTab = styled.button<{ $active: boolean }>`
  flex: 1;
  background: ${props => props.$active ? 'var(--color-surface-raised)' : 'var(--color-surface)'};
  border: 1px solid ${props => props.$active ? 'var(--color-accent-green)' : 'var(--color-border)'};
  border-bottom: ${props => props.$active ? '2px solid var(--color-accent-green)' : '1px solid var(--color-border)'};
  color: ${props => props.$active ? 'var(--color-accent-green)' : 'var(--color-text-dim)'};
  font-family: inherit;
  ${type.body}
  padding: var(--space);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.2s;
`;

const Panel = styled.div<{ $mobileHidden?: boolean }>`
  flex: 1;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: calc(var(--space) * 3);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  gap: calc(var(--space) * 3);

  @media (max-width: 1080px) {
    display: ${props => props.$mobileHidden ? 'none' : 'flex'};
    padding: calc(var(--space) * 2);
    min-height: 0;
    flex: 1;
    overflow-x: hidden;
  }
`;

const LeftColumn = styled.div<{ $mobileHidden?: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: var(--space);

  @media (max-width: 1080px) {
    display: ${props => props.$mobileHidden ? 'none' : 'flex'};
    flex: 1;
  }
`;

const DesktopOnly = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space);
  flex-shrink: 0;

  @media (max-width: 1080px) {
    display: none;
  }
`;

const MobileOnly = styled.div`
  display: none;

  @media (max-width: 1080px) {
    display: flex;
    flex-direction: column;
    gap: var(--space);
    margin-top: auto;
    padding-top: var(--space);
  }
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space);
  min-width: 0;

  label {
    color: var(--color-text-disabled);
    ${type.small}
    text-transform: uppercase;
  }

  input, textarea, select {
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    font-family: inherit;
    padding: var(--space);
    ${type.body}
    box-sizing: border-box;
    max-width: 100%;

    &:focus {
      border-color: var(--color-text-subtle);
      outline: none;
    }

    &::-webkit-calendar-picker-indicator {
      filter: invert(0.85);
    }
  }

  select {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23ffffff' d='M6 8L0 0h12z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    background-size: 10px;
    padding-right: calc(var(--space) * 4);
  }

  textarea {
    resize: none;
    padding: var(--space);
    field-sizing: content;
  }
`;

// --- NEW STYLED INPUTS FOR CONSISTENCY ---

const StyledInput = styled.input`
  background: var(--color-surface-raised);
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  font-family: inherit;
  padding: var(--space);
  ${type.body}
  width: 100%;
  
  &:focus {
    border-bottom-color: var(--color-accent-green);
    background: var(--color-surface-raised);
    outline: none;
  }
`;

const StyledTextArea = styled.textarea`
  background: var(--color-surface-raised);
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  font-family: inherit;
  padding: var(--space);
  ${type.body}
  resize: none;
  width: 100%;
  field-sizing: content;
  
  &:focus {
    border-bottom-color: var(--color-accent-green);
    background: var(--color-surface-raised);
    outline: none;
  }
`;

const ModuleContainer = styled.div`
  padding: 5px 0;
  display: flex;
  flex-direction: column;
  gap: calc(var(--space) * 2);
`;

const ModuleItem = styled.div`
  border-bottom: 1px dashed var(--color-border);
  padding-bottom: calc(var(--space) * 2);
  &:last-child { border-bottom: none; padding-bottom: 0; }
  display: flex;
  flex-direction: column;
  gap: var(--space);
`;

// -----------------------------------------

const SuspectList = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space); 
`;

const SuspectRow = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: var(--space);
  padding: var(--space);
  background: ${props => props.$selected ? 'var(--color-border-subtle)' : '#0f0f0f'};
  border: 1px solid ${props => props.$selected ? 'var(--color-text-bright)' : 'var(--color-border)'};
  cursor: pointer;

  &:hover {
    background: var(--color-border-subtle);
  }
`;

const ActionButtons = styled.div`
  margin-top: auto;
  display: flex;
  gap: var(--space);
`;

const StartButton = styled.button`
  flex: 1;
  background: #0d0;
  color: var(--color-text-inverse);
  border: none;
  padding: calc(var(--space) * 2);
  font-family: inherit;
  ${type.bodyLg}
  font-weight: bold;
  cursor: pointer;

  &:hover {
    background: #5f5;
  }
`;

// --- SUSPECT EDITOR LAYOUT ---

const SuspectEditorRow = styled.div`
  display: flex;
  gap: var(--space);

  @media (max-width: 1080px) {
    flex-direction: column;
  }
`;

const PortraitCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space);
  width: 120px;
  flex-shrink: 0;

  @media (max-width: 1080px) {
    width: 100%;
  }
`;

const PortraitBtnGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space);

  @media (max-width: 1080px) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space);
  }
`;

const InputsCol = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space);
`;

const RandomizeButton = styled.button`
  background: var(--color-border);
  color: var(--color-text-bright);
  border: 1px solid var(--color-border-strong);
  cursor: pointer;
  padding: var(--space) calc(var(--space) * 2);
  font-family: inherit;
  ${type.small}
  width: 100%;
  transition: all 0.2s;
  
  &:hover { background: var(--color-border-strong); }
  &:disabled { opacity: 0.5; cursor: wait; }
`;

const UploadButton = styled.button`
  background: #234;
  color: #adf;
  border: 1px solid #456;
  cursor: pointer;
  padding: var(--space) calc(var(--space) * 2);
  font-family: inherit;
  ${type.small}
  width: 100%;
  transition: all 0.2s;
  
  &:hover { background: #345; }
  &:disabled { opacity: 0.5; cursor: wait; }
`;

const CameraButton = styled.button`
  background: #422;
  color: #fa0;
  border: 1px solid #633;
  cursor: pointer;
  padding: var(--space) calc(var(--space) * 2);
  font-family: inherit;
  ${type.small}
  width: 100%;
  transition: all 0.2s;
  
  &:hover { background: #533; }
  &:disabled { opacity: 0.5; cursor: wait; }
`;

const RetryButton = styled.button`
  background: #0e0e0e;
  color: var(--color-accent-cyan);
  border: 1px dashed #088;
  padding: calc(var(--space) * 2);
  font-family: inherit;
  ${type.body}
  cursor: pointer;
  margin-bottom: var(--space);
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: #002222;
    border-color: #0ff;
    box-shadow: 0 0 10px rgba(0, 255, 255, 0.1);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: wait;
  }
`;

const UtilityButton = styled.button<{ $danger?: boolean }>`
  background: ${props => props.$danger ? '#300' : 'var(--color-border-subtle)'};
  color: ${props => props.$danger ? 'var(--color-accent-red-bright)' : '#ccc'};
  border: 1px solid ${props => props.$danger ? '#500' : 'var(--color-border)'};
  padding: var(--space);
  cursor: pointer;
  font-family: inherit;
  ${type.small}
  text-transform: uppercase;
  
  &:hover {
    background: ${props => props.$danger ? '#500' : '#333'};
    color: var(--color-text-bright);
  }
`;

const SaveButton = styled.button`
  background: #004400;
  color: var(--color-accent-green);
  border: 1px solid var(--color-accent-green);
  padding: calc(var(--space) * 2);
  font-family: inherit;
  ${type.body}
  font-weight: bold;
  cursor: pointer;
  text-transform: uppercase;

  &:hover {
    background: #006600;
    color: var(--color-text-bright);
  }
  
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Fieldset = styled.fieldset`
  border: none;
  border-top: 1px solid var(--color-border);
  padding: 15px 0 0 0;
  margin: 20px 0 0 0;
  background: transparent;
  
  legend {
    color: var(--color-text-subtle);
    padding: 0 10px 0 0;
    ${type.small}
    text-transform: uppercase;
    font-weight: bold;
  }
`;

const SmallButton = styled.button<{ $active?: boolean }>`
  background: ${props => props.$active ? '#3b82f6' : '#333'};
  color: ${props => props.$active ? 'var(--color-text-bright)' : '#ccc'};
  border: 1px solid ${props => props.$active ? '#60a5fa' : 'var(--color-border-strong)'};
  cursor: pointer;
  padding: var(--space) var(--space);
  ${type.small}
  font-family: inherit;
  transition: all 0.2s;
  &:hover { background: ${props => props.$active ? '#2563eb' : '#555'}; }
`;

const DeleteButton = styled.button`
  background: transparent;
  color: var(--color-text-disabled);
  border: 1px solid var(--color-border);
  cursor: pointer;
  padding: var(--space) calc(var(--space) * 2);
  ${type.small}
  font-family: inherit;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space);
  flex-shrink: 0;
  text-transform: uppercase;
  font-weight: bold;
  line-height: 1;
  text-align: center;
  
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
  }
  &::before { transform: translate(-50%, -50%) rotate(45deg); }
  &::after { transform: translate(-50%, -50%) rotate(-45deg); }
`;

const ToggleButton = styled.button<{ $active?: boolean }>`
  background: ${props => props.$active ? 'rgba(255, 85, 85, 0.15)' : 'transparent'};
  color: ${props => props.$active ? 'var(--color-accent-red-bright)' : 'var(--color-text-disabled)'};
  border: 1px solid ${props => props.$active ? 'var(--color-accent-red-bright)' : 'var(--color-border)'};
  cursor: pointer;
  padding: var(--space) calc(var(--space) * 2);
  ${type.small}
  font-family: inherit;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: var(--space);
  text-transform: uppercase;
  font-weight: bold;
  flex-shrink: 0;
  line-height: 1;
  text-align: center;
  
  &:hover {
    color: ${props => props.$active ? 'var(--color-accent-red-bright)' : 'var(--color-text-bright)'};
    border-color: ${props => props.$active ? 'var(--color-accent-red-bright)' : 'var(--color-text-subtle)'};
    background: ${props => props.$active ? 'rgba(255, 85, 85, 0.15)' : 'rgba(255,255,255,0.1)'};
  }
`;

const HeroImageModuleWrapper = styled.div`
  container-type: inline-size;
  margin-bottom: var(--space);
`;

const HeroImageModuleInner = styled.div`
  display: flex;
  gap: calc(var(--space) * 2);
  align-items: stretch;
  background: rgba(255,255,255,0.03);
  padding: calc(var(--space) * 2);
  border: 1px solid rgba(255,255,255,0.05);

  @container (max-width: 450px) {
    flex-direction: column;
  }
`;

const HeroImagePreview = styled.div<{ $imageUrl?: string }>`
  width: 50%;
  aspect-ratio: 1 / 1;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  background-image: ${props => props.$imageUrl ? `url(${props.$imageUrl})` : 'none'};
  background-size: cover;
  background-position: center;
  image-rendering: pixelated;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-border);
  ${type.xs}
  overflow: hidden;

  @container (max-width: 450px) {
    width: 100%;
    max-height: 280px;
  }
`;

const HeroImageControls = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: calc(var(--space) * 2);

  @container (max-width: 450px) {
    width: 100%;
  }
`;

// --- MODAL STYLES ---

const Overlay = styled.div`
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  flex-direction: column;
  gap: calc(var(--space) * 3);
`;

const rotate = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const Spinner = styled.div`
  width: 50px;
  height: 50px;
  border: 4px solid var(--color-border);
  border-top-color: var(--color-accent-green);
  border-radius: 50%;
  animation: ${rotate} 1s linear infinite;
`;

const LoadingText = styled.div`
  color: var(--color-accent-green);
  ${type.bodyLg}
  font-family: inherit;
  text-transform: uppercase;
`;

// --- CAMERA OVERLAY ---

const CameraOverlay = styled.div`
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 2000;
`;

const VideoPreview = styled.video`
  width: 100%;
  max-width: 600px;
  max-height: 70%;
  border: 2px solid var(--color-accent-green);
  background: var(--color-surface-raised);
  box-shadow: 0 0 20px var(--color-accent-green);
`;

const CameraControls = styled.div`
  display: flex;
  gap: calc(var(--space) * 3);
  margin-top: calc(var(--space) * 3);
`;

const SnapButton = styled.button`
  width: 80px;
  height: 80px;
  background: var(--color-accent-red);
  border: 4px solid var(--color-text-bright);
  cursor: pointer;
  box-shadow: 0 0 10px var(--color-accent-red);
  
  &:hover { transform: scale(1.1); }
  &:active { transform: scale(0.95); }
`;

interface CaseReviewProps {
  draftCase: CaseData;
  onUpdateDraft: (updated: CaseData) => void;
  onStart: () => void;
  onCancel: () => void;
  userId?: string;
  userDisplayName?: string;
  onRegisterSave?: (saveFn: () => Promise<void>) => void;
  onRegisterCheckConsistency?: (fn: () => void) => void;
  onRegisterClose?: (fn: () => void) => void;
  onHasUnsavedChanges?: (hasChanges: boolean) => void;
}

const CaseReview: React.FC<CaseReviewProps> = ({ draftCase, onUpdateDraft, onStart, onCancel, userId, userDisplayName, onRegisterSave, onRegisterCheckConsistency, onRegisterClose, onHasUnsavedChanges }) => {
  const [selectedSuspectId, setSelectedSuspectId] = useState<string | null>(draftCase.suspects?.[0]?.id || 'officer');
  const [loadingState, setLoadingState] = useState<{ visible: boolean, message: string, step?: string, stepDetail?: string }>({ visible: false, message: '' });
  const [showCamera, setShowCamera] = useState(false);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [showSuspectEditor, setShowSuspectEditor] = useState(false);
  const [showHeroEditor, setShowHeroEditor] = useState(false);
  const [heroMode, setHeroMode] = useState<'suspect' | 'evidence' | 'custom'>('custom');
  const [editPrompt, setEditPrompt] = useState('');
  const [mobileTab, setMobileTab] = useState<'case' | 'suspects'>('case');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const initialDraftCase = useRef(draftCase);
  const baselineRef = useRef<CaseData>(JSON.parse(JSON.stringify(draftCase)));
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);



  useEffect(() => {
    const changed = JSON.stringify(draftCase) !== JSON.stringify(initialDraftCase.current);
    setHasUnsavedChanges(changed);
    onHasUnsavedChanges?.(changed);
  }, [draftCase]);

  // Expose save function to parent
  useEffect(() => {
    onRegisterSave?.(() => handleSave());
  });

  // Expose check consistency to parent
  useEffect(() => {
    onRegisterCheckConsistency?.(() => handleCheckConsistency());
  });

  // Expose close/cancel to parent (respects unsaved changes dialog)
  useEffect(() => {
    onRegisterClose?.(() => handleCancel());
  });

  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setShowCancelDialog(true);
    } else {
      onCancel();
    }
  };

  const activeSuspect = selectedSuspectId === 'officer' ? draftCase.officer :
    selectedSuspectId === 'partner' ? draftCase.partner :
      draftCase.suspects?.find(s => s.id === selectedSuspectId);
  const isSupportChar = selectedSuspectId === 'officer' || selectedSuspectId === 'partner';

  // --- AUTOMATIC DIFFICULTY CALCULATION ---
  useEffect(() => {
    const newDifficulty = calculateDifficulty(draftCase);
    if (newDifficulty !== draftCase.difficulty) {
      onUpdateDraft({ ...draftCase, difficulty: newDifficulty });
    }
  }, [draftCase.suspects, draftCase.initialEvidence]);

  // --- DERIVED DATA ---
  const deceasedSuspect = draftCase.suspects?.find(s => s.isDeceased);
  const otherSuspects = draftCase.suspects?.filter(s => s.id !== activeSuspect?.id) || [];

  const relationshipTargets: string[] = [];
  if (activeSuspect) {
    if (!isSupportChar && !(activeSuspect as Suspect).isDeceased) {
      // Only show "The Victim" slot if the case has a victim
      if (draftCase.hasVictim !== false) {
        relationshipTargets.push("The Victim");
      }
      // Plus other ALIVE suspects
      otherSuspects.forEach(s => {
        if (!s.isDeceased) relationshipTargets.push(s.name);
      });
    } else {
      // The victim has relationships with all ALIVE suspects
      otherSuspects.forEach(s => {
        if (!s.isDeceased) relationshipTargets.push(s.name);
      });
    }
  }

  const handleCaseChange = (field: keyof CaseData, value: any) => {
    onUpdateDraft({ ...draftCase, [field]: value });
  };

  const handleSuspectChange = (id: string, field: string, value: any) => {
    if (id === 'officer') {
      const overrides: any = { [field]: value };
      if (field === 'avatarSeed') overrides.portraits = {};
      onUpdateDraft({ ...draftCase, officer: { ...draftCase.officer, ...overrides } });
      return;
    }
    if (id === 'partner') {
      const overrides: any = { [field]: value };
      if (field === 'avatarSeed') overrides.portraits = {};
      onUpdateDraft({ ...draftCase, partner: { ...draftCase.partner, ...overrides } });
      return;
    }
    const updatedSuspects = (draftCase.suspects || []).map(s => {
      if (s.id === id) {
        const overrides: any = { [field]: value };
        if (field === 'avatarSeed') {
          overrides.portraits = {};
        }
        return { ...s, ...overrides };
      }
      return s;
    });
    onUpdateDraft({ ...draftCase, suspects: updatedSuspects });
  };

  const handleRelationshipChange = (targetName: string, field: 'type' | 'description', value: string) => {
    if (!activeSuspect || isSupportChar) return;
    const currentSuspect = activeSuspect as Suspect;
    let newRels = [...(currentSuspect.relationships || [])];
    const index = newRels.findIndex(r => r.targetName === targetName);

    if (index >= 0) {
      newRels[index] = { ...newRels[index], [field]: value };
    } else {
      newRels.push({
        targetName,
        type: field === 'type' ? value : 'Acquaintance',
        description: field === 'description' ? value : ''
      });
    }
    handleSuspectChange(activeSuspect.id, 'relationships', newRels);
  };

  const updateTimeline = (index: number, key: keyof TimelineEvent, val: string) => {
    if (!activeSuspect || isSupportChar) return;
    const currentSuspect = activeSuspect as Suspect;
    const newTime = [...currentSuspect.timeline];
    newTime[index] = { ...newTime[index], [key]: val };
    handleSuspectChange(activeSuspect.id, 'timeline', newTime);
  };

  const addTimelineEvent = () => {
    if (!activeSuspect || isSupportChar) return;
    const currentSuspect = activeSuspect as Suspect;
    handleSuspectChange(activeSuspect.id, 'timeline', [...currentSuspect.timeline, { time: "12:00 PM", activity: "Doing something", day: "Today", dayOffset: 0 }]);
  };

  const removeTimelineEvent = (index: number) => {
    if (!activeSuspect || isSupportChar) return;
    const currentSuspect = activeSuspect as Suspect;
    const newTime = [...currentSuspect.timeline];
    newTime.splice(index, 1);
    handleSuspectChange(activeSuspect.id, 'timeline', newTime);
  };

  const updateFact = (index: number, val: string) => {
    if (!activeSuspect || isSupportChar) return;
    const currentSuspect = activeSuspect as Suspect;
    const newFacts = [...currentSuspect.knownFacts];
    newFacts[index] = val;
    handleSuspectChange(activeSuspect.id, 'knownFacts', newFacts);
  };

  const addFact = () => {
    if (!activeSuspect || isSupportChar) return;
    const currentSuspect = activeSuspect as Suspect;
    handleSuspectChange(activeSuspect.id, 'knownFacts', [...currentSuspect.knownFacts, "New Fact"]);
  };

  const removeFact = (index: number) => {
    if (!activeSuspect || isSupportChar) return;
    const currentSuspect = activeSuspect as Suspect;
    const newFacts = [...currentSuspect.knownFacts];
    newFacts.splice(index, 1);
    handleSuspectChange(activeSuspect.id, 'knownFacts', newFacts);
  };

  const handleRerollEvidence = async (ev: Evidence, source: 'initial' | 'hidden', suspectId?: string) => {
    setLoadingState({ visible: true, message: `Rerolling evidence image: ${ev.title}...` });
    const updateImage = (url?: string) => {
      if (source === 'initial') {
        const newInit = (draftCase.initialEvidence || []).map(e => e.id === ev.id ? { ...e, imageUrl: url } : e);
        onUpdateDraft({ ...draftCase, initialEvidence: newInit });
      } else if (suspectId) {
        const newSuspects = (draftCase.suspects || []).map(s => {
          if (s.id === suspectId) {
            return {
              ...s,
              hiddenEvidence: (s.hiddenEvidence || []).map(e => e.id === ev.id ? { ...e, imageUrl: url } : e)
            };
          }
          return s;
        });
        onUpdateDraft({ ...draftCase, suspects: newSuspects });
      }
    };
    updateImage(undefined);
    const newUrl = await generateEvidenceImage(ev, draftCase.id, userId!);
    if (newUrl) {
      updateImage(newUrl);
    }
    setLoadingState({ visible: false, message: '' });
  };

  /** Transfer a single evidence item between owners (initial ↔ suspect) */
  const handleTransferEvidence = (evidence: Evidence, fromOwner: string, toOwner: string) => {
    let newInitial = [...(draftCase.initialEvidence || [])];
    let newSuspects = (draftCase.suspects || []).map(s => ({ ...s, hiddenEvidence: [...(s.hiddenEvidence || [])] }));

    // Remove from old owner
    if (fromOwner === 'initial') {
      newInitial = newInitial.filter(e => e.id !== evidence.id);
    } else {
      newSuspects = newSuspects.map(s =>
        s.id === fromOwner
          ? { ...s, hiddenEvidence: s.hiddenEvidence.filter(e => e.id !== evidence.id) }
          : s
      );
    }

    // Add to new owner
    if (toOwner === 'initial') {
      newInitial.push(evidence);
    } else {
      newSuspects = newSuspects.map(s =>
        s.id === toOwner
          ? { ...s, hiddenEvidence: [...s.hiddenEvidence, evidence] }
          : s
      );
    }

    onUpdateDraft({ ...draftCase, initialEvidence: newInitial, suspects: newSuspects });
  };

  const handleRetryAI = async () => {
    if (loadingState.visible) return;
    setLoadingState({ visible: true, message: "Initializing AI protocols..." });
    const clone: CaseData = JSON.parse(JSON.stringify(draftCase));
    clone.suspects.forEach(s => {
      const neutral = s.portraits?.[Emotion.NEUTRAL];
      if (!neutral || neutral.includes('dicebear')) {
        s.portraits = {};
      }
    });
    try {
      await pregenerateCaseImages(clone, (msg) => setLoadingState({ visible: true, message: msg }), userId!);
      onUpdateDraft(clone);
    } catch (e) {
      console.error("Retry failed", e);
    } finally {
      setLoadingState({ visible: false, message: '' });
    }
  };

  const handleSaveEditedSuspect = async (newImageUrl: string, onProgress?: (current: number, total: number) => void) => {
    if (!activeSuspect) return;
    try {
      const updatedPortraits = await generateEmotionalVariantsFromBase(newImageUrl, activeSuspect as any, draftCase.id, userId!, onProgress);
      handleSuspectChange(activeSuspect.id, 'portraits', updatedPortraits);
      setShowSuspectEditor(false);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleSaveHeroImage = async (newImageUrl: string) => {
    setLoadingState({ visible: true, message: "Uploading Hero Image..." });
    try {
      const { uploadImage } = await import('../services/firebase');
      const uploadedUrl = await uploadImage(newImageUrl, `images/${userId!}/cases/${draftCase.id}/hero.png`);
      handleCaseChange('heroImageUrl', uploadedUrl);
      setShowHeroEditor(false);
    } catch (err) {
      console.error("Hero image upload failed", err);
      toast.error('Failed to upload hero image.');
    } finally {
      setLoadingState({ visible: false, message: '' });
    }
  };

  const handleRerollPortrait = async () => {
    if (!activeSuspect) return;

    setLoadingState({ visible: true, message: "Generating base portrait..." });
    try {
      const { regenerateSingleSuspect } = await import('../services/geminiImages');
      const updatedChar = await regenerateSingleSuspect(
        activeSuspect as any,
        draftCase.id,
        userId!,
        draftCase.type,
        (progressMsg) => setLoadingState({ visible: true, message: progressMsg })
      );

      if (selectedSuspectId === 'officer') {
        onUpdateDraft({ ...draftCase, officer: updatedChar as any });
      } else if (selectedSuspectId === 'partner') {
        onUpdateDraft({ ...draftCase, partner: updatedChar as any });
      } else {
        const newSuspects = draftCase.suspects.map(s => s.id === updatedChar.id ? updatedChar as any : s);
        onUpdateDraft({ ...draftCase, suspects: newSuspects });
      }
      toast.success(`Portrait regenerated for ${activeSuspect.name}!`);
    } catch (e: any) {
      console.error("Single Reroll Failed", e);
      const errorMsg = e?.message || 'Unknown error';
      toast.error(`Portrait generation failed: ${errorMsg}`);
      // Fallback to just changing the seed if AI fails
      handleSuspectChange(activeSuspect.id, 'avatarSeed', Math.floor(Math.random() * 999999));
    } finally {
      setLoadingState({ visible: false, message: '' });
    }
  };

  // Shared Logic for processing user-supplied images (File or Camera)
  const processSuspectImage = async (base64: string) => {
    if (!activeSuspect) return;
    try {
      setLoadingState({ visible: true, message: "Converting to pixel art & generating emotions..." });
      const { generateSuspectFromUpload } = await import('../services/geminiImages');
      const updatedChar = await generateSuspectFromUpload(activeSuspect as any, base64, draftCase.id, userId!);

      if (selectedSuspectId === 'officer') {
        onUpdateDraft({ ...draftCase, officer: updatedChar as any });
      } else if (selectedSuspectId === 'partner') {
        onUpdateDraft({ ...draftCase, partner: updatedChar as any });
      } else {
        const newSuspects = draftCase.suspects.map(s => s.id === updatedChar.id ? updatedChar as any : s);
        onUpdateDraft({ ...draftCase, suspects: newSuspects });
      }
    } catch (err: any) {
      console.error(err);
      const errorMsg = err?.message || 'Unknown error';
      toast.error(`Image upload failed: ${errorMsg}`);
    } finally {
      setLoadingState({ visible: false, message: '' });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    setLoadingState({ visible: true, message: "Reading file..." });
    reader.onload = (event) => {
      if (!event.target?.result) return;
      processSuspectImage(event.target.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const triggerUpload = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  // --- CAMERA LOGIC ---

  const startCamera = async () => {
    try {
      setShowCamera(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Need to wait for ref to be attached to DOM
        setTimeout(() => {
          if (videoRef.current) videoRef.current.play();
        }, 100);
      }
    } catch (e) {
      console.error("Camera access denied", e);
      toast.error('Could not access camera. Please check browser permissions.');
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
    }
    setShowCamera(false);
  };

  const takePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const base64 = canvas.toDataURL('image/png');
      stopCamera();
      processSuspectImage(base64);
    }
  };

  const handleAddSuspect = () => {
    const newId = `s-${Date.now()}`;
    const newSuspect: Suspect = {
      id: newId,
      name: "Unknown Subject",
      gender: "Unknown",
      age: 30,
      role: "Witness",
      bio: "A mysterious figure.",
      personality: "Nervous",
      avatarSeed: Math.floor(Math.random() * 999999),
      baseAggravation: 10,
      isGuilty: false,
      secret: "None",
      hiddenEvidence: [],
      portraits: {},
      alibi: {
        statement: "I was nowhere near the scene.",
        isTrue: true,
        location: "Unknown",
        witnesses: []
      },
      motive: "None",
      relationships: [],
      timeline: [],
      knownFacts: [],
      professionalBackground: "Unknown",
      witnessObservations: "None",
      voice: getRandomVoice("Unknown")
    };

    onUpdateDraft({ ...draftCase, suspects: [...draftCase.suspects, newSuspect] });
    setSelectedSuspectId(newId);
  };

  const [suspectToDelete, setSuspectToDelete] = useState<Suspect | null>(null);

  const handleDeleteSuspect = () => {
    if (!activeSuspect || isSupportChar) return;
    setSuspectToDelete(activeSuspect as Suspect);
  };

  const confirmDeleteSuspect = () => {
    if (!suspectToDelete) return;
    const newSuspects = draftCase.suspects?.filter(s => s.id !== suspectToDelete.id) || [];
    onUpdateDraft({ ...draftCase, suspects: newSuspects });
    setSelectedSuspectId(newSuspects[0]?.id || null);
    setSuspectToDelete(null);
  };

  const [consistencyModal, setConsistencyModal] = useState<{ visible: boolean, report: any, updatedCase: CaseData | null, editReport?: any, editPrompt?: string }>({ visible: false, report: null, updatedCase: null });

  const handleSave = async () => {
    if (!userId) {
      toast.error('Cannot save: No user ID. Please log in and try again.');
      return;
    }
    setLoadingState({ visible: true, message: "Saving case..." });
    try {
      const { updateCase, saveLocalDraft } = await import('../services/persistence');

      // CRITICAL: Always stamp author identity before any save
      // Preserve existing author info if present; fall back to current user
      const stampedCase = {
        ...draftCase,
        authorId: draftCase.authorId || userId,
        authorDisplayName: draftCase.authorDisplayName || userDisplayName || 'Unknown Author'
      };

      // ALWAYS save locally first as a safety net (prevents data loss)
      saveLocalDraft(stampedCase);

      // Save to Firebase (private unless already published)
      const success = await updateCase(stampedCase.id, stampedCase);

      // Update the draft in parent state with stamped data
      onUpdateDraft(stampedCase);

      // Update refs so "unsaved changes" detection resets
      // NOTE: We intentionally do NOT reset baselineRef here.
      // baselineRef tracks changes since the last consistency check (or initial load),
      // so the AI knows what the user changed even across saves.
      initialDraftCase.current = stampedCase;
      // Explicitly clear unsaved state (useEffect won't re-run since draftCase didn't change)
      setHasUnsavedChanges(false);
      onHasUnsavedChanges?.(false);

      if (success) {
        toast.success("Case saved successfully!");
      } else {
        toast.error("Firebase save failed — saved locally as fallback.");
      }
    } catch (err: any) {
      console.error("[CRITICAL] handleSave error:", err);
      toast.error(`Save failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setLoadingState({ visible: false, message: '' });
    }
  };

  const handleCheckConsistency = async () => {
    setLoadingState({ visible: true, message: "Initializing Narrative Audit...", step: 'Step 1/1', stepDetail: 'Consistency Check' });

    try {
      const { updatedCase, report } = await checkCaseConsistency(draftCase, (msg) => {
        setLoadingState({ visible: true, message: msg, step: 'Step 1/1', stepDetail: 'Consistency Check' });
      }, baselineRef.current);

      setConsistencyModal({ visible: true, report, updatedCase });
    } catch (e) {
      console.error("Consistency Audit Failed:", e);
      toast.error('Failed to generate consistency report. Please try again.');
    } finally {
      setLoadingState({ visible: false, message: '' });
    }
  };

  const handleEditCase = async () => {
    if (!editPrompt.trim()) return;
    setLoadingState({ visible: true, message: "Initializing Case Transformation...", step: 'Step 1/2', stepDetail: 'Applying Edits' });

    try {
      const { updatedCase: editedCase, report: editReport } = await editCaseWithPrompt(draftCase, editPrompt, (msg) => {
        setLoadingState({ visible: true, message: msg, step: 'Step 1/2', stepDetail: 'Applying Edits' });
      }, baselineRef.current);

      // Run consistency check on the edited result — pass the original case as baseline
      // and the user's edit prompt so the consistency checker knows what was intentional
      setLoadingState({ visible: true, message: "Running full consistency audit...", step: 'Step 2/2', stepDetail: 'Consistency Check' });
      const { updatedCase, report: consistencyReport } = await checkCaseConsistency(editedCase, (msg) => {
        setLoadingState({ visible: true, message: msg, step: 'Step 2/2', stepDetail: 'Consistency Check' });
      }, draftCase, editPrompt);

      // Pass both reports to the modal — editReport for the primary "what changed" view,
      // consistencyReport as a secondary addendum
      setConsistencyModal({ visible: true, report: consistencyReport, updatedCase, editReport, editPrompt });
      setEditPrompt(''); // Clear prompt after success
    } catch (e) {
      console.error("Case Transformation Failed:", e);
      toast.error('Failed to transform case. Please try again.');
    } finally {
      setLoadingState({ visible: false, message: '' });
    }
  };

  const applyConsistencyChanges = () => {
    if (consistencyModal.updatedCase) {
      // Update the baseline to the new AI result so future diffs are correct
      baselineRef.current = JSON.parse(JSON.stringify(consistencyModal.updatedCase));
      onUpdateDraft(consistencyModal.updatedCase);
    }
    setConsistencyModal({ visible: false, report: '', updatedCase: null });
    toast.success("Changes applied! Remember to click 'Save' to persist.");
  };

  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
    };
  }, [voicePreviewUrl]);

  const handlePreviewVoice = async () => {
    if (!activeSuspect || !activeSuspect.voice || activeSuspect.voice === 'None' || isPreviewingVoice) return;

    // Look up the current character from the draft — check suspects, officer, and partner
    let currentChar: { name: string; role: string; voice: string } | undefined;
    if (selectedSuspectId === 'officer') {
      currentChar = draftCase.officer as any;
    } else if (selectedSuspectId === 'partner') {
      currentChar = draftCase.partner as any;
    } else {
      currentChar = draftCase.suspects?.find(s => s.id === selectedSuspectId) as any;
    }
    if (!currentChar || !currentChar.voice) return;

    setIsPreviewingVoice(true);
    try {
      const previewText = `My name is ${currentChar.name}. My role is ${currentChar.role}.`;
      console.log(`[TTS Preview] Generating for: "${previewText}" using voice: ${currentChar.voice}`);

      const audioUrl = await generateTTS(previewText, currentChar.voice);
      if (audioUrl) {
        // Cleanup old URL
        if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
        setVoicePreviewUrl(audioUrl);

        const audio = await playAudioFromUrl(audioUrl);
        // Audio is already playing after await resolves
      } else {
        console.error("TTS generation returned no URL");
      }
    } catch (err) {
      console.error("Voice preview error:", err);
    } finally {
      setIsPreviewingVoice(false);
    }
  };

  return (
    <Container ref={containerRef}>
      {loadingState.visible && (
        <Overlay>
          {loadingState.step && (
            <div style={{
              color: '#666',
              fontSize: 'var(--type-small)',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              marginBottom: 'var(--space)'
            }}>
              {loadingState.step}
              {loadingState.stepDetail && <span style={{ color: '#888', marginLeft: 'var(--space)' }}>— {loadingState.stepDetail}</span>}
            </div>
          )}
          <Spinner />
          <LoadingText>{loadingState.message}</LoadingText>
          <div style={{
            color: '#555',
            fontSize: 'var(--type-small)',
            maxWidth: '320px',
            textAlign: 'center',
            lineHeight: 1.5,
            marginTop: 'var(--space)'
          }}>
            Analyzing the full case narrative, evidence, timelines, and character relationships. This can take a few minutes.
          </div>
        </Overlay>
      )}

      {showCamera && (
        <CameraOverlay>
          <h2 style={{ color: '#0f0', textShadow: '0 0 10px #0f0' }}>SUBJECT ACQUISITION MODE</h2>
          <VideoPreview ref={videoRef} autoPlay playsInline muted />
          <CameraControls>
            <UtilityButton onClick={stopCamera} style={{ fontSize: 'var(--type-body-lg)', padding: '10px 30px' }}>CANCEL</UtilityButton>
            <SnapButton onClick={takePhoto} title="CAPTURE IMAGE" />
          </CameraControls>
        </CameraOverlay>
      )}

      {showSuspectEditor && activeSuspect && (
        <ImageEditorModal
          title={activeSuspect.portraits?.[Emotion.NEUTRAL] ? `Edit ${activeSuspect.name}` : `Create ${activeSuspect.name}`}
          initialImageUrl={activeSuspect.portraits?.[Emotion.NEUTRAL] || undefined}
          onClose={() => setShowSuspectEditor(false)}
          onSave={handleSaveEditedSuspect}
          aspectRatio="3:4"
        />
      )}

      {showHeroEditor && (
        <ImageEditorModal
          title="Generate Hero Image"
          initialImageUrl={draftCase.heroImageUrl || 'https://picsum.photos/seed/detective/800/450'}
          onClose={() => setShowHeroEditor(false)}
          onSave={handleSaveHeroImage}
          aspectRatio="16:9"
        />
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleImageUpload}
      />



      {/* Mobile Tab Bar */}
      <MobileTabBar>
        <MobileTab $active={mobileTab === 'case'} onClick={() => setMobileTab('case')}>CASE DETAILS</MobileTab>
        <MobileTab $active={mobileTab === 'suspects'} onClick={() => setMobileTab('suspects')}>SUSPECTS</MobileTab>
      </MobileTabBar>

      {/* LEFT: Case Details */}
      <LeftColumn $mobileHidden={mobileTab !== 'case'}>
        <Panel $mobileHidden={mobileTab !== 'case'}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: '#fff' }}>Case Details</h2>
            {draftCase.version && (
              <span style={{ color: '#555', fontSize: 'var(--type-small)', border: '1px solid #333', padding: '2px 8px' }}>
                VERSION {draftCase.version}
              </span>
            )}
          </div>

          <InputGroup>
            <label>Case Title</label>
            <input
              value={draftCase.title || ''}
              onChange={(e) => handleCaseChange('title', e.target.value)}
            />
          </InputGroup>

          <InputGroup>
            <label>Crime Type</label>
            <input
              value={draftCase.type || ''}
              onChange={(e) => handleCaseChange('type', e.target.value)}
            />
          </InputGroup>

          <InputGroup>
            <label>Briefing / Description</label>
            <textarea
              value={draftCase.description || ''}
              onChange={(e) => handleCaseChange('description', e.target.value)}
            />
          </InputGroup>

          <InputGroup>
            <label>Investigation Start Time</label>
            <div style={{ display: 'flex', gap: 'var(--space)', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="e.g. 'September 12, 1924 at 11:30 PM' or '5 ABY, late evening'"
                value={draftCase.startTime || ''}
                onChange={(e) => handleCaseChange('startTime', e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                type="datetime-local"
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                id="startTimePicker"
                onChange={(e) => {
                  if (!e.target.value) return;
                  // Only update if the user actually picked a different value
                  if (e.target.value === e.target.dataset.prevValue) return;
                  const d = new Date(e.target.value);
                  if (isNaN(d.getTime())) return;
                  const formatted = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                    + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                  handleCaseChange('startTime', formatted);
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const picker = document.getElementById('startTimePicker') as HTMLInputElement;
                  if (picker) {
                    // Attempt to pre-populate the datetime picker from the freeform startTime text
                    const raw = draftCase.startTime || '';
                    if (raw) {
                      // Helper: convert a Date to the "YYYY-MM-DDTHH:MM" format datetime-local expects
                      const toLocal = (d: Date) => {
                        const y = d.getFullYear();
                        const mo = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        const h = String(d.getHours()).padStart(2, '0');
                        const mi = String(d.getMinutes()).padStart(2, '0');
                        return `${y}-${mo}-${day}T${h}:${mi}`;
                      };

                      let parsed: Date | null = null;

                      // Strategy 1: Direct Date.parse (handles ISO, standard formats)
                      const direct = new Date(raw);
                      if (!isNaN(direct.getTime()) && direct.getFullYear() > 0) {
                        parsed = direct;
                      }

                      // Strategy 2: Strip common separators like "at" and retry
                      //   e.g. "Friday, September 12, 1924 at 11:30 PM" → "Friday, September 12, 1924 11:30 PM"
                      if (!parsed) {
                        const stripped = raw.replace(/\bat\b/gi, '').replace(/\s+/g, ' ').trim();
                        const d2 = new Date(stripped);
                        if (!isNaN(d2.getTime()) && d2.getFullYear() > 0) {
                          parsed = d2;
                        }
                      }

                      // Strategy 3: Try to extract a date-like portion via regex patterns
                      if (!parsed) {
                        // Look for patterns like "Month DD, YYYY" or "YYYY-MM-DD" embedded in the string
                        const datePatterns = [
                          // "September 12, 1924" or "Sep 12, 1924"
                          /(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{1,4}/i,
                          // "12 September 1924"
                          /\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,4}/i,
                          // "YYYY-MM-DD"
                          /\d{4}-\d{2}-\d{2}/,
                          // "MM/DD/YYYY" or "DD/MM/YYYY"
                          /\d{1,2}\/\d{1,2}\/\d{2,4}/,
                        ];
                        // Look for time portions: "11:30 PM", "23:30", "11:30pm"
                        const timePatterns = [
                          /(\d{1,2}:\d{2}\s*(?:AM|PM))/i,
                          /(\d{1,2}:\d{2})/,
                        ];

                        let dateStr = '';
                        let timeStr = '';
                        for (const pattern of datePatterns) {
                          const match = raw.match(pattern);
                          if (match) { dateStr = match[0]; break; }
                        }
                        for (const pattern of timePatterns) {
                          const match = raw.match(pattern);
                          if (match) { timeStr = match[1] || match[0]; break; }
                        }

                        if (dateStr) {
                          const combined = timeStr ? `${dateStr} ${timeStr}` : dateStr;
                          const d3 = new Date(combined);
                          if (!isNaN(d3.getTime()) && d3.getFullYear() > 0) {
                            parsed = d3;
                          }
                        }
                      }

                      // Strategy 4: If all else fails but we have a time-like string, use today's date with that time
                      if (!parsed) {
                        const timeOnly = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
                        if (timeOnly) {
                          const now = new Date();
                          let h = parseInt(timeOnly[1]);
                          const m = parseInt(timeOnly[2]);
                          const meridiem = timeOnly[3];
                          if (meridiem) {
                            if (meridiem.toUpperCase() === 'PM' && h < 12) h += 12;
                            if (meridiem.toUpperCase() === 'AM' && h === 12) h = 0;
                          }
                          now.setHours(h, m, 0, 0);
                          parsed = now;
                        }
                      }

                      if (parsed) {
                        picker.value = toLocal(parsed);
                      }
                    }

                    // Stash current value so onChange can detect if the user actually changed something
                    picker.dataset.prevValue = picker.value;
                    picker.showPicker?.();
                  }
                }}
                style={{
                  background: '#222',
                  border: '1px solid #444',
                  color: '#888',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: 'var(--type-body)',
                  lineHeight: 1,
                  flexShrink: 0,
                  aspectRatio: '1',
                  alignSelf: 'stretch',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Open date picker"
              >
                📅
              </button>
            </div>
            <p style={{ fontSize: 'var(--type-small)', color: '#555', margin: '4px 0 0' }}>
              Any format works — real dates, fictional calendars (ABY, Stardates), or freeform text. Use 📅 for a date picker.
            </p>
          </InputGroup>

          <InputGroup>
            <label>Hero Image (Case Card)</label>
            <HeroImageModuleWrapper>
              <HeroImageModuleInner>
                <HeroImagePreview $imageUrl={draftCase.heroImageUrl || undefined}>
                  {!draftCase.heroImageUrl && "NO IMAGE"}
                </HeroImagePreview>
                <HeroImageControls>
                  <div style={{ display: 'flex', gap: 'var(--space)' }}>
                    <SmallButton
                      $active={heroMode === 'suspect'}
                      onClick={() => setHeroMode('suspect')}
                      style={{ flex: 1, background: heroMode === 'suspect' ? '#3b82f6' : '#222' }}
                    >
                      USE SUSPECT
                    </SmallButton>
                    <SmallButton
                      $active={heroMode === 'evidence'}
                      onClick={() => setHeroMode('evidence')}
                      style={{ flex: 1, background: heroMode === 'evidence' ? '#3b82f6' : '#222' }}
                    >
                      USE EVIDENCE
                    </SmallButton>
                    <SmallButton
                      $active={heroMode === 'custom'}
                      onClick={() => setHeroMode('custom')}
                      style={{ flex: 1, background: heroMode === 'custom' ? '#3b82f6' : '#222' }}
                    >
                      USE CUSTOM
                    </SmallButton>
                  </div>

                  {heroMode === 'suspect' && (
                    <select
                      style={{ backgroundColor: '#111', color: '#fff', border: '1px solid #444', padding: 'var(--space)', WebkitAppearance: 'none', appearance: 'none', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23ffffff' d='M6 8L0 0h12z'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '10px', paddingRight: 'calc(var(--space) * 4)' }}
                      onChange={(e) => {
                        const s = draftCase.suspects?.find(x => x.id === e.target.value);
                        if (s?.portraits?.[Emotion.NEUTRAL]) handleCaseChange('heroImageUrl', s.portraits[Emotion.NEUTRAL]);
                      }}
                      value={draftCase.suspects?.find(s => s.portraits?.[Emotion.NEUTRAL] === draftCase.heroImageUrl)?.id || ''}
                    >
                      <option value="">Select a suspect...</option>
                      {(draftCase.suspects || []).map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                      ))}
                    </select>
                  )}

                  {heroMode === 'evidence' && (
                    <select
                      style={{ backgroundColor: '#111', color: '#fff', border: '1px solid #444', padding: 'var(--space)', WebkitAppearance: 'none', appearance: 'none', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23ffffff' d='M6 8L0 0h12z'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '10px', paddingRight: 'calc(var(--space) * 4)' }}
                      onChange={(e) => {
                        const ev = [...draftCase.initialEvidence, ...(draftCase.suspects?.flatMap(s => s.hiddenEvidence || []) || [])].find(x => x.id === e.target.value);
                        if (ev?.imageUrl) handleCaseChange('heroImageUrl', ev.imageUrl);
                      }}
                      value={[...draftCase.initialEvidence, ...(draftCase.suspects?.flatMap(s => s.hiddenEvidence || []) || [])].find(ev => ev.imageUrl === draftCase.heroImageUrl)?.id || ''}
                    >
                      <option value="">Select evidence...</option>
                      {[...(draftCase.initialEvidence || []), ...(draftCase.suspects?.flatMap(s => s.hiddenEvidence || []) || [])].map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.title}</option>
                      ))}
                    </select>
                  )}

                  {heroMode === 'custom' && (
                    <div style={{ display: 'flex', gap: 'var(--space)' }}>
                      <SmallButton onClick={() => setShowHeroEditor(true)} style={{ flex: 1 }}>
                        GENERATE CUSTOM
                      </SmallButton>
                      <SmallButton onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e: any) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => handleCaseChange('heroImageUrl', ev.target?.result as string);
                          reader.readAsDataURL(file);
                        };
                        input.click();
                      }} style={{ flex: 1 }}>
                        UPLOAD IMAGE
                      </SmallButton>
                    </div>
                  )}

                  <input
                    placeholder="Or paste image URL here..."
                    value={draftCase.heroImageUrl || ''}
                    onChange={(e) => handleCaseChange('heroImageUrl', e.target.value)}
                    style={{ fontSize: 'var(--type-xs)', padding: 'var(--space)', background: '#111', border: '1px solid #333', color: '#888', width: '100%', minWidth: 0, boxSizing: 'border-box' }}
                  />
                </HeroImageControls>
              </HeroImageModuleInner>
            </HeroImageModuleWrapper>
          </InputGroup>

          <InputGroup>
            <label>Edit case</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space)', background: 'rgba(0,255,0,0.03)', padding: 'calc(var(--space) * 2)', border: '1px solid rgba(0,255,0,0.1)' }}>
              <textarea
                placeholder="e.g. 'Change the setting to a futuristic space station' or 'Add a secret accomplice for the killer' or 'Make the victim a famous opera singer'..."
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                style={{ minHeight: '100px' }}
              />
              <StartButton
                onClick={handleEditCase}
                disabled={loadingState.visible || !editPrompt.trim()}
                style={{ fontSize: 'var(--type-body)', padding: 'var(--space)' }}
              >
                APPLY EDITS
              </StartButton>
              <p style={{ fontSize: 'var(--type-xs)', color: '#555', margin: 0 }}>
                This will transform suspects, evidence, and narrative to match your request.
              </p>
            </div>
          </InputGroup>

          <InputGroup>
            <label>Difficulty (Calculated)</label>
            <div style={{
              color: draftCase.difficulty === 'Hard' ? '#f55' : draftCase.difficulty === 'Medium' ? '#fa0' : '#0f0',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              fontSize: 'var(--type-h3)',
              padding: '5px 0'
            }}>
              {draftCase.difficulty}
            </div>
            <p style={{ fontSize: 'var(--type-small)', color: '#555', margin: 0 }}>
              Based on {draftCase.suspects?.filter(s => !s.isDeceased).length || 0} suspects, {draftCase.suspects?.filter(s => s.isDeceased).length || 0} victim(s), {draftCase.suspects?.filter(s => s.isGuilty).length || 0} guilty suspect(s), {(draftCase.initialEvidence?.length || 0) + (draftCase.suspects?.reduce((a, s) => a + (s.hiddenEvidence?.length || 0), 0) || 0)} total evidence items, and {draftCase.initialTimeline?.length || 0} initial timeline events.
            </p>
          </InputGroup>

          <EvidenceEditor
            label="Initial Evidence"
            evidenceList={draftCase.initialEvidence}
            onChange={(newList) => handleCaseChange('initialEvidence', newList)}
            onRerollImage={(ev) => handleRerollEvidence(ev, 'initial')}
            ownerKey="initial"
            suspects={draftCase.suspects}
            onTransferEvidence={handleTransferEvidence}
          />

          <Fieldset>
            <legend>Initial Timeline (Known Facts)</legend>
            <ModuleContainer>
              {(draftCase.initialTimeline || []).map((event, idx) => (
                <ModuleItem key={`initial-timeline-${idx}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space)' }}>
                      <StyledInput
                        placeholder="Day (e.g. Today, Yesterday)"
                        value={event.day || ''}
                        onChange={(e) => {
                          const newList = [...(draftCase.initialTimeline || [])];
                          newList[idx] = { ...newList[idx], day: e.target.value };
                          handleCaseChange('initialTimeline', newList);
                        }}
                        style={{ flex: 2 }}
                      />
                      <StyledInput
                        placeholder="Offset"
                        type="number"
                        value={event.dayOffset ?? 0}
                        onChange={(e) => {
                          const newList = [...(draftCase.initialTimeline || [])];
                          newList[idx] = { ...newList[idx], dayOffset: parseInt(e.target.value) || 0 };
                          handleCaseChange('initialTimeline', newList);
                        }}
                        style={{ flex: 0, width: '70px' }}
                      />
                    </div>
                    <StyledInput
                      placeholder="Time (e.g. 10:00 PM)"
                      value={event.time}
                      onChange={(e) => {
                        const newList = [...(draftCase.initialTimeline || [])];
                        newList[idx] = { ...newList[idx], time: e.target.value };
                        handleCaseChange('initialTimeline', newList);
                      }}
                    />
                    <StyledTextArea
                      placeholder="Activity/Discovery"
                      value={event.activity || (event as any).statement || ''}
                      onChange={(e) => {
                        const newList = [...(draftCase.initialTimeline || [])];
                        newList[idx] = { ...newList[idx], activity: e.target.value };
                        handleCaseChange('initialTimeline', newList);
                      }}
                    />
                  </div>
                  <DeleteButton
                    onClick={() => {
                      const newList = (draftCase.initialTimeline || []).filter((_, i) => i !== idx);
                      handleCaseChange('initialTimeline', newList);
                    }}
                    style={{ marginLeft: 'var(--space)', alignSelf: 'stretch' }}
                    title="Delete timeline event"
                  >
                    <XIcon />
                  </DeleteButton>
                </ModuleItem>
              ))}
              <SmallButton onClick={() => {
                const newList = [...(draftCase.initialTimeline || []), { time: '', activity: '', day: 'Today', dayOffset: 0 }];
                handleCaseChange('initialTimeline', newList);
              }} style={{ padding: 'var(--space)', background: '#222' }}>+ ADD TIMELINE EVENT</SmallButton>
            </ModuleContainer>
          </Fieldset>

          <MobileOnly>
            <div style={{ display: 'flex', gap: 'var(--space)', width: '100%' }}>
              <SaveButton onClick={handleCancel} disabled={loadingState.visible} style={{ flex: 1, background: '#444', color: '#fff', border: 'none' }}>CLOSE</SaveButton>
              <SaveButton onClick={handleCheckConsistency} disabled={loadingState.visible} style={{ flex: 1 }}>CHECK CONSISTENCY</SaveButton>
              <SaveButton onClick={handleSave} disabled={loadingState.visible} style={{ flex: 1 }}>SAVE</SaveButton>
            </div>
            <StartButton onClick={onStart}>CASE HUB</StartButton>
          </MobileOnly>
        </Panel>
      </LeftColumn>

      {/* RIGHT: Suspect Editor */}
      <Panel $mobileHidden={mobileTab !== 'suspects'}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: '#fff' }}>Suspects</h2>
          <UtilityButton onClick={handleAddSuspect}>+ ADD SUSPECT</UtilityButton>
        </div>

        <RetryButton onClick={handleRetryAI} disabled={loadingState.visible}>
          ⚡ RETRY AI GENERATION (Fix broken images)
        </RetryButton>

        <SuspectList>
          {/* Support Characters */}
          <SuspectRow
            $selected={selectedSuspectId === 'officer'}
            onClick={() => setSelectedSuspectId('officer')}
            style={{ borderLeft: '3px solid #3b82f6' }}
          >
            <SuspectPortrait
              suspect={draftCase.officer as any}
              size={50}
              style={{ border: '1px solid #555' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', fontSize: 'var(--type-body)' }}>{draftCase.officer.name} (CHIEF)</div>
              <div style={{ fontSize: 'var(--type-small)', color: '#888' }}>{draftCase.officer.role}</div>
            </div>
          </SuspectRow>

          <SuspectRow
            $selected={selectedSuspectId === 'partner'}
            onClick={() => setSelectedSuspectId('partner')}
            style={{ borderLeft: '3px solid #3b82f6' }}
          >
            <SuspectPortrait
              suspect={draftCase.partner as any}
              size={50}
              style={{ border: '1px solid #555' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', fontSize: 'var(--type-body)' }}>{draftCase.partner.name} (PARTNER)</div>
              <div style={{ fontSize: 'var(--type-small)', color: '#888' }}>{draftCase.partner.role}</div>
            </div>
          </SuspectRow>

          {(draftCase.suspects || []).map(s => (
            <SuspectRow
              key={s.id}
              $selected={s.id === selectedSuspectId}
              onClick={() => setSelectedSuspectId(s.id)}
            >
              <SuspectPortrait
                suspect={s}
                size={50}
                style={{ border: '1px solid #555' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: 'var(--type-body)' }}>{s.name}</div>
                <div style={{ fontSize: 'var(--type-small)', color: '#888' }}>{s.role}</div>
              </div>
              {s.isGuilty && <span style={{ color: 'red', fontWeight: 'bold' }}>[GUILTY]</span>}
            </SuspectRow>
          ))}
        </SuspectList>

        {activeSuspect && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--space) * 2)', marginTop: 'calc(var(--space) * 3)', borderTop: '1px solid #333', paddingTop: 'calc(var(--space) * 3)' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space)' }}>
              <h3 style={{ margin: 0, color: '#aaa', fontSize: 'var(--type-h3)' }}>
                EDITING: {activeSuspect.name} {selectedSuspectId === 'officer' ? '(CHIEF)' : selectedSuspectId === 'partner' ? '(PARTNER)' : ''}
              </h3>
              {!isSupportChar && (
                <div style={{ display: 'flex', gap: 'var(--space)', alignItems: 'center' }}>
                  <ToggleButton
                    $active={(activeSuspect as Suspect).isGuilty}
                    onClick={() => handleSuspectChange(activeSuspect.id, 'isGuilty', !(activeSuspect as Suspect).isGuilty)}
                    data-cursor="pointer"
                  >
                    {(activeSuspect as Suspect).isGuilty ? '✓' : <XIcon />} GUILTY
                  </ToggleButton>
                  <DeleteButton onClick={handleDeleteSuspect} title="Remove Suspect" data-cursor="pointer">
                    <XIcon /> REMOVE
                  </DeleteButton>
                </div>
              )}
            </div>

            <SuspectEditorRow>
              {/* Left: Portrait + action buttons */}
              <PortraitCol>
                <SuspectPortrait
                  suspect={activeSuspect as any}
                  size={120}
                  style={{
                    border: '1px solid #555',
                    flex: 1,
                    width: '100%',
                    height: 'auto',
                    minHeight: '120px',
                    aspectRatio: '1',
                  }}
                />
                <PortraitBtnGrid>
                  <RandomizeButton onClick={handleRerollPortrait} disabled={loadingState.visible}>
                    REROLL
                  </RandomizeButton>
                  <RandomizeButton
                    onClick={() => setShowSuspectEditor(true)}
                    disabled={loadingState.visible}
                    style={{ background: '#3b82f6' }}
                  >
                    {activeSuspect.portraits?.[Emotion.NEUTRAL] ? 'EDIT' : 'CREATE'}
                  </RandomizeButton>
                  <UploadButton onClick={triggerUpload} disabled={loadingState.visible}>
                    UPLOAD REF
                  </UploadButton>
                  <CameraButton onClick={startCamera} disabled={loadingState.visible}>
                    TAKE PHOTO
                  </CameraButton>
                </PortraitBtnGrid>
              </PortraitCol>

              {/* Right: All the input fields */}
              <InputsCol>
                <div style={{ display: 'flex', gap: 'var(--space)' }}>
                  <InputGroup style={{ flex: 1 }}>
                    <label>Name</label>
                    <input
                      value={activeSuspect.name}
                      onChange={(e) => handleSuspectChange(selectedSuspectId!, 'name', e.target.value)}
                    />
                  </InputGroup>
                  {!isSupportChar && (
                    <InputGroup style={{ width: '80px' }}>
                      <label>Age</label>
                      <input
                        type="number"
                        value={(activeSuspect as Suspect).age}
                        onChange={(e) => handleSuspectChange(selectedSuspectId!, 'age', parseInt(e.target.value))}
                      />
                    </InputGroup>
                  )}
                </div>
                <InputGroup>
                  <label>Role</label>
                  <input
                    value={activeSuspect.role}
                    onChange={(e) => handleSuspectChange(selectedSuspectId!, 'role', e.target.value)}
                  />
                </InputGroup>
                <InputGroup>
                  <label>Gender</label>
                  <input
                    value={activeSuspect.gender}
                    onChange={(e) => handleSuspectChange(selectedSuspectId!, 'gender', e.target.value)}
                  />
                </InputGroup>
                <InputGroup>
                  <label>Personality</label>
                  <textarea
                    value={activeSuspect.personality}
                    onChange={(e) => handleSuspectChange(selectedSuspectId!, 'personality', e.target.value)}
                  />
                </InputGroup>
                <InputGroup>
                  <label>TTS Voice</label>
                  <div style={{ display: 'flex', gap: 'var(--space)', minWidth: 0 }}>
                    <select
                      value={activeSuspect.voice || ''}
                      onChange={(e) => handleSuspectChange(selectedSuspectId!, 'voice', e.target.value)}
                      style={{ backgroundColor: '#111', color: '#fff', border: '1px solid #444', padding: 'var(--space)', flex: 1, minWidth: 0, WebkitAppearance: 'none', appearance: 'none', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23ffffff' d='M6 8L0 0h12z'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '10px', paddingRight: 'calc(var(--space) * 4)', boxSizing: 'border-box' }}
                    >
                      {TTS_VOICES.map(v => (
                        <option key={v.name} value={v.name}>
                          {v.name === 'None' ? 'No Voice (Silent)' : `${v.name} (${v.gender})`}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handlePreviewVoice}
                      disabled={!activeSuspect.voice || activeSuspect.voice === 'None' || isPreviewingVoice}
                      style={{
                        padding: '8px 12px',
                        background: '#333',
                        color: '#fff',
                        border: '1px solid #444',
                        cursor: (activeSuspect.voice && activeSuspect.voice !== 'None' && !isPreviewingVoice) ? 'pointer' : 'not-allowed',
                        opacity: (activeSuspect.voice && activeSuspect.voice !== 'None' && !isPreviewingVoice) ? 1 : 0.5,
                        fontSize: 'var(--type-xs)',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {isPreviewingVoice ? '...' : 'Preview'}
                    </button>
                  </div>
                </InputGroup>
              </InputsCol>
            </SuspectEditorRow>

            {!isSupportChar && (
              <>
                <InputGroup>
                  <label>Bio</label>
                  <textarea
                    value={(activeSuspect as Suspect).bio}
                    onChange={(e) => handleSuspectChange(activeSuspect.id, 'bio', e.target.value)}
                  />
                </InputGroup>

                <InputGroup>
                  <label>Motive</label>
                  <textarea
                    value={(activeSuspect as Suspect).motive || ''}
                    onChange={(e) => handleSuspectChange(activeSuspect.id, 'motive', e.target.value)}
                  />
                </InputGroup>

                <InputGroup>
                  <label>Professional Skills</label>
                  <input
                    value={(activeSuspect as Suspect).professionalBackground || ''}
                    onChange={(e) => handleSuspectChange(activeSuspect.id, 'professionalBackground', e.target.value)}
                  />
                </InputGroup>

                <InputGroup>
                  <label>Witness Observations</label>
                  <textarea
                    value={(activeSuspect as Suspect).witnessObservations || ''}
                    onChange={(e) => handleSuspectChange(activeSuspect.id, 'witnessObservations', e.target.value)}
                  />
                </InputGroup>

                <Fieldset>
                  <legend>Alibi</legend>
                  <InputGroup>
                    <label>Story</label>
                    <textarea
                      value={(activeSuspect as Suspect).alibi?.statement || ''}
                      onChange={(e) => handleSuspectChange(activeSuspect.id, 'alibi', { ...(activeSuspect as Suspect).alibi, statement: e.target.value })}
                    />
                  </InputGroup>
                  <div style={{ display: 'flex', gap: 'var(--space)', marginTop: 'var(--space)', alignItems: 'flex-end' }}>
                    <InputGroup style={{ flex: 1 }}>
                      <label>Location</label>
                      <input
                        value={(activeSuspect as Suspect).alibi?.location || ''}
                        onChange={(e) => handleSuspectChange(activeSuspect.id, 'alibi', { ...(activeSuspect as Suspect).alibi, location: e.target.value })}
                      />
                    </InputGroup>
                    <ToggleButton
                      $active={(activeSuspect as Suspect).alibi?.isTrue || false}
                      onClick={() => handleSuspectChange(activeSuspect.id, 'alibi', { ...(activeSuspect as Suspect).alibi, isTrue: !(activeSuspect as Suspect).alibi?.isTrue })}
                      data-cursor="pointer"
                      style={{ padding: 'calc(var(--space) + 3.4px) calc(var(--space) * 2)', fontSize: 'var(--type-body)' }}
                    >
                      {(activeSuspect as Suspect).alibi?.isTrue ? '✓' : <XIcon />} VERIFIED
                    </ToggleButton>
                  </div>
                </Fieldset>

                {/* RELATIONSHIPS MODULE */}
                <Fieldset>
                  <legend>Relationships</legend>
                  <ModuleContainer>
                    {relationshipTargets.map(targetName => {
                      // Find existing relationship data or use default empty state
                      const rel = (activeSuspect as Suspect).relationships?.find(r => r.targetName === targetName) || { type: '', description: '' };

                      return (
                        <ModuleItem key={`${activeSuspect.id}-${targetName}`}>
                          <div style={{ display: 'flex', gap: 'var(--space)', alignItems: 'center' }}>
                            <div style={{
                              flex: 1,
                              color: '#fff',
                              fontSize: 'var(--type-body-lg)',
                              fontWeight: 'bold',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {targetName === "The Victim" && deceasedSuspect
                                ? `The Victim (${deceasedSuspect.name})`
                                : targetName}
                            </div>
                            <StyledInput
                              placeholder="Type (e.g. Rival)"
                              value={rel.type}
                              onChange={e => handleRelationshipChange(targetName, 'type', e.target.value)}
                              style={{ width: '120px' }}
                            />
                          </div>
                          <StyledTextArea
                            placeholder={`How does ${activeSuspect.name} feel about ${targetName}?`}
                            value={rel.description}
                            onChange={e => handleRelationshipChange(targetName, 'description', e.target.value)}
                          />
                        </ModuleItem>
                      );
                    })}
                  </ModuleContainer>
                </Fieldset>

                {/* TIMELINE MODULE */}
                <Fieldset>
                  <legend>Timeline ({(activeSuspect as Suspect)?.timeline?.length || 0})</legend>
                  <ModuleContainer>
                    {(activeSuspect as Suspect)?.timeline?.map((t, i) => (
                      <ModuleItem key={`${activeSuspect.id}-timeline-${i}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space)' }}>
                          <div style={{ display: 'flex', gap: 'var(--space)' }}>
                            <StyledInput
                              placeholder="Day (e.g. Today, Yesterday)"
                              value={t.day || ''}
                              onChange={(e) => updateTimeline(i, 'day' as any, e.target.value)}
                              style={{ flex: 2 }}
                            />
                            <StyledInput
                              placeholder="Offset"
                              type="number"
                              value={t.dayOffset ?? 0}
                              onChange={(e) => {
                                if (!activeSuspect || isSupportChar) return;
                                const currentSuspect = activeSuspect as Suspect;
                                const newTime = [...currentSuspect.timeline];
                                newTime[i] = { ...newTime[i], dayOffset: parseInt(e.target.value) || 0 };
                                handleSuspectChange(activeSuspect.id, 'timeline', newTime);
                              }}
                              style={{ flex: 0, width: '70px' }}
                            />
                          </div>
                          <StyledInput
                            placeholder="Time (e.g. 8:00 PM)"
                            value={t.time}
                            onChange={(e) => updateTimeline(i, 'time', e.target.value)}
                          />
                          <StyledTextArea
                            placeholder="Activity"
                            value={t.activity}
                            onChange={(e) => updateTimeline(i, 'activity', e.target.value)}
                          />
                        </div>
                        <DeleteButton
                          onClick={() => removeTimelineEvent(i)}
                          style={{ marginLeft: 'var(--space)', alignSelf: 'stretch' }}
                          title="Delete timeline event"
                        >
                          <XIcon />
                        </DeleteButton>
                      </ModuleItem>
                    ))}
                    <SmallButton onClick={addTimelineEvent} style={{ padding: 'var(--space)', background: '#222' }}>+ ADD TIMELINE EVENT</SmallButton>
                  </ModuleContainer>
                </Fieldset>

                {/* KNOWN FACTS MODULE */}
                <Fieldset>
                  <legend>Known Facts ({(activeSuspect as Suspect)?.knownFacts?.length || 0})</legend>
                  <ModuleContainer>
                    {(activeSuspect as Suspect)?.knownFacts?.map((f, i) => (
                      <ModuleItem key={`${activeSuspect.id}-fact-${i}`} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                        <StyledTextArea
                          value={f}
                          onChange={(e) => updateFact(i, e.target.value)}
                        />
                        <DeleteButton
                          onClick={() => removeFact(i)}
                          style={{ marginLeft: 'var(--space)', alignSelf: 'stretch' }}
                          title="Delete fact"
                        >
                          <XIcon />
                        </DeleteButton>
                      </ModuleItem>
                    ))}
                    <SmallButton onClick={addFact} style={{ padding: 'var(--space)', background: '#222' }}>+ ADD FACT</SmallButton>
                  </ModuleContainer>
                </Fieldset>

                <InputGroup>
                  <label>Secret (Red Herring or Motive)</label>
                  <textarea
                    value={(activeSuspect as Suspect).secret}
                    onChange={(e) => handleSuspectChange(activeSuspect.id, 'secret', e.target.value)}
                  />
                </InputGroup>

                <EvidenceEditor
                  label="Hidden Evidence (Revealed under pressure)"
                  evidenceList={(activeSuspect as Suspect).hiddenEvidence}
                  onChange={(newList) => handleSuspectChange(activeSuspect.id, 'hiddenEvidence', newList)}
                  onRerollImage={(ev) => handleRerollEvidence(ev, 'hidden', activeSuspect.id)}
                  ownerKey={activeSuspect.id}
                  suspects={draftCase.suspects}
                  onTransferEvidence={handleTransferEvidence}
                />

                <InputGroup>
                  <label>Base Aggravation (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={(activeSuspect as Suspect).baseAggravation}
                    onChange={(e) => handleSuspectChange(activeSuspect.id, 'baseAggravation', parseInt(e.target.value))}
                  />
                </InputGroup>
              </>
            )}

            <MobileOnly>
              <div style={{ display: 'flex', gap: 'var(--space)', width: '100%' }}>
                <SaveButton onClick={handleSave} disabled={loadingState.visible} style={{ flex: 1 }}>SAVE</SaveButton>
                <SaveButton onClick={handleCheckConsistency} disabled={loadingState.visible} style={{ flex: 1 }}>CHECK CONSISTENCY</SaveButton>
                <SaveButton onClick={handleCancel} disabled={loadingState.visible} style={{ flex: 1, background: '#444', color: '#ccc' }}>CLOSE</SaveButton>
              </div>
              <StartButton onClick={onStart}>CASE HUB</StartButton>
            </MobileOnly>

          </div>
        )}
      </Panel>
      {consistencyModal.visible && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '30px 20px',
        }}>
          <div style={{
            background: '#111',
            border: '1px solid #444',
            maxWidth: '800px',
            width: '95%',
            maxHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 0 50px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }}>
            <h2 style={{
              color: '#fff', marginTop: 0, marginBottom: 0,
              borderBottom: '1px solid #333', padding: '20px 25px',
              fontSize: 'var(--type-h3)', flexShrink: 0,
              background: '#111', position: 'relative', zIndex: 1,
            }}>{consistencyModal.editReport ? 'Case Transformation Report' : 'Narrative Audit Report'}</h2>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 25px',
              minHeight: 0,
            }}>
              {/* === EDIT-TRIGGERED MODAL: Show edit changes as primary content === */}
              {consistencyModal.editReport && typeof consistencyModal.editReport === 'object' ? (
                <>
                  {/* User's original request */}
                  <section style={{ marginBottom: 'calc(var(--space) * 3)' }}>
                    <h3 style={{ color: '#3b82f6', fontSize: 'var(--type-body-lg)', marginBottom: 'var(--space)', textTransform: 'uppercase', letterSpacing: '1px' }}>Your Request</h3>
                    <div style={{
                      background: 'rgba(59,130,246,0.08)',
                      border: '1px solid rgba(59,130,246,0.2)',
                      padding: 'calc(var(--space) * 2)',
                      color: '#ccc',
                      fontSize: 'var(--type-body)',
                      fontStyle: 'italic',
                      lineHeight: '1.5'
                    }}>
                      "{consistencyModal.editPrompt}"
                    </div>
                  </section>

                  {/* Changes made by the edit */}
                  <section style={{ marginBottom: 'calc(var(--space) * 3)' }}>
                    <h3 style={{ color: '#0f0', fontSize: 'var(--type-body-lg)', marginBottom: 'calc(var(--space) * 2)', textTransform: 'uppercase', letterSpacing: '1px' }}>Changes Applied</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--space) * 2)' }}>
                      {(consistencyModal.editReport.changesMade || []).map((change: any, idx: number) => {
                        const evidence = change.evidenceId ?
                          [...(consistencyModal.updatedCase?.initialEvidence || []), ...(consistencyModal.updatedCase?.suspects || []).flatMap(s => s.hiddenEvidence || [])]
                            .find(e => e.id === change.evidenceId) : null;

                        const isNewEvidence = evidence &&
                          !(draftCase.initialEvidence || []).find(e => e.id === evidence.id) &&
                          !(draftCase.suspects || []).flatMap(s => s.hiddenEvidence || []).find(e => e.id === evidence.id);

                        return (
                          <div key={idx} style={{
                            background: '#1a1a1a',
                            padding: 'calc(var(--space) * 2)',
                            borderLeft: '3px solid #0f0',
                            display: 'flex',
                            gap: 'calc(var(--space) * 2)',
                            alignItems: 'flex-start'
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: '#eee', fontSize: 'var(--type-body)', fontWeight: 500 }}>{change.description}</div>
                              {evidence && (
                                <div style={{ marginTop: 'var(--space)', fontSize: 'var(--type-small)', color: '#888', fontStyle: 'italic' }}>
                                  Linked to: {evidence.title}
                                </div>
                              )}
                            </div>
                            {isNewEvidence && evidence?.imageUrl && (
                              <div style={{ width: '80px', height: '80px', flexShrink: 0, overflow: 'hidden', border: '1px solid #333' }}>
                                <img src={evidence.imageUrl} alt={evidence.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* Edit conclusion */}
                  {consistencyModal.editReport.conclusion && (
                    <section style={{ marginBottom: 'calc(var(--space) * 3)' }}>
                      <p style={{ color: '#aaa', fontSize: 'var(--type-body)', lineHeight: '1.5', margin: 0 }}>{consistencyModal.editReport.conclusion}</p>
                    </section>
                  )}

                  {/* Consistency as secondary addendum */}
                  {consistencyModal.report && typeof consistencyModal.report === 'object' && (
                    <details style={{ marginTop: 'calc(var(--space) * 2)', borderTop: '1px solid #222', paddingTop: 'calc(var(--space) * 2)' }}>
                      <summary style={{
                        color: '#666',
                        fontSize: 'var(--type-small)',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        padding: 'var(--space) 0',
                      }}>Consistency Audit Details</summary>
                      <div style={{ marginTop: 'calc(var(--space) * 2)' }}>
                        {consistencyModal.report.issuesFound && consistencyModal.report.issuesFound !== 'No issues detected.' && (
                          <section style={{ marginBottom: 'calc(var(--space) * 2)' }}>
                            <h4 style={{ color: '#f55', fontSize: 'var(--type-body)', marginBottom: 'var(--space)', textTransform: 'uppercase', letterSpacing: '1px' }}>Issues Detected</h4>
                            <div style={{ color: '#888', fontSize: 'var(--type-small)' }}>
                              <Markdown>{consistencyModal.report.issuesFound}</Markdown>
                            </div>
                          </section>
                        )}
                        {(consistencyModal.report.changesMade || []).length > 0 && (
                          <section style={{ marginBottom: 'calc(var(--space) * 2)' }}>
                            <h4 style={{ color: '#888', fontSize: 'var(--type-body)', marginBottom: 'var(--space)', textTransform: 'uppercase', letterSpacing: '1px' }}>Additional Repairs</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space)' }}>
                              {(consistencyModal.report.changesMade || []).map((change: any, idx: number) => (
                                <div key={idx} style={{
                                  background: '#1a1a1a',
                                  padding: 'var(--space) calc(var(--space) * 2)',
                                  borderLeft: '2px solid #444',
                                  color: '#999',
                                  fontSize: 'var(--type-small)'
                                }}>
                                  {change.description}
                                </div>
                              ))}
                            </div>
                          </section>
                        )}
                        {consistencyModal.report.conclusion && (
                          <p style={{ color: '#666', fontSize: 'var(--type-small)', lineHeight: '1.5' }}>{consistencyModal.report.conclusion}</p>
                        )}
                      </div>
                    </details>
                  )}
                </>
              ) : (
                /* === STANDALONE CONSISTENCY CHECK: Original layout === */
                consistencyModal.report && typeof consistencyModal.report === 'object' ? (
                  <>
                    <section style={{ marginBottom: 'calc(var(--space) * 3)' }}>
                      <h3 style={{ color: '#f55', fontSize: 'var(--type-body-lg)', marginBottom: 'var(--space)', textTransform: 'uppercase', letterSpacing: '1px' }}>Issues Detected</h3>
                      <div style={{ color: '#bbb', fontSize: 'var(--type-body)' }}>
                        <Markdown>{consistencyModal.report.issuesFound || 'No issues detected.'}</Markdown>
                      </div>
                    </section>

                    <section style={{ marginBottom: 'calc(var(--space) * 3)' }}>
                      <h3 style={{ color: '#0f0', fontSize: 'var(--type-body-lg)', marginBottom: 'calc(var(--space) * 2)', textTransform: 'uppercase', letterSpacing: '1px' }}>Proposed Repairs</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--space) * 2)' }}>
                        {(consistencyModal.report.changesMade || []).map((change: any, idx: number) => {
                          const evidence = change.evidenceId ?
                            [...(consistencyModal.updatedCase?.initialEvidence || []), ...(consistencyModal.updatedCase?.suspects || []).flatMap(s => s.hiddenEvidence || [])]
                              .find(e => e.id === change.evidenceId) : null;

                          const isNewEvidence = evidence &&
                            !(draftCase.initialEvidence || []).find(e => e.id === evidence.id) &&
                            !(draftCase.suspects || []).flatMap(s => s.hiddenEvidence || []).find(e => e.id === evidence.id);

                          return (
                            <div key={idx} style={{
                              background: '#1a1a1a',
                              padding: 'calc(var(--space) * 2)',
                              borderLeft: '3px solid #0f0',
                              display: 'flex',
                              gap: 'calc(var(--space) * 2)',
                              alignItems: 'flex-start'
                            }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ color: '#eee', fontSize: 'var(--type-body)', fontWeight: 500 }}>{change.description}</div>
                                {evidence && (
                                  <div style={{ marginTop: 'var(--space)', fontSize: 'var(--type-small)', color: '#888', fontStyle: 'italic' }}>
                                    Linked to: {evidence.title}
                                  </div>
                                )}
                              </div>
                              {isNewEvidence && evidence?.imageUrl && (
                                <div style={{ width: '80px', height: '80px', flexShrink: 0, overflow: 'hidden', border: '1px solid #333' }}>
                                  <img src={evidence.imageUrl} alt={evidence.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    <section>
                      <h3 style={{ color: '#aaa', fontSize: 'var(--type-body-lg)', marginBottom: 'var(--space)', textTransform: 'uppercase', letterSpacing: '1px' }}>Conclusion</h3>
                      <p style={{ color: '#999', fontSize: 'var(--type-body)', lineHeight: '1.5' }}>{consistencyModal.report.conclusion}</p>
                    </section>
                  </>
                ) : (
                  <div style={{ color: '#ddd' }}>{String(consistencyModal.report)}</div>
                )
              )}
            </div>

            <div style={{ display: 'flex', gap: 'calc(var(--space) * 2)', borderTop: '1px solid #333', padding: '20px 25px', justifyContent: 'flex-end', flexShrink: 0 }}>
              <SaveButton onClick={() => setConsistencyModal({ visible: false, report: null, updatedCase: null })} style={{ background: '#333', padding: '10px 20px' }}>Discard</SaveButton>
              <SaveButton onClick={applyConsistencyChanges} style={{ padding: '10px 25px', background: '#0f0', color: '#000' }}>Apply All Changes</SaveButton>
            </div>
          </div>
        </div>
      )}
      {suspectToDelete && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#111', padding: 'calc(var(--space) * 3)', border: '1px solid #333', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ color: '#fff', marginTop: 0 }}>Delete Suspect</h3>
            <p style={{ color: '#ccc' }}>Are you sure you want to remove {suspectToDelete.name}?</p>
            <div style={{ display: 'flex', gap: 'var(--space)', marginTop: 'calc(var(--space) * 3)' }}>
              <SaveButton onClick={confirmDeleteSuspect} style={{ background: '#800' }}>Delete</SaveButton>
              <SaveButton onClick={() => setSuspectToDelete(null)}>Cancel</SaveButton>
            </div>
          </div>
        </div>
      )}
      {showCancelDialog && (
        <ExitCaseDialog
          onConfirm={() => {
            setShowCancelDialog(false);
            onCancel();
          }}
          onCancel={() => setShowCancelDialog(false)}
          hasUnsavedChanges={hasUnsavedChanges}
        />
      )}
    </Container>
  );
};

export default CaseReview;
