
import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { type } from '../theme';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: calc(var(--space) * 5);
  gap: calc(var(--space) * 4);
`;

const Title = styled.h2`
  ${type.h2}
  color: var(--color-text-bright);
  margin: 0;
  text-shadow: 0 0 10px var(--color-text-bright);
`;

const PromptInput = styled.textarea`
  ${type.h3}
  width: 100%;
  max-width: 600px;
  height: 150px;
  background: var(--color-surface-inset);
  border: 2px solid var(--color-border);
  color: var(--color-accent-green);
  padding: calc(var(--space) * 3);
  resize: none;
  box-shadow: inset 0 0 20px rgba(0,0,0,0.8);
  text-transform: none;

  &:focus {
    outline: none;
    border-color: var(--color-accent-green);
    box-shadow: inset 0 0 20px var(--color-accent-green-dark), 0 0 10px var(--color-accent-green);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: calc(var(--space) * 3);

  @media (max-width: 768px) {
    flex-direction: column;
    width: 100%;
    gap: var(--space);
  }
`;

const ActionButton = styled.button<{ $primary?: boolean }>`
  ${type.h3}
  background: ${props => props.$primary ? 'var(--color-accent-green)' : 'var(--color-border-subtle)'};
  color: ${props => props.$primary ? 'var(--color-text-inverse)' : 'var(--color-text)'};
  border: ${props => props.$primary ? 'none' : '1px solid var(--color-border-strong)'};
  padding: calc(var(--space) * 2) calc(var(--space) * 4);
  cursor: pointer;
  font-weight: bold;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    transform: scale(1.05);
    background: ${props => props.$primary ? '#3f3' : 'var(--color-border-strong)'};
    color: ${props => props.$primary ? 'var(--color-text-inverse)' : 'var(--color-text-bright)'};
    box-shadow: 0 0 15px ${props => props.$primary ? 'var(--color-accent-green)' : 'rgba(255,255,255,0.2)'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: wait;
    filter: grayscale(1);
  }
`;

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
`;

const LoadingText = styled.div`
  ${type.h3}
  color: var(--color-accent-green);
  margin-top: calc(var(--space) * 3);
  text-align: center;
  
  &::after {
    content: '_';
    animation: ${blink} 0.5s infinite;
  }
`;

const ProgressBar = styled.div`
  width: 400px;
  height: 10px;
  background: var(--color-border-subtle);
  border: 1px solid var(--color-border-strong);
  margin-top: calc(var(--space) * 1.25);
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    top: 0; left: 0; bottom: 0;
    width: 30%;
    background: var(--color-accent-green);
    animation: slide 1.5s infinite ease-in-out;
  }

  @keyframes slide {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }
`;

const DescriptionText = styled.p`
  ${type.bodyLg}
  color: var(--color-text-subtle);
  max-width: 600px;
  text-align: center;

  @media (max-width: 768px) {
    ${type.small}
  }
`;

const SmallCancelButton = styled(ActionButton)`
  ${type.body}
  margin-top: calc(var(--space) * 1.25);
  padding: var(--space) calc(var(--space) * 2.5);
`;

const LoadingWrapper = styled.div`
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const NoteText = styled.p`
  ${type.small}
  color: var(--color-text-dim);
  margin-top: calc(var(--space) * 2.5);
  font-style: italic;
  max-width: 400px;
`;

interface CreateCaseProps {
  onGenerate: (prompt: string, isLucky: boolean) => void;
  onCancel: () => void;
  isLoading: boolean;
  loadingStatus?: string;
}

const CreateCase: React.FC<CreateCaseProps> = ({ onGenerate, onCancel, isLoading, loadingStatus }) => {
  const [prompt, setPrompt] = useState('');

  return (
    <Container>
      <Title>New Investigation</Title>

      {!isLoading ? (
        <>
          <DescriptionText>
            Describe the crime you want to solve. Be as specific or as vague as you like.
            <br /><br />
            <i>"A murder at a jazz club in 1920s New York."</i>
            <br />
            <i>"Theft of a cybernetic arm on Mars."</i>
          </DescriptionText>

          <PromptInput
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type your case concept here..."
            autoFocus
          />

          <ButtonGroup>
            <ActionButton onClick={() => onGenerate('', true)} disabled={isLoading}>
              I'm Feeling Lucky
            </ActionButton>
            <ActionButton $primary onClick={() => onGenerate(prompt, false)} disabled={!prompt.trim() || isLoading}>
              Generate & Review
            </ActionButton>
          </ButtonGroup>

          <SmallCancelButton onClick={onCancel}>
            Cancel
          </SmallCancelButton>
        </>
      ) : (
        <LoadingWrapper>
          <LoadingText>
            {loadingStatus || "ANALYZING CRIME SCENE DATA..."}
          </LoadingText>

          <ProgressBar />

          <NoteText>
            Note: Generating case details and descriptions for every suspect takes quite a bit of time. Time for a cup of coffee, Detective. This is gonna take a minute or two.
          </NoteText>
        </LoadingWrapper>
      )}
    </Container>
  );
};

export default CreateCase;
