
import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import toast from 'react-hot-toast';
import Markdown from 'react-markdown';
import { CaseData, Suspect, Emotion, Evidence, Relationship, TimelineEvent } from '../types';
import { TTS_VOICES, getRandomVoice } from '../constants';
import { generateTTS } from '../services/geminiTTS';
import { pregenerateCaseImages, generateEvidenceImage, regenerateSingleSuspect, checkCaseConsistency, editCaseWithPrompt, generateSuspectFromUpload, calculateDifficulty, editImageWithPrompt, generateEmotionalVariantsFromBase } from '../services/geminiService';
import EvidenceEditor from '@/components/EvidenceEditor';
import SuspectPortrait from '@/components/SuspectPortrait';
import ExitCaseDialog from '@/components/ExitCaseDialog';
import ImageEditorModal from '@/components/ImageEditorModal';
import { PIXEL_ART_BASE } from '@/services/geminiStyles';

const Container = styled.div`
  display: flex;
  height: 100%;
  padding: 20px;
  gap: 20px;
  position: relative;

  @media (max-width: 1080px) {
    flex-direction: column;
    padding: 10px;
    gap: 0;
  }
`;

const MobileTabBar = styled.div`
  display: none;
  
  @media (max-width: 1080px) {
    display: flex;
    gap: 0;
    margin-bottom: 10px;
    flex-shrink: 0;
  }
`;

const MobileTab = styled.button<{ $active: boolean }>`
  flex: 1;
  background: ${props => props.$active ? '#1a1a1a' : '#0a0a0a'};
  border: 1px solid ${props => props.$active ? '#0f0' : '#333'};
  border-bottom: ${props => props.$active ? '2px solid #0f0' : '1px solid #333'};
  color: ${props => props.$active ? '#0f0' : '#666'};
  font-family: inherit;
  font-size: var(--type-body);
  padding: 10px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.2s;
`;

const Panel = styled.div<{ $mobileHidden?: boolean }>`
  flex: 1;
  background: #0a0a0a;
  border: 1px solid #333;
  padding: 20px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  gap: 20px;

  @media (max-width: 1080px) {
    display: ${props => props.$mobileHidden ? 'none' : 'flex'};
    padding: 15px;
    min-height: 0;
    flex: 1;
  }
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;

  label {
    color: #555;
    font-size: var(--type-small);
    text-transform: uppercase;
  }

  input, textarea, select {
    background: #111;
    border: 1px solid #444;
    color: #ddd;
    font-family: inherit;
    padding: 8px;
    font-size: var(--type-body);

    &:focus {
      border-color: #888;
      outline: none;
    }
  }

  textarea {
    resize: vertical;
    min-height: 80px;
  }
`;

// --- NEW STYLED INPUTS FOR CONSISTENCY ---

const StyledInput = styled.input`
  background: #111;
  border: none;
  border-bottom: 1px solid #333;
  color: #ddd;
  font-family: inherit;
  padding: 8px;
  font-size: var(--type-body);
  width: 100%;
  
  &:focus {
    border-bottom-color: #0f0;
    background: #1a1a1a;
    outline: none;
  }
`;

const StyledTextArea = styled.textarea`
  background: #111;
  border: none;
  border-bottom: 1px solid #333;
  color: #ddd;
  font-family: inherit;
  padding: 8px;
  font-size: var(--type-body);
  resize: vertical;
  min-height: 60px;
  width: 100%;
  
  &:focus {
    border-bottom-color: #0f0;
    background: #1a1a1a;
    outline: none;
  }
`;

const ModuleContainer = styled.div`
  padding: 5px 0;
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const ModuleItem = styled.div`
  border-bottom: 1px dashed #333;
  padding-bottom: 15px;
  &:last-child { border-bottom: none; padding-bottom: 0; }
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

// -----------------------------------------

const SuspectList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px; 
`;

const SuspectRow = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px;
  background: ${props => props.$selected ? '#222' : '#0f0f0f'};
  border: 1px solid ${props => props.$selected ? '#fff' : '#333'};
  cursor: pointer;

  &:hover {
    background: #222;
  }
`;

const ActionButtons = styled.div`
  margin-top: auto;
  display: flex;
  gap: 10px;
`;

const StartButton = styled.button`
  flex: 1;
  background: #0d0;
  color: #000;
  border: none;
  padding: 15px;
  font-family: inherit;
  font-size: var(--type-body-lg);
  font-weight: bold;
  cursor: pointer;

  &:hover {
    background: #5f5;
  }
`;

