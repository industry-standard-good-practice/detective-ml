
import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
  gap: 30px;
`;

const Title = styled.h2`
  font-size: var(--type-h2);
  color: #fff;
  text-transform: uppercase;
  margin: 0;
  text-shadow: 0 0 10px #fff;
`;

const PromptInput = styled.textarea`
  width: 100%;
  max-width: 600px;
  height: 150px;
  background: #050505;
  border: 2px solid #333;
  color: #0f0;
  font-family: 'VT323', monospace;
  font-size: var(--type-h3);
  padding: 20px;
  resize: none;
  box-shadow: inset 0 0 20px rgba(0,0,0,0.8);

  &:focus {
    outline: none;
    border-color: #0f0;
    box-shadow: inset 0 0 20px rgba(0,50,0,0.5), 0 0 10px #0f0;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 20px;
`;

const ActionButton = styled.button<{ $primary?: boolean }>`
  background: ${props => props.$primary ? '#0f0' : '#222'};
  color: ${props => props.$primary ? '#000' : '#ccc'};
  border: ${props => props.$primary ? 'none' : '1px solid #555'};
  padding: 15px 30px;
  font-family: inherit;
  font-size: var(--type-h3);
  cursor: pointer;
  text-transform: uppercase;
  font-weight: bold;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    transform: scale(1.05);
    background: ${props => props.$primary ? '#3f3' : '#444'};
    color: ${props => props.$primary ? '#000' : '#fff'};
    box-shadow: 0 0 15px ${props => props.$primary ? '#0f0' : 'rgba(255,255,255,0.2)'};
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
  font-size: var(--type-h3);
  color: #0f0;
  margin-top: 20px;
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
  color: var(--color-text-subtle);
  max-width: 600px;
  text-align: center;
  font-size: var(--type-body-lg);
`;

const SmallCancelButton = styled(ActionButton)`
  margin-top: calc(var(--space) * 1.25);
  font-size: var(--type-body);
  padding: var(--space) calc(var(--space) * 2.5);
`;

const LoadingWrapper = styled.div`
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const NoteText = styled.p`
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
