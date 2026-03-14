
import React from 'react';
import styled from 'styled-components';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
`;

const DialogBox = styled.div`
  background: #111;
  border: 2px solid #f00;
  padding: 30px;
  max-width: 400px;
  width: 90%;
  text-align: center;
  box-shadow: 0 0 30px rgba(255, 0, 0, 0.2);
`;

const Title = styled.h3`
  color: #f44;
  margin: 0 0 15px 0;
  font-size: var(--type-h3);
  text-transform: uppercase;
`;

const Text = styled.p`
  color: #aaa;
  margin: 0 0 25px 0;
  font-size: var(--type-body);
  line-height: 1.5;
`;

const UnsavedWarning = styled.div`
  background: rgba(255, 170, 0, 0.1);
  border: 1px solid rgba(255, 170, 0, 0.3);
  color: #fa0;
  padding: 10px 15px;
  margin-bottom: 20px;
  font-size: var(--type-small);
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const Buttons = styled.div`
  display: flex;
  gap: 15px;
  justify-content: center;
`;

const Button = styled.button<{ $danger?: boolean }>`
  background: ${p => p.$danger ? '#500' : '#222'};
  color: ${p => p.$danger ? '#f55' : '#ccc'};
  border: 1px solid ${p => p.$danger ? '#f00' : '#555'};
  padding: 10px 25px;
  font-family: inherit;
  font-size: var(--type-body);
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.2s;

  &:hover {
    background: ${p => p.$danger ? '#700' : '#333'};
    color: #fff;
  }
`;

interface ExitCaseDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
  hasUnsavedChanges?: boolean;
}

const ExitCaseDialog: React.FC<ExitCaseDialogProps> = ({ onConfirm, onCancel, hasUnsavedChanges }) => {
  return (
    <Overlay onClick={onCancel}>
      <DialogBox onClick={e => e.stopPropagation()}>
        <Title>⚠ Exit Case</Title>
        {hasUnsavedChanges && (
          <UnsavedWarning>
            ⚠ You have unsaved changes to this case that will be lost.
          </UnsavedWarning>
        )}
        <Text>
          All case progress will be lost. Evidence gathered, interrogation history, and timeline entries will not be saved.
        </Text>
        <Buttons>
          <Button onClick={onCancel}>Cancel</Button>
          <Button $danger onClick={onConfirm}>Exit Case</Button>
        </Buttons>
      </DialogBox>
    </Overlay>
  );
};

export default ExitCaseDialog;
