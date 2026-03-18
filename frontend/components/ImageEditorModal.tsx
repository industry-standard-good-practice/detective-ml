
import React, { useState, useEffect, useRef } from 'react';
import { type } from '../theme';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wand2, Save, Undo, Loader2, AlertCircle, ImagePlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { editImageWithPrompt, createImageFromPrompt } from '../services/geminiImages';

const Overlay = styled(motion.div)`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(var(--space) * 3);
`;

const Modal = styled(motion.div)`
  background: #1a1a1a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  width: 100%;
  max-width: 900px;
  max-height: 95%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  position: relative;
  overflow: hidden;
`;

const Header = styled.div`
  padding: calc(var(--space) * 2) calc(var(--space) * 3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
`;

const Title = styled.h2`
  ${type.bodyLg}
  font-weight: 600;
  color: white;
  margin: 0;
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  padding: var(--space);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  margin-right: -8px;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
`;

const Content = styled.div`
  padding: calc(var(--space) * 3);
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: calc(var(--space) * 3);
  overflow-y: auto;
  min-height: 0;

  @media (max-width: 850px) {
    grid-template-columns: 1fr;
  }
`;

const ImageContainer = styled.div`
  background: #000;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.05);
  max-height: 50vh;
`;

const PreviewImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
`;

const Controls = styled.div`
  display: flex;
  flex-direction: column;
  gap: calc(var(--space) * 2);
  min-height: 0;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space);
  flex: 1;
  min-height: 0;