const RandomizeButton = styled.button`
  background: #333;
  color: #fff;
  border: 1px solid #555;
  cursor: pointer;
  padding: 8px 12px;
  font-family: inherit;
  font-size: var(--type-small);
  width: 100%;
  border-radius: 4px;
  transition: all 0.2s;
  
  &:hover { background: #555; }
  &:disabled { opacity: 0.5; cursor: wait; }
`;

const UploadButton = styled.button`
  background: #234;
  color: #adf;
  border: 1px solid #456;
  cursor: pointer;
  padding: 8px 12px;
  font-family: inherit;
  font-size: var(--type-small);
  width: 100%;
  border-radius: 4px;
  transition: all 0.2s;
  
  &:hover { background: #345; }
  &:disabled { opacity: 0.5; cursor: wait; }
`;

const CameraButton = styled.button`
  background: #422;
  color: #fa0;
  border: 1px solid #633;
  cursor: pointer;
  padding: 8px 12px;
  font-family: inherit;
  font-size: var(--type-small);
  width: 100%;
  border-radius: 4px;
  transition: all 0.2s;
  
  &:hover { background: #533; }
  &:disabled { opacity: 0.5; cursor: wait; }
`;

const RetryButton = styled.button`
  background: #0e0e0e;
  color: #0ff;
  border: 1px dashed #088;
  padding: 12px;
  font-family: inherit;
  font-size: var(--type-body);
  cursor: pointer;
  margin-bottom: 10px;
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
  background: ${props => props.$danger ? '#300' : '#222'};
  color: ${props => props.$danger ? '#f55' : '#ccc'};
  border: 1px solid ${props => props.$danger ? '#500' : '#444'};
  padding: 8px;
  cursor: pointer;
  font-family: inherit;
  font-size: var(--type-small);
  text-transform: uppercase;
  
  &:hover {
    background: ${props => props.$danger ? '#500' : '#333'};
    color: #fff;
  }
`;

const SaveButton = styled.button`
  background: #004400;
  color: #0f0;
  border: 1px solid #0f0;
  padding: 15px;
  font-family: inherit;
  font-size: var(--type-body);
  font-weight: bold;
  cursor: pointer;
  text-transform: uppercase;

  &:hover {
    background: #006600;
    color: #fff;
  }
  
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Fieldset = styled.fieldset`
  border: none;
  border-top: 1px solid #333;
  padding: 15px 0 0 0;
  margin: 20px 0 0 0;
  background: transparent;
  
  legend {
    color: #888;
    padding: 0 10px 0 0;
    font-size: var(--type-small);
    text-transform: uppercase;
    font-weight: bold;
  }
`;

const SmallButton = styled.button<{ $active?: boolean }>`
  background: ${props => props.$active ? '#3b82f6' : '#333'};
  color: ${props => props.$active ? '#fff' : '#ccc'};
  border: 1px solid ${props => props.$active ? '#60a5fa' : '#555'};
  cursor: pointer;
  padding: 4px 8px;
  font-size: var(--type-small);
  font-family: inherit;
  border-radius: 4px;
  transition: all 0.2s;
  &:hover { background: ${props => props.$active ? '#2563eb' : '#555'}; }
`;

const HeroImageModuleWrapper = styled.div`
  container-type: inline-size;
  margin-bottom: 10px;
`;

const HeroImageModuleInner = styled.div`
  display: flex;
  gap: 15px;
  align-items: stretch;
  background: rgba(255,255,255,0.03);
  padding: 15px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.05);

  @container (max-width: 450px) {
    flex-direction: column;
  }
`;

const HeroImagePreview = styled.div<{ $imageUrl?: string }>`
  width: 50%;
  aspect-ratio: 1 / 1;
  background: #000;
  border: 1px solid #333;
  background-image: ${props => props.$imageUrl ? `url(${props.$imageUrl})` : 'none'};
  background-size: cover;
  background-position: center;
  image-rendering: pixelated;
  flex-shrink: 0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333;
  font-size: 0.6rem;
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
  gap: 12px;

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
  gap: 20px;
`;

const rotate = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const Spinner = styled.div`
  width: 50px;
  height: 50px;
  border: 4px solid #333;
  border-top-color: #0f0;
  border-radius: 50%;
  animation: ${rotate} 1s linear infinite;
