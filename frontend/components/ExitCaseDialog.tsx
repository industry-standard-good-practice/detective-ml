
import React from 'react';
import { type } from '../theme';
import styled from 'styled-components';
import { Overlay, ModalBox, ModalTitle, ModalText, ModalButtonRow, Button } from './ui';

const FixedOverlay = styled(Overlay)`
  position: fixed;
  z-index: 999;
  padding: calc(var(--space) * 2);
`;

const DialogBox = styled(ModalBox)`
  width: 100%;
  max-width: 400px;
  border-color: var(--color-accent-red);
  box-shadow: 0 0 30px rgba(255, 0, 0, 0.2);
`;

const DialogTitle = styled(ModalTitle)`
  ${type.h3}
  color: var(--color-accent-red-bright);
  text-shadow: none;
`;

const DialogText = styled(ModalText)`
  color: var(--color-text-muted);
  ${type.body}
  margin-bottom: calc(var(--space) * 1.25);
`;

const UnsavedWarning = styled.div`
  background: rgba(255, 170, 0, 0.1);
  border: 1px solid rgba(255, 170, 0, 0.3);
  color: var(--color-accent-orange);
  padding: calc(var(--space) * 1.25) calc(var(--space) * 2);
  margin-bottom: calc(var(--space) * 2.5);
  ${type.small}
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const CancelBtn = styled(Button).attrs({ $variant: 'ghost' as const })`
  background: var(--color-border-subtle);
  border: 1px solid var(--color-border-strong);
  ${type.body}
  &:hover { background: var(--color-border); color: var(--color-text-bright); }
`;

const DangerBtn = styled(Button).attrs({ $variant: 'danger' as const })`
  ${type.body}
  color: var(--color-accent-red-bright);
  &:hover { color: var(--color-text-bright); }
`;

interface ExitCaseDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
  hasUnsavedChanges?: boolean;
}

const ExitCaseDialog: React.FC<ExitCaseDialogProps> = ({ onConfirm, onCancel, hasUnsavedChanges }) => {
  return (
    <FixedOverlay onClick={onCancel}>
      <DialogBox onClick={e => e.stopPropagation()}>
        <DialogTitle>⚠ Exit Case</DialogTitle>
        {hasUnsavedChanges && (
          <UnsavedWarning>
            ⚠ You have unsaved changes to this case that will be lost.
          </UnsavedWarning>
        )}
        <DialogText>
          {hasUnsavedChanges
            ? 'Any unsaved edits to suspects, evidence, timelines, and case details will be permanently lost.'
            : 'All case progress will be lost. Evidence gathered, interrogation history, and timeline entries will not be saved.'}
        </DialogText>
        <ModalButtonRow>
          <CancelBtn onClick={onCancel}>Cancel</CancelBtn>
          <DangerBtn onClick={onConfirm}>Exit Case</DangerBtn>
        </ModalButtonRow>
      </DialogBox>
    </FixedOverlay>
  );
};

export default ExitCaseDialog;