`;

const Label = styled.label`
  ${type.small}
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const TextArea = styled.textarea`
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: calc(var(--space) * 2);
  color: white;
  ${type.body}
  resize: none;
  flex: 1;
  min-height: 100px;
  transition: all 0.2s;
  line-height: 1.5;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    background: rgba(255, 255, 255, 0.06);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  &::placeholder {
    color: rgba(255, 255, 255, 0.2);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: calc(var(--space) * 2);
  flex-shrink: 0;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space);
  padding: calc(var(--space) * 2) calc(var(--space) * 2);
  font-weight: 600;
  ${type.small}
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
  white-space: nowrap;

  ${props => props.$variant === 'primary' ? `
    background: #3b82f6;
    color: white;
    &:hover:not(:disabled) { background: #2563eb; }
  ` : props.$variant === 'danger' ? `
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    &:hover:not(:disabled) { background: rgba(239, 68, 68, 0.2); }
  ` : `
    background: rgba(255, 255, 255, 0.05);
    color: white;
    &:hover:not(:disabled) { background: rgba(255, 255, 255, 0.1); }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const LoadingOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(var(--space) * 2);
  color: white;
  z-index: 10;
  padding: calc(var(--space) * 3);
  text-align: center;
`;

const ProgressBar = styled.div`
  width: 100%;
  max-width: 200px;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
  margin-top: var(--space);
`;

const ProgressFill = styled(motion.div)`
  height: 100%;
  background: #3b82f6;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
`;

interface ImageEditorModalProps {
  initialImageUrl?: string;
  onSave: (newImageUrl: string, onProgress?: (current: number, total: number) => void) => Promise<void>;
  onClose: () => void;
  aspectRatio?: string;
  title?: string;
}

const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  initialImageUrl,
  onSave,
  onClose,
  aspectRatio = '3:4',
  title = "Edit Image"
}) => {
  const isCreateMode = !initialImageUrl;
  const [currentImageUrl, setCurrentImageUrl] = useState(initialImageUrl || '');
  const [history, setHistory] = useState<string[]>(initialImageUrl ? [initialImageUrl] : []);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // If the initial image is a remote URL, try to fetch it and convert to base64
    // to avoid CORS issues during editing.
    if (!initialImageUrl) return;
    const prepareImage = async () => {
      if (initialImageUrl.startsWith('http')) {
        try {
          const response = await fetch(`/api/proxy-image?url=${encodeURIComponent(initialImageUrl)}`);
          if (response.ok) {
            const data = await response.json();
            if (data.base64) {
              setCurrentImageUrl(data.base64);
              setHistory([data.base64]);
            }
          }
        } catch (err) {
          console.warn("Could not proxy image for CORS-safe editing", err);
        }
      }
    };
    prepareImage();
  }, [initialImageUrl]);

  const getBase64FromImage = (): string | null => {
    if (!imageRef.current) return null;

    // If it's already a data URL, return it
    if (currentImageUrl.startsWith('data:')) return currentImageUrl;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageRef.current.naturalWidth;
      canvas.height = imageRef.current.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(imageRef.current, 0, 0);
      // This might still fail if the image was loaded from a remote source without CORS
      return canvas.toDataURL('image/png');
    } catch (err) {
      // Silent failure for canvas extraction to avoid UI error badges.
      // The background pre-fetch usually handles this.
      return null;
    }
  };

  const handleEdit = async () => {
    if (!prompt.trim() || isGenerating || isSaving) return;
    setError(null);

    setIsGenerating(true);
    try {
      let result: string | null = null;

      if (!currentImageUrl) {
        // Create mode: generate from scratch
        result = await createImageFromPrompt(prompt, aspectRatio);
      } else {
        // Edit mode: modify existing image
        const base64 = getBase64FromImage();
        if (!base64) {
          setError("Could not process image for editing. This might be a cross-origin issue.");
          setIsGenerating(false);
          return;
        }
        result = await editImageWithPrompt(base64, prompt, aspectRatio);
      }

      if (result) {
        setHistory(prev => [...prev, result!]);
        setCurrentImageUrl(result);
        setPrompt('');
      } else {
        setError(isCreateMode && !currentImageUrl ? "Failed to generate image. Try a different description." : "Failed to edit image. The AI might have had trouble with your prompt.");
      }
    } catch (err: any) {
      console.error(err);
      const errorMsg = err?.message || 'An unexpected error occurred while editing.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (isSaving || isGenerating) return;
    setIsSaving(true);
    try {
      await onSave(currentImageUrl, (current, total) => {
        setSavingProgress({ current, total });
      });
    } catch (err: any) {
      console.error(err);
      const errorMsg = err?.message || 'Failed to save changes.';
      toast.error(`Save failed: ${errorMsg}`);
      setIsSaving(false);
    }
  };

  const handleUndo = () => {
    if (history.length <= 1 || isSaving || isGenerating) return;
    const newHistory = [...history];
    newHistory.pop();
    setHistory(newHistory);
    setCurrentImageUrl(newHistory[newHistory.length - 1]);
  };

  return (
    <AnimatePresence>
      <Overlay
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={isSaving ? undefined : onClose}
      >
        <Modal
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Header>
            <Title>{title}</Title>
            <CloseButton onClick={onClose} disabled={isSaving}>
              <X size={20} />
            </CloseButton>
          </Header>

          <Content>
            <ImageContainer style={{ aspectRatio }}>
              {currentImageUrl ? (
                <PreviewImage
                  ref={imageRef}
                  src={currentImageUrl}
                  alt="Preview"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'calc(var(--space) * 2)', color: 'rgba(255,255,255,0.3)', padding: 'calc(var(--space) * 5)', textAlign: 'center' }}>
                  <ImagePlus size={48} />
                  <span style={{ fontSize: 'var(--type-small)' }}>Describe your character below to generate a portrait</span>
                </div>
              )}
              {isGenerating && (
                <LoadingOverlay>
                  <Loader2 className="animate-spin" size={32} />
                  <span>Nano Banana is working...</span>
                </LoadingOverlay>
              )}
              {isSaving && (
                <LoadingOverlay>
                  <Loader2 className="animate-spin" size={32} />
                  <span>Generating Emotion Alternates...</span>
                  {savingProgress.total > 0 && (
                    <>
                      <span style={{ fontSize: 'var(--type-small)', opacity: 0.8 }}>
                        {savingProgress.current} / {savingProgress.total}
                      </span>
                      <ProgressBar>
                        <ProgressFill
                          initial={{ width: 0 }}
                          animate={{ width: `${(savingProgress.current / savingProgress.total) * 100}%` }}
                        />
                      </ProgressBar>
                    </>
                  )}
                </LoadingOverlay>
              )}
            </ImageContainer>

            <Controls>
              <InputGroup>
                <Label>{currentImageUrl ? 'What would you like to change?' : 'Describe the character to generate'}</Label>
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <TextArea
                    placeholder={currentImageUrl ? "e.g., 'Change his hair to red', 'Add a scar over his left eye', 'Make her wear a detective hat'..." : "e.g., 'A stern female detective with short gray hair, wearing a trench coat'..."}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={isGenerating || isSaving}
                    style={{ paddingBottom: 'calc(var(--space) * 9)' }}
                  />
                  <div style={{
                    position: 'absolute', bottom: '1px', left: '1px', right: '1px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 8px',
                    }}>
                    <Button
                      onClick={handleUndo}
                      disabled={isGenerating || isSaving || history.length <= 1}
                      style={{ flex: 'none', padding: '8px 14px', fontSize: 'var(--type-small)' }}
                    >
                      <Undo size={14} />
                      Undo
                    </Button>
                    <Button
                      $variant="primary"
                      onClick={handleEdit}
                      disabled={isGenerating || isSaving || !prompt.trim()}
                      style={{ flex: 'none', width: '36px', height: '36px', padding: 0, }}
                      title="Generate Edit"
                    >
                      <Wand2 size={16} />
                    </Button>
                  </div>
                </div>
                {error && (
                  <div style={{ color: '#ef4444', fontSize: 'var(--type-small)', display: 'flex', alignItems: 'center', gap: 'var(--space)', marginTop: 'var(--space)' }}>
                    <AlertCircle size={14} />
                    {error}
                  </div>
                )}
              </InputGroup>

              <ButtonGroup>
                <Button $variant="danger" onClick={onClose} disabled={isGenerating || isSaving}>
                  Cancel
                </Button>
                <Button $variant="primary" onClick={handleSave} disabled={isGenerating || isSaving || !currentImageUrl}>
                  <Save size={16} />
                  Save Edit
                </Button>
              </ButtonGroup>
            </Controls>
          </Content>
        </Modal>
      </Overlay>
    </AnimatePresence>
  );
};

export default ImageEditorModal;