`;

const LoadingText = styled.div`
  color: #0f0;
  font-size: var(--type-body-lg);
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
  border: 2px solid #0f0;
  background: #111;
  box-shadow: 0 0 20px #0f0;
`;

const CameraControls = styled.div`
  display: flex;
  gap: 20px;
  margin-top: 20px;
`;

const SnapButton = styled.button`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #f00;
  border: 4px solid #fff;
  cursor: pointer;
  box-shadow: 0 0 10px #f00;
  
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
      // Alive suspects always have a "The Victim" slot
      relationshipTargets.push("The Victim");
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
    handleSuspectChange(activeSuspect.id, 'timeline', [...currentSuspect.timeline, { time: "12:00 PM", activity: "Doing something" }]);
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

  const [consistencyModal, setConsistencyModal] = useState<{ visible: boolean, report: any, updatedCase: CaseData | null }>({ visible: false, report: null, updatedCase: null });

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
      initialDraftCase.current = stampedCase;
      baselineRef.current = JSON.parse(JSON.stringify(stampedCase));
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

      // Run consistency check on the edited result
      setLoadingState({ visible: true, message: "Running full consistency audit...", step: 'Step 2/2', stepDetail: 'Consistency Check' });
      const { updatedCase, report: consistencyReport } = await checkCaseConsistency(editedCase, (msg) => {
        setLoadingState({ visible: true, message: msg, step: 'Step 2/2', stepDetail: 'Consistency Check' });
      });

      // Use the consistency report for the modal — it has the expected shape (issuesFound, changesMade, conclusion)
      setConsistencyModal({ visible: true, report: consistencyReport, updatedCase });
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

        const audio = new Audio(audioUrl);
        audio.oncanplaythrough = () => {
          audio.play().catch(e => console.error("Preview playback failed", e));
        };
        audio.onerror = (e) => {
          console.error("Audio element error:", e);
        };
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
    <Container>
      {loadingState.visible && (
        <Overlay>
          {loadingState.step && (
            <div style={{
              color: '#666',
              fontSize: 'var(--type-small)',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              marginBottom: '5px'
            }}>
              {loadingState.step}
              {loadingState.stepDetail && <span style={{ color: '#888', marginLeft: '8px' }}>— {loadingState.stepDetail}</span>}
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
            marginTop: '10px'
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
          <label>Hero Image (Case Card)</label>
          <HeroImageModuleWrapper>
            <HeroImageModuleInner>
              <HeroImagePreview $imageUrl={draftCase.heroImageUrl || undefined}>
                {!draftCase.heroImageUrl && "NO IMAGE"}
              </HeroImagePreview>
              <HeroImageControls>
                <div style={{ display: 'flex', gap: '8px' }}>
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
                    style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px' }}
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
                    style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px' }}
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
                  <div style={{ display: 'flex', gap: '8px' }}>
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
                  style={{ fontSize: '0.75rem', padding: '8px', background: '#111', border: '1px solid #333', borderRadius: '4px', color: '#888', width: '100%', minWidth: 0, boxSizing: 'border-box' }}
                />
              </HeroImageControls>
            </HeroImageModuleInner>
          </HeroImageModuleWrapper>
        </InputGroup>

        <InputGroup>
          <label>Edit case</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,255,0,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(0,255,0,0.1)' }}>
            <textarea
              placeholder="e.g. 'Change the setting to a futuristic space station' or 'Add a secret accomplice for the killer' or 'Make the victim a famous opera singer'..."
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              style={{ minHeight: '100px' }}
            />
            <StartButton
              onClick={handleEditCase}
              disabled={loadingState.visible || !editPrompt.trim()}
              style={{ fontSize: 'var(--type-body)', padding: '10px' }}
            >
              APPLY EDITS
            </StartButton>
            <p style={{ fontSize: '0.7rem', color: '#555', margin: 0 }}>
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
        />

        <Fieldset>
          <legend>Initial Timeline (Known Facts)</legend>
          <ModuleContainer>
            {(draftCase.initialTimeline || []).map((event, idx) => (
              <ModuleItem key={`initial-timeline-${idx}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
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
                <SmallButton
                  onClick={() => {
                    const newList = (draftCase.initialTimeline || []).filter((_, i) => i !== idx);
                    handleCaseChange('initialTimeline', newList);
                  }}
                  style={{ height: '100%', marginLeft: '10px', border: '1px solid #500', color: '#f55' }}
                >
                  DELETE
                </SmallButton>
              </ModuleItem>
            ))}
            <SmallButton onClick={() => {
              const newList = [...(draftCase.initialTimeline || []), { time: '', activity: '' }];
              handleCaseChange('initialTimeline', newList);
            }} style={{ padding: '10px', background: '#222' }}>+ ADD TIMELINE EVENT</SmallButton>
          </ModuleContainer>
        </Fieldset>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
            <SaveButton onClick={handleSave} disabled={loadingState.visible} style={{ flex: 1 }}>SAVE</SaveButton>
            <SaveButton onClick={handleCheckConsistency} disabled={loadingState.visible} style={{ flex: 1 }}>CHECK CONSISTENCY</SaveButton>
            <SaveButton onClick={handleCancel} disabled={loadingState.visible} style={{ flex: 1, background: '#444', color: '#ccc' }}>CLOSE</SaveButton>
          </div>
          <StartButton onClick={onStart}>CASE HUB</StartButton>
        </div>
      </Panel>

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px', borderTop: '1px solid #333', paddingTop: '20px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#aaa', fontSize: 'var(--type-h3)' }}>
                EDITING: {activeSuspect.name} {selectedSuspectId === 'officer' ? '(CHIEF)' : selectedSuspectId === 'partner' ? '(PARTNER)' : ''}
              </h3>
              {!isSupportChar && <UtilityButton $danger onClick={handleDeleteSuspect}>REMOVE SUSPECT</UtilityButton>}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                <SuspectPortrait suspect={activeSuspect as any} size={80} style={{ border: '1px solid #555' }} />
                <RandomizeButton onClick={handleRerollPortrait} disabled={loadingState.visible}>
                  REROLL
                </RandomizeButton>
                <RandomizeButton
                  onClick={() => !isSupportChar && setShowSuspectEditor(true)}
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
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
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
                  <input
                    value={activeSuspect.personality}
                    onChange={(e) => handleSuspectChange(selectedSuspectId!, 'personality', e.target.value)}
                  />
                </InputGroup>
                <InputGroup>
                  <label>TTS Voice</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={activeSuspect.voice || ''}
                      onChange={(e) => handleSuspectChange(selectedSuspectId!, 'voice', e.target.value)}
                      style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '8px', flex: 1 }}
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
                        fontSize: '12px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {isPreviewingVoice ? '...' : 'Preview'}
                    </button>
                  </div>
                </InputGroup>
              </div>
            </div>

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
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <InputGroup style={{ flex: 1 }}>
                      <label>Location</label>
                      <input
                        value={(activeSuspect as Suspect).alibi?.location || ''}
                        onChange={(e) => handleSuspectChange(activeSuspect.id, 'alibi', { ...(activeSuspect as Suspect).alibi, location: e.target.value })}
                      />
                    </InputGroup>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', border: '1px solid #444', padding: '0 10px', background: '#222' }}>
                      <input
                        type="checkbox"
                        checked={(activeSuspect as Suspect).alibi?.isTrue || false}
                        onChange={(e) => handleSuspectChange(activeSuspect.id, 'alibi', { ...(activeSuspect as Suspect).alibi, isTrue: e.target.checked })}
                        style={{ width: '20px', height: '20px' }}
                      />
                      <label>Verified True?</label>
                    </div>
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
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
                            style={{ height: '80px' }}
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
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <StyledInput
                            placeholder="Time (e.g. 8:00 PM)"
                            value={t.time}
                            onChange={(e) => updateTimeline(i, 'time', e.target.value)}
                          />
                          <StyledInput
                            placeholder="Activity"
                            value={t.activity}
                            onChange={(e) => updateTimeline(i, 'activity', e.target.value)}
                          />
                        </div>
                        <SmallButton
                          onClick={() => removeTimelineEvent(i)}
                          style={{ height: '100%', marginLeft: '10px', border: '1px solid #500', color: '#f55' }}
                        >
                          DELETE
                        </SmallButton>
                      </ModuleItem>
                    ))}
                    <SmallButton onClick={addTimelineEvent} style={{ padding: '10px', background: '#222' }}>+ ADD TIMELINE EVENT</SmallButton>
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
                          style={{ flex: 1, minHeight: '50px' }}
                        />
                        <SmallButton
                          onClick={() => removeFact(i)}
                          style={{ marginLeft: '10px', marginTop: '5px', border: '1px solid #500', color: '#f55' }}
                        >
                          X
                        </SmallButton>
                      </ModuleItem>
                    ))}
                    <SmallButton onClick={addFact} style={{ padding: '10px', background: '#222' }}>+ ADD FACT</SmallButton>
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
                />

                <div style={{ display: 'flex', gap: '20px' }}>
                  <InputGroup style={{ flex: 1 }}>
                    <label>Base Aggravation (0-100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={(activeSuspect as Suspect).baseAggravation}
                      onChange={(e) => handleSuspectChange(activeSuspect.id, 'baseAggravation', parseInt(e.target.value))}
                    />
                  </InputGroup>

                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', background: '#200', padding: '10px', border: '1px solid #500' }} data-cursor="pointer">
                    <input
                      type="checkbox"
                      checked={(activeSuspect as Suspect).isGuilty}
                      onChange={(e) => handleSuspectChange(activeSuspect.id, 'isGuilty', e.target.checked)}
                      style={{ width: '20px', height: '20px' }}
                      data-cursor="pointer"
                    />
                    <label style={{ color: '#f55', fontWeight: 'bold', cursor: 'pointer' }} data-cursor="pointer">
                      GUILTY
                    </label>
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '10px' }}>
              <SaveButton onClick={handleSave} disabled={loadingState.visible} style={{ flex: 1 }}>SAVE</SaveButton>
              <SaveButton onClick={handleCheckConsistency} disabled={loadingState.visible} style={{ flex: 1 }}>CHECK CONSISTENCY</SaveButton>
              <SaveButton onClick={handleCancel} disabled={loadingState.visible} style={{ flex: 1, background: '#444', color: '#ccc' }}>CLOSE</SaveButton>
            </div>
            <StartButton onClick={onStart}>CASE HUB</StartButton>

          </div>
        )}
      </Panel>
      {consistencyModal.visible && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#111',
            padding: '25px',
            border: '1px solid #444',
            maxWidth: '800px',
            width: '95%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 0 50px rgba(0,0,0,0.5)',
            borderRadius: '8px'
          }}>
            <h2 style={{ color: '#fff', marginTop: 0, borderBottom: '1px solid #333', paddingBottom: '15px', fontSize: '1.5rem' }}>Narrative Audit Report</h2>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              paddingRight: '10px',
              margin: '15px 0'
            }}>
              {consistencyModal.report && typeof consistencyModal.report === 'object' ? (
                <>
                  <section style={{ marginBottom: '25px' }}>
                    <h3 style={{ color: '#f55', fontSize: '1.1rem', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Issues Detected</h3>
                    <div style={{ color: '#bbb', fontSize: '0.95rem' }}>
                      <Markdown>{consistencyModal.report.issuesFound || 'No issues detected.'}</Markdown>
                    </div>
                  </section>

                  <section style={{ marginBottom: '25px' }}>
                    <h3 style={{ color: '#0f0', fontSize: '1.1rem', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '1px' }}>Proposed Repairs</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
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
                            padding: '15px',
                            borderRadius: '6px',
                            borderLeft: '3px solid #0f0',
                            display: 'flex',
                            gap: '15px',
                            alignItems: 'flex-start'
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: '#eee', fontSize: '1rem', fontWeight: 500 }}>{change.description}</div>
                              {evidence && (
                                <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#888', fontStyle: 'italic' }}>
                                  Linked to: {evidence.title}
                                </div>
                              )}
                            </div>
                            {isNewEvidence && evidence?.imageUrl && (
                              <div style={{ width: '80px', height: '80px', flexShrink: 0, borderRadius: '4px', overflow: 'hidden', border: '1px solid #333' }}>
                                <img src={evidence.imageUrl} alt={evidence.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section>
                    <h3 style={{ color: '#aaa', fontSize: '1.1rem', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Conclusion</h3>
                    <p style={{ color: '#999', fontSize: '0.95rem', lineHeight: '1.5' }}>{consistencyModal.report.conclusion}</p>
                  </section>
                </>
              ) : (
                <div style={{ color: '#ddd' }}>{String(consistencyModal.report)}</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '15px', marginTop: '20px', borderTop: '1px solid #333', paddingTop: '20px', justifyContent: 'flex-end' }}>
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
          <div style={{ background: '#111', padding: '20px', border: '1px solid #333', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ color: '#fff', marginTop: 0 }}>Delete Suspect</h3>
            <p style={{ color: '#ccc' }}>Are you sure you want to remove {suspectToDelete.name}?</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
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
