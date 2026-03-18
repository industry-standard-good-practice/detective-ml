
import React, { useState, useEffect, useRef } from 'react';
import { type } from '../theme';
import styled, { keyframes } from 'styled-components';
import toast from 'react-hot-toast';
import { CaseData, Suspect, ChatMessage, Emotion, Evidence, TimelineStatement } from '../types';
import SuspectCard from '../components/SuspectCard';
import SuspectCardDock from '../components/SuspectCardDock';
import AsciiCelebration from '../components/AsciiCelebration';
import SuspectPortrait from '../components/SuspectPortrait';
import { generateTTS } from '../services/geminiTTS';
import { playAudioFromUrl, AudioPlayback } from '../services/audioPlayer';
import { useOnboarding, OnboardingStep } from '../contexts/OnboardingContext';
import { OnboardingOverlay, OnboardingHighlight, OnboardingTooltip } from '../components/OnboardingTour';
import { hasNativeSpeechRecognition } from '../services/geminiSTT';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  overflow: hidden;
  
  @media (max-width: 768px) {
    overflow-y: auto;
  }
  
  /* CSS Variable for card deck spacing, responsive */
  --card-spacing: 190px;
`;


const MainContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
  padding: 20px var(--screen-edge-horizontal) calc(var(--screen-edge-bottom) + 50px + 10px) var(--screen-edge-horizontal);
  gap: calc(var(--space) * 3);
  position: relative;
  z-index: 1;
  justify-content: center;

  @media (max-width: 1280px) {
    gap: calc(var(--space) * 2);
    padding: 15px var(--screen-edge-horizontal) calc(var(--screen-edge-bottom) + 50px + 10px) var(--screen-edge-horizontal);
  }
  
  @media (max-width: 768px) {
    flex-direction: column;
    padding: 0;
    gap: 0;
  }
`;

const GhostLeftPanel = styled.div`
  flex: 1;
  min-width: 280px;
  height: 100%;
  pointer-events: none;
  transition: flex-basis 0.3s ease;
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const ChatPanel = styled.div`
  flex: 0 1 900px;
  max-width: 900px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  padding: 0; /* REMOVED PADDING to flush scrollbar */
  height: 100%;
  background: rgba(0,0,0,0.2);
  position: relative;
  min-width: 350px;
  overflow: hidden; 
  
  @media (max-width: 768px) {
    min-width: 0;
    width: 100%;
    border: none;
    flex: 1;
    max-width: none;
  }
`;

const ChatLog = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: calc(var(--space) * 2);
  padding: calc(var(--space) * 3); /* Added padding inside scrolling area */
  padding-bottom: calc(var(--space) * 3);

  /* Flush Scrollbar Styling */
  &::-webkit-scrollbar {
    width: 10px;
  }
  &::-webkit-scrollbar-track {
    background: var(--color-surface);
    border-left: 1px solid var(--color-border);
  }
  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border: 1px solid var(--color-border-strong);
  }
  &::-webkit-scrollbar-thumb:hover {
    background: var(--color-border-strong);
  }
  
  @media (max-width: 768px) {
    padding: var(--space);
  }
`;

const EvidenceChip = styled.div<{ $collected: boolean }>`
  margin-top: var(--space);
  background: ${props => props.$collected ? 'var(--color-evidence-collected)' : 'var(--color-evidence-yellow)'};
  color: var(--color-text-inverse);
  border: 2px dashed ${props => props.$collected ? 'var(--color-evidence-collected)' : 'var(--color-evidence-border)'};
  padding: var(--space) var(--space);
  ${type.small}
  font-weight: bold;
  cursor: ${props => props.$collected ? 'default' : 'pointer'};
  &[data-cursor] { cursor: ${props => props.$collected ? 'default' : 'pointer'}; }
  display: inline-block;
  align-self: flex-start;
  animation: fadeIn 0.5s;

  &:hover {
    background: ${props => props.$collected ? 'var(--color-evidence-collected)' : 'var(--color-text-bright)'};
  }
  
  &::before {
    content: '${props => props.$collected ? '✓ EVIDENCE LOGGED: ' : '⚠ NEW EVIDENCE: '} ';
  }
`;

const MessageBubble = styled.div<{ $sender: 'player' | 'suspect' | 'officer' | 'partner' | 'system', $isAction?: boolean, $customColor?: string }>`
  align-self: ${props => {
    if (props.$sender === 'system') return 'center';
    return props.$sender === 'player' ? 'flex-end' : 'flex-start';
  }};
  max-width: 80%;
  display: flex;
  flex-direction: column;
  text-align: ${props => props.$sender === 'system' ? 'center' : 'left'};
  
  .sender-name {
    ${type.small}
    color: ${props => {
    if (props.$sender === 'player') return 'var(--color-player-name)';
    if (props.$sender === 'partner') return 'var(--color-partner-name)';
    if (props.$sender === 'system') return 'var(--color-accent-red)';
    if (props.$customColor) return props.$customColor;
    return 'var(--color-suspect-name)';
  }};
    margin-bottom: var(--space);
    display: block;
    align-self: ${props => {
    if (props.$sender === 'system') return 'center';
    return props.$sender === 'player' ? 'flex-end' : 'flex-start';
  }};
    font-weight: bold;
    text-shadow: 0 0 2px rgba(0,0,0,0.5);
  }

  .text {
    color: ${props => {
    if (props.$sender === 'partner') return 'var(--color-partner-text)';
    if (props.$sender === 'system') return 'var(--color-system-text)';
    return 'var(--color-player-text)';
  }};
    ${type.bodyLg}
    line-height: 1.4;
    font-style: ${props => props.$isAction ? 'italic' : 'normal'};
    background: ${props => {
    if (props.$sender === 'player') return 'var(--color-player-bg)';
    if (props.$sender === 'partner') return 'var(--color-partner-bg)';
    if (props.$sender === 'system') return 'var(--color-system-bg)';
    return 'transparent';
  }};
    padding: ${props => (props.$sender === 'player' || props.$sender === 'partner' || props.$sender === 'system') ? '8px 12px' : '0'};
    border: ${props => {
    if (props.$isAction && props.$sender === 'player') return '1px dashed var(--color-player-name)';
    if (props.$sender === 'partner') return '1px solid var(--color-partner-border)';
    if (props.$sender === 'system') return '1px solid var(--color-accent-red)';
    return 'none';
  }};
  }

  .attachment {
    align-self: flex-end;
    ${type.small}
    background: var(--color-border);
    color: var(--color-text-muted);
    padding: 0 var(--space);
    margin-top: var(--space);
    border: 1px solid var(--color-border-strong);
  }
`;

const InputContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space);
  padding: calc(var(--space) * 3);
  width: 100%;
  background: #080808; /* Solid background to obscure scrolling text */
  border-top: 1px solid var(--color-border);
  
  @media (max-width: 768px) {
    padding: 10px var(--screen-edge-horizontal);
    padding-bottom: calc(var(--screen-edge-bottom) + 15px);
  }
`;

const UnifiedInputBar = styled.div<{ $disabled: boolean }>`
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border);
  background: var(--color-surface-inset);
  height: 50px;
  opacity: ${props => props.$disabled ? 0.6 : 1};
  transition: all 0.2s;
  
  &:focus-within {
    border-color: var(--color-border-focus);
    box-shadow: 0 0 10px rgba(255,255,255,0.1);
  }
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const MobileInputRow = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    border: 1px solid var(--color-border);
    background: var(--color-surface-inset);
    height: 56px;
    
    &:focus-within {
      border-color: var(--color-border-focus);
      box-shadow: 0 0 10px rgba(255,255,255,0.1);
    }
  }
`;

const MobileButtonRow = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 40px;
    margin-top: var(--space);
    
    button {
      height: 100%;
    }
  }
`;

const TypeButtonWrapper = styled.div`
  position: relative;
  height: 100%;
`;

const TypeButton = styled.button<{ $disabled: boolean }>`
  background-color: transparent;
  color: var(--color-text-subtle);
  border: none;
  border-right: 1px solid var(--color-border);
  height: 100%;
  padding: 0 35px 0 15px;
  font-family: 'VT323', monospace;
  ${type.body}
  cursor: pointer;
  text-transform: uppercase;
  position: relative;
  white-space: nowrap;
  transition: all 0.2s;

  &::after {
    content: '';
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 5px solid var(--color-text-subtle);
  }

  &:hover {
    color: var(--color-text-bright);
    background: var(--color-surface-raised);
    &::after { border-top-color: var(--color-text-bright); }
  }

  ${props => props.$disabled && `
    cursor: not-allowed;
    opacity: 0.5;
    &:hover { color: var(--color-text-subtle); background: transparent; &::after { border-top-color: var(--color-text-subtle); } }
  `}

  @media (max-width: 768px) {
    padding: 0 25px 0 8px;
    ${type.body}
    background: var(--color-border-subtle);
    border: none;
    border-right: none;
    &::after { right: 5px; }
  }
`;

const TypeMenu = styled.div`
  position: absolute;
  bottom: 110%;
  left: 0;
  background: #050505;
  border: 1px solid #555;
  width: 140px;
  z-index: 50;
  box-shadow: 0 0 20px var(--color-bg);
  display: flex;
  flex-direction: column;
`;

const TypeMenuItem = styled.button<{ $active: boolean }>`
  background: ${props => props.$active ? 'var(--color-border-subtle)' : 'transparent'};
  color: ${props => props.$active ? 'var(--color-text-bright)' : '#ccc'};
  border: none;
  padding: var(--space) calc(var(--space) * 2);
  text-align: left;
  font-family: inherit;
  ${type.body}
  cursor: pointer;
  border-bottom: 1px solid var(--color-border-subtle);
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: var(--space);
  transition: background 0.15s;

  &:last-child { border-bottom: none; }

  &:hover {
    background: var(--color-border-subtle);
    color: var(--color-text-bright);
  }
`;

const PlusButtonWrapper = styled.div`
  position: relative;
  height: 100%;
`;

const PlusButton = styled.button<{ $active: boolean }>`
  background: transparent;
  border: none;
  color: ${props => props.$active ? 'var(--color-text-bright)' : 'var(--color-border)'};
  width: 40px;
  height: 100%;
  ${type.h2}
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  
  &:hover {
    color: var(--color-text-bright);
    text-shadow: 0 0 5px var(--color-text-bright);
  }
`;

const micPulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;

const MicButton = styled.button<{ $listening: boolean; $transcribing?: boolean }>`
  background: ${props => props.$transcribing ? '#b86e00' : props.$listening ? '#f00' : '#222'};
  border: none;
  border-left: 1px solid #333;
  color: ${props => (props.$listening || props.$transcribing) ? '#fff' : '#666'};
  width: 50px;
  height: 100%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  ${props => props.$transcribing && `animation: ${micPulse} 1s ease-in-out infinite;`}
  
  &:hover {
    background: ${props => props.$transcribing ? '#a06000' : props.$listening ? '#d00' : '#333'};
    color: var(--color-text-bright);
  }
  
  svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
    filter: drop-shadow(0 0 2px rgba(0,0,0,0.5));
  }
`;

const EvidenceMenu = styled.div`
  position: absolute;
  bottom: 110%;
  left: 0;
  background: var(--color-surface-inset);
  border: 1px solid #555;
  width: 280px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 50;
  box-shadow: 0 0 20px #000;
  display: flex;
  flex-direction: column;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
  }
`;

const TimelineEvidenceOption = styled.button`
  background: var(--color-officer-button);
  color: var(--color-text-bright);
  border: 1px solid var(--color-officer-border);
  padding: calc(var(--space) * 2);
  margin: var(--space) var(--space);
  text-align: left;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: var(--space);
  box-shadow: 0 4px 10px rgba(0,0,0,0.3);
  transition: transform 0.1s, background 0.2s;
  
  &:hover {
    background: #2c3e50;
    transform: translateY(-2px);
  }

  .header {
    display: flex;
    align-items: center;
    gap: var(--space);
    border-bottom: 1px solid rgba(65, 90, 119, 0.5);
    padding-bottom: var(--space);
    margin-bottom: var(--space);
  }

  .time {
    font-family: 'VT323', monospace;
    color: var(--color-accent-green);
    ${type.bodyLg}
  }

  .suspect {
    ${type.xs}
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .statement {
    ${type.body}
    color: var(--color-text);
    line-height: 1.3;
    font-style: italic;
  }
`;

const TimelineDayHeader = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space);
  padding: 8px 12px 4px;
  margin-top: var(--space);
  
  &::before, &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--color-accent-green);
    opacity: 0.25;
  }
  
  span {
    font-family: 'VT323', monospace;
    color: var(--color-accent-green);
    ${type.small}
    letter-spacing: 2px;
    text-transform: uppercase;
    white-space: nowrap;
    text-shadow: 0 0 6px rgba(0, 255, 0, 0.2);
  }
`;

const EvidenceOption = styled.button`
  background: transparent;
  color: #ccc;
  border: none;
  padding: var(--space) calc(var(--space) * 2);
  text-align: left;
  font-family: inherit;
  ${type.body}
  cursor: pointer;
  border-bottom: 1px solid var(--color-border-subtle);
  display: flex;
  flex-direction: column;
  gap: var(--space);
  
  &:hover {
    background: var(--color-border-subtle);
    color: var(--color-text-bright);
  }
`;

const GhostInput = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  color: var(--color-text-bright);
  font-family: 'VT323', monospace;
  ${type.bodyLg}
  padding: 0 15px;
  height: 100%;
  min-width: 0;
  
  &:focus { outline: none; }
  &::placeholder { color: var(--color-border); }
  &:disabled { color: var(--color-danger-bg); cursor: not-allowed; }
`;

const SendActionBtn = styled.button`
  height: 100%;
  padding: 0 25px;
  background: var(--color-text-bright);
  color: var(--color-text-inverse);
  border: none;
  border-left: 1px solid var(--color-border);
  font-family: inherit;
  font-weight: bold;
  ${type.body}
  cursor: pointer;
  transition: background 0.2s;
  
  &:disabled {
    background: var(--color-border-subtle);
    color: var(--color-border-strong);
    cursor: not-allowed;
  }
  
  &:hover:not(:disabled) {
    background: #ddd;
  }
  
  @media (max-width: 768px) {
    padding: 0 20px;
    order: 2;
  }
`;

const AttachmentChipsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space);
  margin-bottom: var(--space);
`;

const AttachmentChip = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space);
  background: #1a1a1a;
  border: 1px dashed var(--color-border-strong);
  color: var(--color-text-bright);
  padding: var(--space) var(--space);
  ${type.small}

  button {
    background: transparent;
    border: none;
    color: var(--color-accent-red-bright);
    font-weight: bold;
    cursor: pointer;
    ${type.body}
    padding: 0;
    line-height: 1;
  }
`;

const SuggestionChips = styled.div`
  display: flex;
  gap: var(--space);
  overflow-x: auto;
  padding-bottom: var(--space);
  margin-left: -20px;
  margin-right: -20px;
  padding-left: calc(var(--space) * 3 - 4px);
  padding-right: calc(var(--space) * 3);
  width: calc(100% + 40px);
  max-width: calc(100% + 40px);
  
  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--color-border); 
  }
  &::-webkit-scrollbar-track {
    background: transparent; 
  }
  
  @media (max-width: 768px) {
    margin-left: -10px;
    margin-right: -10px;
    padding-left: var(--space);
    padding-right: var(--space);
    margin-bottom: 0px;
    width: calc(100% + 20px);
    max-width: calc(100% + 20px);
    scrollbar-width: none;
    -ms-overflow-style: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
`;

const Chip = styled.button`
  background: var(--color-border-subtle);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  padding: var(--space) var(--space);
  font-family: inherit;
  ${type.body}
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
  
  &:hover {
    border-color: #777;
    color: var(--color-text-bright);
  }
`;

const RightPanel = styled.div<{ $mobileOpen: boolean }>`
  flex: 1;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  gap: calc(var(--space) * 3);
  transition: transform 0.3s ease;
  height: 100%; 
  overflow: hidden; 

  @media (max-width: 768px) {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: calc(100% - 24px);
    background: var(--color-surface);
    z-index: 100;
    padding: calc(var(--space) * 3);
    box-shadow: -10px 0 30px rgba(0,0,0,0.8);
    border-left: 2px solid var(--color-border);
    transform: translateX(${props => props.$mobileOpen ? '0' : '100%'});
    flex: none;
    min-width: 0;
    overflow-y: auto;
  }
`;

const IntelOverlay = styled.div<{ $visible: boolean }>`
  display: none;
  @media (max-width: 768px) {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 99;
    opacity: ${props => props.$visible ? 1 : 0};
    pointer-events: ${props => props.$visible ? 'auto' : 'none'};
    transition: opacity 0.3s ease;
  }
`;

const AggravationMeter = styled.div`
  border: 1px solid var(--color-border);
  padding: calc(var(--space) * 3);
  background: var(--color-surface);
  flex-shrink: 0; 
  
  h3 { margin: 0 0 10px 0; ${type.body} color: var(--color-text-subtle); text-transform: uppercase; }
`;

const ProgressBar = styled.div<{ $level: number }>`
  height: 20px;
  width: 100%;
  background: #222;
  position: relative;
  
  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${props => props.$level}%;
    background: ${props => props.$level > 80 ? 'red' : props.$level > 50 ? 'orange' : '#ccc'};
    transition: width 0.5s ease, background 0.5s ease;
    background-image: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 5px,
      rgba(0,0,0,0.2) 5px,
      rgba(0,0,0,0.2) 10px
    );
  }
`;

const SidekickContainer = styled.div`
  flex: 1; 
  border: 1px solid var(--color-border);
  padding: calc(var(--space) * 3);
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  position: relative;
  gap: var(--space);
  overflow: hidden; 
  min-height: 0; 

  & > h3 { 
    margin: 0; 
    ${type.body} 
    color: var(--color-text-subtle); 
    text-transform: uppercase; 
  }
`;

const SidekickHeader = styled.div`
  display: flex;
  align-items: center;
  gap: calc(var(--space) * 2);
  flex-shrink: 0;
  padding-bottom: 0;
  border-bottom: none;
  margin-bottom: 0;

  .info {
    display: flex;
    flex-direction: column;
    
    h3 {
      margin: 0;
      ${type.body}
      color: #9f9; 
      text-transform: uppercase;
    }
    
    span {
      ${type.small}
      color: #686;
    }
  }
`;

const BubbleScrollArea = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding-right: var(--space);
  padding-top: calc(var(--space) * 2); 
  padding-bottom: var(--space);
  min-height: 0;
  
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: var(--color-border); }
`;

const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-2px); }
  100% { transform: translateY(0px); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const WhisperBubble = styled.div`
  background: #081008;
  border: 1px dashed #282;
  padding: calc(var(--space) * 2);
  position: relative;
  color: #8c8;
  ${type.body}
  font-style: italic;
  line-height: 1.4;
  width: 100%;
  animation: ${float} 4s ease-in-out infinite;

  p {
    margin: 0;
    animation: ${fadeIn} 0.5s ease-out;
  }
`;

const SidekickActions = styled.div`
    display: flex;
    gap: var(--space);
    margin-top: 0;
    flex-shrink: 0;
    padding-top: var(--space);
    border-top: none;
`;

const ActionButton = styled.button<{ $type: 'good' | 'bad' | 'neutral' }>`
    flex: 1;
    background: ${props => props.$type === 'good' ? '#003300' : props.$type === 'bad' ? '#330000' : 'var(--color-border-subtle)'};
    color: ${props => props.$type === 'good' ? '#6f6' : props.$type === 'bad' ? '#f66' : '#ccc'};
    border: 1px solid ${props => props.$type === 'good' ? 'var(--color-accent-green)' : props.$type === 'bad' ? 'var(--color-accent-red)' : 'var(--color-border-strong)'};
    padding: var(--space) var(--space);
    font-family: inherit;
    ${type.body}
    cursor: pointer;
    text-transform: uppercase;
    transition: all 0.2s;

    &:hover:not(:disabled) {
        background: ${props => props.$type === 'good' ? 'var(--color-accent-green)' : props.$type === 'bad' ? 'var(--color-accent-red)' : 'var(--color-border)'};
        color: var(--color-text-inverse);
    }
    
    &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
        filter: grayscale(1);
    }
`;



const DebugToggle = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  background: #300;
  color: var(--color-accent-red-bright);
  border: 1px solid var(--color-accent-red);
  font-family: 'VT323', monospace;
  ${type.small}
  cursor: pointer;
  z-index: 50;
  opacity: 0.5;
  &:hover { opacity: 1; }
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const DebugMenu = styled.div`
  position: absolute;
  top: 40px;
  right: 10px;
  background: rgba(0,0,0,0.9);
  border: 1px solid #f00;
  padding: var(--space);
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: var(--space);
  max-width: 300px;
`;

const DebugItem = styled.button`
  background: #200;
  color: #f88;
  border: none;
  text-align: left;
  padding: var(--space);
  cursor: pointer;
  font-family: 'VT323';
  ${type.small}
  &:hover { background: #400; }
`;

const DeceasedBadge = styled.div`
  color: #f00; 
  font-weight: bold; 
  ${type.bodyLg}
  margin-top: var(--space);
  border: 2px solid #f00;
  padding: var(--space);
  text-align: center;
  text-transform: uppercase;
`;

const MobileHeader = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    padding: 10px var(--screen-edge-horizontal);
    background: #111;
    border-bottom: 1px solid #333;
    flex-shrink: 0;
    gap: calc(var(--space) * 2);
  }
`;

const MobileNavBtn = styled.button`
  background: #222;
  color: #ccc;
  border: 1px solid #444;
  padding: var(--space) var(--space);
  font-family: inherit;
  ${type.body}
  cursor: pointer;
  &:hover { background: #333; }
`;

const MobileProfileBtn = styled.button`
  background: #333;
  color: #fff;
  border: 1px solid #666;
  padding: var(--space) var(--space);
  font-family: inherit;
  ${type.small}
  cursor: pointer;
`;

const ModalOverlay = styled.div`
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.9);
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(var(--space) * 3);
`;

interface InterrogationProps {
  activeCase: CaseData;
  suspect: Suspect;
  chatHistory: ChatMessage[];
  aggravationLevel: number;
  emotion: Emotion;
  partnerEmotion: Emotion;
  suspectTurnIds: Record<string, string | undefined>;
  evidenceDiscovered: Evidence[];
  suggestions: (string | { label: string; text: string })[];
  isThinking: boolean;
  sidekickComment: string | null;
  partnerCharges: number;
  gameTime?: number; // New prop
  timelineStatementsDiscovered: TimelineStatement[];
  onSendMessage: (text: string, type: 'talk' | 'action', evidence?: string) => void;
  onCollectEvidence: (msgIndex: number, evidenceName: string, suspectId: string) => void;
  onSwitchSuspect: (suspectId: string) => void;
  onForceEvidence: (suspectId: string, evidenceTitle: string) => void;
  onPartnerAction: (type: 'goodCop' | 'badCop' | 'examine' | 'hint') => void;
  mobileIntelOpen?: boolean;
  onCloseMobileIntel?: () => void;
  soundEnabled?: boolean;
  volume?: number;
  isAdmin: boolean;
  userId?: string;
  unreadSuspectIds?: Map<string, number>;
  thinkingSuspectIds?: Set<string>;
  onClearUnread?: (suspectId: string) => void;
}

const Interrogation: React.FC<InterrogationProps> = ({
  activeCase,
  suspect,
  chatHistory,
  aggravationLevel,
  emotion,
  partnerEmotion,
  suspectTurnIds,
  evidenceDiscovered,
  suggestions,
  isThinking,
  sidekickComment,
  partnerCharges,
  gameTime,
  timelineStatementsDiscovered,
  onSendMessage,
  onCollectEvidence,
  onSwitchSuspect,
  onForceEvidence,
  onPartnerAction,
  mobileIntelOpen = false,
  onCloseMobileIntel,
  soundEnabled = true,
  volume = 0.7,
  isAdmin,
  userId,
  unreadSuspectIds = new Map(),
  thinkingSuspectIds = new Set(),
  onClearUnread
}) => {
  const [inputVal, setInputVal] = useState('');
  const { completeStep, isActive: isOnboarding, currentStep: onboardingStep, evidenceTooltipSeen, dismissEvidenceTooltip } = useOnboarding();
  const [showEvidenceTooltip, setShowEvidenceTooltip] = useState(false);
  const evidenceChipRef = useRef<HTMLDivElement>(null);
  const evidenceTooltipBubbleRef = useRef<HTMLDivElement>(null);
  const [evidenceChipRect, setEvidenceChipRect] = useState<DOMRect | null>(null);
  const [inputType, setInputType] = useState<'talk' | 'action'>('talk');
  const [selectedEvidence, setSelectedEvidence] = useState<(Evidence | TimelineStatement)[]>([]);
  const [showEvidencePicker, setShowEvidencePicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [celebratingItem, setCelebratingItem] = useState<{ index: number, name: string, suspectId: string } | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [initialExamDone, setInitialExamDone] = useState(false);
  const [showMobileProfile, setShowMobileProfile] = useState(false);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPanelCenter, setLeftPanelCenter] = useState(170);
  const [leftPanelMiddle, setLeftPanelMiddle] = useState(400);
  const [leftPanelWidth, setLeftPanelWidth] = useState(300);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const lastPlayedRef = useRef<{ timestamp: string | null, index: number, text: string }>({ timestamp: null, index: -1, text: '' });
  const prevSoundEnabled = useRef(soundEnabled);

  useEffect(() => {
    const updateCenter = () => {
      if (leftPanelRef.current && containerRef.current) {
        const rect = leftPanelRef.current.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        setLeftPanelCenter(rect.left - containerRect.left + rect.width / 2);
        setLeftPanelMiddle(rect.top - containerRect.top + rect.height / 2);
        setLeftPanelWidth(rect.width);
        setViewportHeight(window.innerHeight);
      }
    };

    // Initial measure
    updateCenter();

    // Backup for font loads or other layout shifts
    const timer = setTimeout(updateCenter, 500);

    const observer = new ResizeObserver(updateCenter);
    if (leftPanelRef.current) {
      observer.observe(leftPanelRef.current);
    }
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    window.addEventListener('resize', updateCenter);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateCenter);
      clearTimeout(timer);
    };
  }, []);

  // Calculate dynamic card size based on panel width and viewport height
  // Aspect ratio is 1:1.6 (280x450)
  // We want it to fill about 85% of the panel width, but also not overflow vertically
  const maxW = leftPanelWidth * 0.85;
  const maxH = (viewportHeight - 120) * 0.85; // 120px buffer for header/footer
  const MAX_CARD_HEIGHT = 700;

  const rawCardWidth = Math.min(maxW, maxH / 1.6);
  const rawCardHeight = rawCardWidth * 1.6;

  const activeCardHeight = Math.min(rawCardHeight, MAX_CARD_HEIGHT);
  const activeCardWidth = activeCardHeight / 1.6;

  const isCreator = userId === activeCase.authorId;
  const canDebug = isAdmin || isCreator;
  const audioRef = useRef<AudioPlayback | null>(null);
  const voiceRef = useRef<string | null>(null);
  const volumeRef = useRef(volume);
  const [lastPlayedAudioUrl, setLastPlayedAudioUrl] = useState<string | null>(null);
  const isMounted = useRef(true);
  const prevChatLengthRef = useRef(chatHistory.length);
  const prevSuspectIdRef = useRef(suspect.id);
  const isFirstRenderRef = useRef(true);

  // Keep volumeRef in sync and update any playing audio in real-time
  useEffect(() => {
    volumeRef.current = volume;
    if (audioRef.current) {
      audioRef.current.setVolume(volume);
    }
  }, [volume]);

  useEffect(() => {
    voiceRef.current = suspect.voice || null;
  }, [suspect.id]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const evidenceMenuRef = useRef<HTMLDivElement>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);
  const mobileTypeMenuRef = useRef<HTMLDivElement>(null);

  // Determine if initial exam is done based on chat history
  useEffect(() => {
    // Simple heuristic: if the partner has spoken at least once in this chat history, assume they did the exam or are active
    // For a more robust "Once Only", we'd track a flag in GameState, but local state works per session for now.
    // Actually, let's scan history for the "Examination logged" comment we set in App.tsx
    const hasExam = chatHistory.some(m => m.sender === 'partner' && m.type === 'action' && !m.text.includes("hint"));
    setInitialExamDone(hasExam);
  }, [chatHistory, suspect.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, isThinking]);

  // TTS Playback Logic — only play on genuinely NEW messages
  useEffect(() => {
    const suspectChanged = suspect.id !== prevSuspectIdRef.current;
    const chatGrew = chatHistory.length > prevChatLengthRef.current;
    const isFirstRender = isFirstRenderRef.current;

    // Always update refs
    prevSuspectIdRef.current = suspect.id;
    prevChatLengthRef.current = chatHistory.length;
    isFirstRenderRef.current = false;

    // On initial mount OR suspect switch: check for unread notification
    if (isFirstRender || suspectChanged) {
      const lastMsg = chatHistory[chatHistory.length - 1];

      // If this suspect has an unread notification, play their TTS
      if ((lastMsg?.sender === 'suspect' || lastMsg?.sender === 'partner') && lastMsg?.audioUrl && soundEnabled && unreadSuspectIds.has(suspect.id)) {
        console.log("TTS Playing unread notification message", { text: lastMsg.text, audioUrl: lastMsg.audioUrl });
        setLastPlayedAudioUrl(lastMsg.audioUrl);

        if (audioRef.current) {
          audioRef.current.stop();
          audioRef.current = null;
        }

        playAudioFromUrl(lastMsg.audioUrl, volumeRef.current)
          .then(playback => { audioRef.current = playback; })
          .catch(e => console.error("Audio playback failed", e));

        // Clear the unread flag after playing
        onClearUnread?.(suspect.id);
      } else {
        // Just sync the URL so we don't replay old messages
        setLastPlayedAudioUrl(lastMsg?.audioUrl || null);
        // Still clear unread even if no audio (user has seen the message)
        if (unreadSuspectIds.has(suspect.id)) {
          onClearUnread?.(suspect.id);
        }
      }
      return;
    }

    // Only play if the chat actually grew (new message received while viewing)
    if (!chatGrew || chatHistory.length === 0) return;

    // The user is actively viewing this suspect — clear any unread flag immediately
    if (unreadSuspectIds.has(suspect.id)) {
      onClearUnread?.(suspect.id);
    }

    if (!soundEnabled) return;

    const lastMsg = chatHistory[chatHistory.length - 1];

    if ((lastMsg.sender === 'suspect' || lastMsg.sender === 'partner') && lastMsg.audioUrl && lastMsg.audioUrl !== lastPlayedAudioUrl) {
      console.log("TTS Playing message from audioUrl", { text: lastMsg.text, audioUrl: lastMsg.audioUrl });
      setLastPlayedAudioUrl(lastMsg.audioUrl);

      if (audioRef.current) {
        audioRef.current.stop();
        audioRef.current = null;
      }

      playAudioFromUrl(lastMsg.audioUrl, volumeRef.current)
        .then(playback => { audioRef.current = playback; })
        .catch(e => console.error("Audio playback failed", e));
    }
  }, [chatHistory, soundEnabled, suspect.id, lastPlayedAudioUrl, unreadSuspectIds, onClearUnread]);

  // Force Action type if Deceased, reset to Talk otherwise (when switching)
  useEffect(() => {
    if (suspect.isDeceased) {
      setInputType('action');
    } else {
      setInputType('talk');
    }
  }, [suspect.isDeceased, suspect.id]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (evidenceMenuRef.current && !evidenceMenuRef.current.contains(event.target as Node)) {
        setShowEvidencePicker(false);
      }
    }

    if (showEvidencePicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEvidencePicker]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (typeMenuRef.current && !typeMenuRef.current.contains(event.target as Node) &&
        (!mobileTypeMenuRef.current || !mobileTypeMenuRef.current.contains(event.target as Node))) {
        setShowTypePicker(false);
      }
    }

    if (showTypePicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showTypePicker]);

  const handleSend = () => {
    if (inputVal.trim() && !isThinking) {
      const evidenceTitle = selectedEvidence.length > 0
        ? selectedEvidence.map(ev => 'title' in ev ? ev.title : `Timeline: ${ev.time} - ${ev.statement}`).join(' | ')
        : undefined;
      onSendMessage(inputVal, inputType, evidenceTitle);
      setInputVal('');
      setSelectedEvidence([]);
      if (inputType === 'action' && !suspect.isDeceased) setInputType('talk');
    }
  };

  const toggleEvidence = (item: Evidence | TimelineStatement) => {
    setSelectedEvidence(prev => {
      const itemId = 'id' in item ? item.id : `ts-${(item as TimelineStatement).time}`;
      const exists = prev.some(ev => {
        const evId = 'id' in ev ? ev.id : `ts-${(ev as TimelineStatement).time}`;
        return evId === itemId;
      });
      if (exists) {
        return prev.filter(ev => {
          const evId = 'id' in ev ? ev.id : `ts-${(ev as TimelineStatement).time}`;
          return evId !== itemId;
        });
      }
      return [...prev, item];
    });
  };

  const isEvidenceSelected = (item: Evidence | TimelineStatement) => {
    const itemId = 'id' in item ? item.id : `ts-${(item as TimelineStatement).time}`;
    return selectedEvidence.some(ev => {
      const evId = 'id' in ev ? ev.id : `ts-${(ev as TimelineStatement).time}`;
      return evId === itemId;
    });
  };

  // Ref to hold native SpeechRecognition instance for cleanup
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Detect iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const startListening = () => {
    if (listening || transcribing) return;

    // On iOS, native webkitSpeechRecognition is broken (onresult never fires).
    // Use iOS's built-in keyboard dictation instead — it's reliable and free.
    if (isIOS) {
      // Focus the input to bring up the keyboard
      if (inputRef.current) {
        inputRef.current.focus();
      }
      toast('Tap the 🎙 on your keyboard for voice input', {
        duration: 5000,
        icon: '⌨️',
        position: 'bottom-center',
        style: { marginBottom: 'calc(var(--space) * 19)', marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' },
      });
      return;
    }

    if (!hasNativeSpeechRecognition()) {
      if (!window.isSecureContext) {
        toast.error('Microphone requires HTTPS. Access via localhost or enable HTTPS.');
      } else {
        toast.error('Speech recognition is not supported in this browser.');
      }
      return;
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setListening(true);
      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
      };
      recognition.onerror = (e: any) => {
        setListening(false);
        recognitionRef.current = null;
      };
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setInputVal(prev => prev + (prev ? ' ' : '') + finalTranscript);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      toast.error('Speech recognition failed to start.');
    }
  };

  const toggleListening = () => {
    if (listening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) { }
      }
    } else {
      startListening();
    }
  };

  const getShortEvidenceTitle = (ev: string | null | undefined) => {
    if (!ev) return '';
    if (ev.includes(':')) return ev.split(':')[0].trim();
    return ev;
  };

  const findEvidenceImage = (rawName: string) => {
    const cleanName = getShortEvidenceTitle(rawName).toLowerCase();

    // Check current suspect hidden evidence first
    let match = suspect.hiddenEvidence.find(e => e.title.toLowerCase() === cleanName);
    if (match) return match.imageUrl;

    // Check case initial evidence
    match = activeCase.initialEvidence.find(e => e.title.toLowerCase() === cleanName);
    if (match) return match.imageUrl;

    // Fallback: check all suspects
    for (const s of activeCase.suspects) {
      match = s.hiddenEvidence.find(e => e.title.toLowerCase() === cleanName);
      if (match) return match.imageUrl;
    }

    return undefined;
  };

  // Evidence collection sound effect
  const playEvidenceSfx = () => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;

      // Short ascending 3-note "discovery" chime
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square'; // Retro / pixel feel
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.15 * volume, now + i * 0.08 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.25);
      });

      // Clean up context after sounds finish
      setTimeout(() => ctx.close(), 500);
    } catch (e) {
      console.warn('Evidence SFX failed:', e);
    }
  };

  // Detect first uncollected evidence for tooltip
  const firstUncollectedEvidenceIdx = chatHistory.findIndex(msg => msg.evidence && !msg.isEvidenceCollected);
  const shouldShowEvidenceTooltip = !evidenceTooltipSeen && !isOnboarding && firstUncollectedEvidenceIdx !== -1;

  // Auto-scroll to evidence chip and track its position for the fixed tooltip
  useEffect(() => {
    if (shouldShowEvidenceTooltip && !showEvidenceTooltip) {
      setShowEvidenceTooltip(true);
      // Scroll the chip into view after a brief delay for rendering
      setTimeout(() => {
        evidenceChipRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    } else if (!shouldShowEvidenceTooltip) {
      setShowEvidenceTooltip(false);
      setEvidenceChipRect(null);
    }
  }, [shouldShowEvidenceTooltip]);

  // Poll the evidence chip's position so the fixed highlight/tooltip tracks it
  useEffect(() => {
    if (!showEvidenceTooltip) return;
    const update = () => {
      if (evidenceChipRef.current) {
        const r = evidenceChipRef.current.getBoundingClientRect();
        // Account for CRT screen transform offset (same as OnboardingTour)
        const overlayEl = document.getElementById('evidence-tooltip-overlay');
        let offsetTop = 0;
        let offsetLeft = 0;
        if (overlayEl) {
          const overlayRect = overlayEl.getBoundingClientRect();
          offsetTop = overlayRect.top;
          offsetLeft = overlayRect.left;
        }
        setEvidenceChipRect({
          top: r.top - offsetTop,
          left: r.left - offsetLeft,
          width: r.width,
          height: r.height,
          bottom: r.bottom - offsetTop,
          right: r.right - offsetLeft,
        } as DOMRect);
      }
    };
    update();
    const interval = setInterval(update, 200);
    window.addEventListener('resize', update);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', update);
    };
  }, [showEvidenceTooltip]);

  const handleEvidenceClick = (index: number, name: string, suspectId: string) => {
    // Dismiss evidence tooltip on first collection
    if (showEvidenceTooltip) {
      dismissEvidenceTooltip();
      setShowEvidenceTooltip(false);
    }
    // Play evidence collection sound
    playEvidenceSfx();
    // Pass the full name string (including description if present) to celebration
    setCelebratingItem({ index, name, suspectId });
  };

  const handleCelebrationComplete = () => {
    if (celebratingItem) {
      onCollectEvidence(celebratingItem.index, celebratingItem.name, celebratingItem.suspectId);
      setCelebratingItem(null);
    }
  };

  const getSuspectColor = (suspectId: string) => {
    let hash = 0;
    for (let i = 0; i < suspectId.length; i++) {
      hash = suspectId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return `hsl(${h}, 70%, 70%)`;
  };

  // Helper for mobile navigation
  const cycleSuspect = (direction: 'prev' | 'next') => {
    const currentIndex = activeCase.suspects.findIndex(s => s.id === suspect.id);
    let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex >= activeCase.suspects.length) nextIndex = 0;
    if (nextIndex < 0) nextIndex = activeCase.suspects.length - 1;
    onSwitchSuspect(activeCase.suspects[nextIndex].id);
  };

  const isLocked = aggravationLevel >= 100 && !suspect.isDeceased;

  // Disable suggestions for deceased suspects (Forensic mode should be explorative)
  const showSuggestions = !chatHistory.some(m => m.sender === 'player' || m.sender === 'partner') && !suspect.isDeceased;

  const partnerName = activeCase.partner?.name || "Junior Detective Al";
  // We use the generic Suspect type to pass partner data to SuspectPortrait
  // We mock a 'suspect' object from the partner support character data
  const partnerAsSuspect: Suspect = {
    id: 'partner',
    name: activeCase.partner?.name || "Partner",
    role: activeCase.partner?.role || "Junior Detective",
    avatarSeed: activeCase.partner?.avatarSeed || 999,
    portraits: activeCase.partner?.portraits || {},
    // Dummy required fields
    gender: activeCase.partner?.gender || "Unknown",
    age: 25,
    bio: "Your partner.",
    personality: activeCase.partner?.personality || "Helpful",
    baseAggravation: 0,
    isGuilty: false,
    secret: "",
    alibi: { statement: "", isTrue: true, location: "", witnesses: [] },
    motive: "",
    relationships: [],
    timeline: [],
    knownFacts: [],
    professionalBackground: "",
    witnessObservations: "",
    hiddenEvidence: []
  };

  const formattedTime = gameTime
    ? new Date(gameTime).toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    })
    : "10:05 PM September 12, 2030";

  const inputPlaceholder = isLocked
    ? "Suspect has requested a lawyer."
    : suspect.isDeceased
      ? "Perform action..."
      : inputType === 'talk' ? "Ask a question..." : "Slam the table, get a glass of water, etc...";

  return (
    <Container ref={containerRef}>

      {showEvidenceTooltip && evidenceChipRect && (
        <OnboardingOverlay id="evidence-tooltip-overlay">
          <OnboardingHighlight
            initial={false}
            animate={{
              top: evidenceChipRect.top - 5,
              left: evidenceChipRect.left - 5,
              width: evidenceChipRect.width + 10,
              height: evidenceChipRect.height + 10,
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onClick={() => {
              if (firstUncollectedEvidenceIdx !== -1) {
                const msg = chatHistory[firstUncollectedEvidenceIdx];
                if (msg?.evidence && !msg.isEvidenceCollected) {
                  handleEvidenceClick(firstUncollectedEvidenceIdx, msg.evidence, suspect.id);
                }
              }
            }}
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            data-cursor="pointer"
          />
          <OnboardingTooltip
            ref={evidenceTooltipBubbleRef}
            $position="top"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              top: evidenceChipRect.top - (evidenceTooltipBubbleRef.current?.offsetHeight || 120) - 30,
              left: Math.max(10, Math.min(window.innerWidth - 310, evidenceChipRect.left + evidenceChipRect.width / 2 - 150)),
            }}
            transition={{ delay: 0.2 }}
          >
            <h4 style={{ margin: 0, color: '#0f0', textTransform: 'uppercase', fontFamily: "'VT323', monospace", fontSize: 'var(--type-h3)' }}>New Evidence!</h4>
            <p style={{ margin: 0, fontSize: 'var(--type-body)', lineHeight: 1.4, color: '#ccc' }}>Click on evidence to collect it and add it to your evidence board.</p>
          </OnboardingTooltip>
        </OnboardingOverlay>
      )}

      <SuspectCardDock
        suspects={activeCase.suspects}
        activeSuspectId={suspect.id}
        activePosition={{ x: leftPanelCenter, y: leftPanelMiddle }}
        activeCardWidth={`${activeCardWidth}px`}
        activeCardHeight={`${activeCardHeight}px`}
        activeEmotion={emotion}
        activeAggravation={aggravationLevel}
        activeTurnId={suspectTurnIds[suspect.id]}
        onSelectSuspect={onSwitchSuspect}
        inactiveActionLabel="SWITCH"
        unreadSuspectIds={unreadSuspectIds}
        thinkingSuspectIds={thinkingSuspectIds}
        onFlipCard={(flipped) => {
          if (flipped) completeStep(OnboardingStep.FLIP_CARD, false);
        }}
      />

      <MainContent>
        <GhostLeftPanel ref={leftPanelRef} />

        <ChatPanel>
          {/* NEW MOBILE HEADER */}
          <MobileHeader>
            <div onClick={() => setShowMobileProfile(true)} style={{ cursor: 'pointer', flexShrink: 0 }}>
              <SuspectPortrait
                suspect={suspect}
                emotion={emotion}
                aggravation={aggravationLevel}
                size={120}
                style={{ border: '1px solid #333' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0', flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 'var(--type-h2)', fontWeight: 'bold' }}>{suspect.name}</div>
              {!suspect.isDeceased && <div style={{ fontSize: 'var(--type-small)', color: aggravationLevel > 50 ? 'red' : '#aaa' }}>ANGER: {aggravationLevel}%</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space)', alignItems: 'stretch', flexShrink: 0 }}>
              <MobileProfileBtn id="mobile-profile-button" onClick={() => setShowMobileProfile(true)} style={{ width: '100%', textAlign: 'center' }}>PROFILE</MobileProfileBtn>
              <div style={{ display: 'flex' }}>
                <MobileNavBtn onClick={() => cycleSuspect('prev')} style={{ borderRight: 'none', flex: 1 }}>&lt;</MobileNavBtn>
                <MobileNavBtn onClick={() => cycleSuspect('next')} style={{ flex: 1 }}>&gt;</MobileNavBtn>
              </div>
            </div>
          </MobileHeader>

          {celebratingItem && (
            <AsciiCelebration
              evidenceName={getShortEvidenceTitle(celebratingItem.name)}
              evidenceImage={findEvidenceImage(celebratingItem.name)}
              onComplete={handleCelebrationComplete}
            />
          )}

          {canDebug && <DebugToggle onClick={() => setDebugMode(!debugMode)}>[DEBUG]</DebugToggle>}
          {debugMode && (
            <DebugMenu>
              <div style={{ color: '#f00', borderBottom: '1px solid #500', marginBottom: 'var(--space)' }}>FORCE EVIDENCE</div>
              {suspect.hiddenEvidence.map((ev) => (
                <DebugItem key={ev.id} onClick={() => {
                  onForceEvidence(suspect.id, ev.title);
                  setDebugMode(false);
                }}>
                  {ev.title}
                </DebugItem>
              ))}
            </DebugMenu>
          )}

          <div style={{ textAlign: 'center', padding: 'var(--space)', color: '#555', borderBottom: '1px solid #222' }}>
            {formattedTime}
          </div>
          <ChatLog ref={scrollRef}>
            {chatHistory.map((msg, idx) => (
              <MessageBubble
                key={`${msg.sender}-${idx}-${msg.text.substring(0, 10)}`}
                $sender={msg.sender}
                $isAction={msg.type === 'action'}
                $customColor={msg.sender === 'suspect' ? getSuspectColor(suspect.id) : undefined}
              >
                <span className="sender-name">
                  {msg.sender === 'player' ? 'Detective' : msg.sender === 'partner' ? partnerName : msg.sender === 'system' ? 'SYSTEM' : suspect.name}
                </span>
                <span className="text">
                  {msg.type === 'action' && '* '}{msg.text}{msg.type === 'action' && ' *'}
                </span>
                {msg.attachment && (
                  <div className="attachment">📎 Evidence Shown: {msg.attachment.split(' | ').map(a => getShortEvidenceTitle(a)).join(', ')}</div>
                )}
                {msg.evidence && (
                  <EvidenceChip
                    ref={idx === firstUncollectedEvidenceIdx && !msg.isEvidenceCollected ? evidenceChipRef : undefined}
                    $collected={!!msg.isEvidenceCollected}
                    onClick={() => !msg.isEvidenceCollected && handleEvidenceClick(idx, msg.evidence!, suspect.id)}
                    data-cursor={msg.isEvidenceCollected ? undefined : 'pointer'}
                    style={showEvidenceTooltip && idx === firstUncollectedEvidenceIdx && !msg.isEvidenceCollected ? { position: 'relative', zIndex: 10001 } : undefined}
                  >
                    {getShortEvidenceTitle(msg.evidence)}
                  </EvidenceChip>
                )}
              </MessageBubble>
            ))}
            {isThinking && (
              <div style={{ color: '#555', fontStyle: 'italic' }}>
                Thinking
                <span className="animate-typewriter-dots"></span>
              </div>
            )}
          </ChatLog>

          <InputContainer>
            {!isLocked && showSuggestions && suggestions.length > 0 && (
              <SuggestionChips>
                {suggestions.map((s, i) => {
                  const label = typeof s === 'string' ? s : s.label;
                  const text = typeof s === 'string' ? s : s.text;
                  return (
                    <Chip key={`${label}-${i}`} onClick={() => setInputVal(text)}>{label}</Chip>
                  );
                })}
              </SuggestionChips>
            )}

            {selectedEvidence.length > 0 && (
              <AttachmentChipsRow>
                {selectedEvidence.map((ev, i) => {
                  const label = 'title' in ev ? ev.title : `Timeline: ${(ev as TimelineStatement).day && (ev as TimelineStatement).day !== 'Today' ? (ev as TimelineStatement).day + ' — ' : ''}${(ev as TimelineStatement).time}`;
                  return (
                    <AttachmentChip key={i}>
                      <span>📎 {label}</span>
                      <button onClick={() => toggleEvidence(ev)}>[x]</button>
                    </AttachmentChip>
                  );
                })}
              </AttachmentChipsRow>
            )}

            <UnifiedInputBar $disabled={isLocked || isThinking} id="unified-input-bar">
              <TypeButtonWrapper ref={typeMenuRef}>
                <TypeButton
                  onClick={() => !isLocked && !suspect.isDeceased && setShowTypePicker(!showTypePicker)}
                  $disabled={isLocked || suspect.isDeceased}
                >
                  {inputType === 'talk' ? '💬 Talk' : '🫴 Action'}
                </TypeButton>
                {showTypePicker && (
                  <TypeMenu>
                    <TypeMenuItem
                      $active={inputType === 'talk'}
                      onClick={() => { setInputType('talk'); setShowTypePicker(false); }}
                    >
                      {inputType === 'talk' && <span>✓</span>}💬 Talk
                    </TypeMenuItem>
                    <TypeMenuItem
                      $active={inputType === 'action'}
                      onClick={() => { setInputType('action'); setShowTypePicker(false); }}
                    >
                      {inputType === 'action' && <span>✓</span>}🫴 Action
                    </TypeMenuItem>
                  </TypeMenu>
                )}
              </TypeButtonWrapper>

              <PlusButtonWrapper ref={evidenceMenuRef}>
                <PlusButton
                  onClick={() => setShowEvidencePicker(!showEvidencePicker)}
                  $active={selectedEvidence.length > 0}
                  disabled={isLocked}
                  title="Present Evidence"
                >
                  +
                </PlusButton>
                {showEvidencePicker && (
                  <EvidenceMenu>
                    {evidenceDiscovered.length === 0 && timelineStatementsDiscovered.length === 0 && (
                      <div style={{ padding: 'var(--space)', color: '#555' }}>No evidence found yet.</div>
                    )}

                    {evidenceDiscovered.length > 0 && (
                      <>
                        <div style={{ padding: '5px 10px', fontSize: 'var(--type-xs)', color: '#555', borderBottom: '1px solid #222', textTransform: 'uppercase' }}>Physical Evidence</div>
                        {[...evidenceDiscovered].reverse().map((ev) => {
                          const selected = isEvidenceSelected(ev);
                          return (
                            <EvidenceOption
                              key={ev.id}
                              onClick={() => toggleEvidence(ev)}
                              style={selected ? { background: '#1a2a1a', borderColor: '#0f0' } : undefined}
                            >
                              <div style={{ fontWeight: 'bold', color: selected ? '#0f0' : '#fff', display: 'flex', alignItems: 'center', gap: 'var(--space)' }}>
                                {selected && <span>✓</span>}{ev.title}
                              </div>
                              <div style={{ fontSize: 'var(--type-small)', color: '#888', lineHeight: '1.2' }}>{ev.description}</div>
                            </EvidenceOption>
                          );
                        })}
                      </>
                    )}

                    {timelineStatementsDiscovered.length > 0 && (
                      <>
                        <div style={{ padding: '8px 12px', fontSize: 'var(--type-xs)', color: '#555', borderBottom: '1px solid #222', textTransform: 'uppercase', marginTop: 'var(--space)', letterSpacing: '1px' }}>Timeline Statements</div>
                        {(() => {
                          // Group timeline statements by day, sorted by dayOffset then time
                          const sorted = [...timelineStatementsDiscovered].sort((a, b) => {
                            if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset;
                            const parseT = (t: string) => {
                              const m12 = t.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)/i);
                              if (m12) { let h = parseInt(m12[1]); const m = parseInt(m12[2]); const pm = m12[3].toLowerCase() === 'pm'; if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; return h * 60 + m; }
                              const m24 = t.trim().match(/^(\d{1,2}):(\d{2})/);
                              if (m24) return parseInt(m24[1]) * 60 + parseInt(m24[2]);
                              return -1;
                            };
                            return parseT(a.time) - parseT(b.time);
                          });
                          const dayGroups: { day: string; dayOffset: number; items: typeof sorted }[] = [];
                          sorted.forEach(ts => {
                            const last = dayGroups[dayGroups.length - 1];
                            if (last && last.dayOffset === ts.dayOffset) { last.items.push(ts); }
                            else { dayGroups.push({ day: ts.day || 'Today', dayOffset: ts.dayOffset, items: [ts] }); }
                          });
                          const showDayHeaders = dayGroups.length > 1 || (dayGroups.length === 1 && dayGroups[0].day !== 'Today');
                          return dayGroups.map(group => (
                            <React.Fragment key={`day-${group.dayOffset}`}>
                              {showDayHeaders && (
                                <TimelineDayHeader>
                                  <span>{group.day}</span>
                                </TimelineDayHeader>
                              )}
                              {group.items.map(ts => {
                                const selected = isEvidenceSelected(ts);
                                return (
                                  <TimelineEvidenceOption
                                    key={ts.id}
                                    onClick={() => toggleEvidence(ts)}
                                    style={selected ? { background: '#1a2e3e', borderColor: '#0ff' } : undefined}
                                  >
                                    <div className="header">
                                      {selected && <span style={{ color: '#0ff', fontWeight: 'bold' }}>✓</span>}
                                      <span className="time">{ts.time}</span>
                                      <span className="suspect">BY {ts.suspectName}</span>
                                    </div>
                                    <div className="statement">"{ts.statement}"</div>
                                  </TimelineEvidenceOption>
                                );
                              })}
                            </React.Fragment>
                          ));
                        })()}
                      </>
                    )}
                  </EvidenceMenu>
                )}
              </PlusButtonWrapper>

              <GhostInput
                ref={inputRef}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={inputPlaceholder}
                disabled={isLocked || isThinking}
              />

              <SendActionBtn
                onClick={handleSend}
                disabled={isLocked || isThinking}
              >
                SEND
              </SendActionBtn>

              <MicButton $listening={listening} $transcribing={transcribing} onClick={toggleListening} title={transcribing ? 'Transcribing...' : listening ? 'Tap to stop' : 'Voice Input'}>
                {transcribing ? (
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="3" />
                    <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                )}
              </MicButton>
            </UnifiedInputBar>

            {/* MOBILE-ONLY: Input on top, buttons below */}
            <div id="unified-input-bar-mobile">
              <MobileInputRow>
                <PlusButtonWrapper ref={evidenceMenuRef}>
                  <PlusButton
                    onClick={() => setShowEvidencePicker(!showEvidencePicker)}
                    $active={selectedEvidence.length > 0}
                    disabled={isLocked}
                    title="Present Evidence"
                  >
                    +
                  </PlusButton>
                  {showEvidencePicker && (
                    <EvidenceMenu>
                      {evidenceDiscovered.length === 0 && timelineStatementsDiscovered.length === 0 && (
                        <div style={{ padding: 'var(--space)', color: '#555' }}>No evidence found yet.</div>
                      )}
                      {evidenceDiscovered.length > 0 && (
                        <>
                          <div style={{ padding: '5px 10px', fontSize: 'var(--type-xs)', color: '#555', borderBottom: '1px solid #222', textTransform: 'uppercase' }}>Physical Evidence</div>
                          {[...evidenceDiscovered].reverse().map((ev) => {
                            const selected = isEvidenceSelected(ev);
                            return (
                              <EvidenceOption
                                key={ev.id}
                                onClick={() => toggleEvidence(ev)}
                                style={selected ? { background: '#1a2a1a', borderColor: '#0f0' } : undefined}
                              >
                                <div style={{ fontWeight: 'bold', color: selected ? '#0f0' : '#fff', display: 'flex', alignItems: 'center', gap: 'var(--space)' }}>
                                  {selected && <span>✓</span>}{ev.title}
                                </div>
                                <div style={{ fontSize: 'var(--type-small)', color: '#888', lineHeight: '1.2' }}>{ev.description}</div>
                              </EvidenceOption>
                            );
                          })}
                        </>
                      )}
                      {timelineStatementsDiscovered.length > 0 && (
                        <>
                          <div style={{ padding: '8px 12px', fontSize: 'var(--type-xs)', color: '#555', borderBottom: '1px solid #222', textTransform: 'uppercase', marginTop: 'var(--space)', letterSpacing: '1px' }}>Timeline Statements</div>
                          {(() => {
                            const sorted = [...timelineStatementsDiscovered].sort((a, b) => {
                              if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset;
                              const parseT = (t: string) => {
                                const m12 = t.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)/i);
                                if (m12) { let h = parseInt(m12[1]); const m = parseInt(m12[2]); const pm = m12[3].toLowerCase() === 'pm'; if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; return h * 60 + m; }
                                const m24 = t.trim().match(/^(\d{1,2}):(\d{2})/);
                                if (m24) return parseInt(m24[1]) * 60 + parseInt(m24[2]);
                                return -1;
                              };
                              return parseT(a.time) - parseT(b.time);
                            });
                            const dayGroups: { day: string; dayOffset: number; items: typeof sorted }[] = [];
                            sorted.forEach(ts => {
                              const last = dayGroups[dayGroups.length - 1];
                              if (last && last.dayOffset === ts.dayOffset) { last.items.push(ts); }
                              else { dayGroups.push({ day: ts.day || 'Today', dayOffset: ts.dayOffset, items: [ts] }); }
                            });
                            const showDayHeaders = dayGroups.length > 1 || (dayGroups.length === 1 && dayGroups[0].day !== 'Today');
                            return dayGroups.map(group => (
                              <React.Fragment key={`day-${group.dayOffset}`}>
                                {showDayHeaders && (
                                  <TimelineDayHeader>
                                    <span>{group.day}</span>
                                  </TimelineDayHeader>
                                )}
                                {group.items.map(ts => {
                                  const selected = isEvidenceSelected(ts);
                                  return (
                                    <TimelineEvidenceOption
                                      key={ts.id}
                                      onClick={() => toggleEvidence(ts)}
                                      style={selected ? { background: '#1a2e3e', borderColor: '#0ff' } : undefined}
                                    >
                                      <div className="header">
                                        {selected && <span style={{ color: '#0ff', fontWeight: 'bold' }}>✓</span>}
                                        <span className="time">{ts.time}</span>
                                        <span className="suspect">BY {ts.suspectName}</span>
                                      </div>
                                      <div className="statement">"{ts.statement}"</div>
                                    </TimelineEvidenceOption>
                                  );
                                })}
                              </React.Fragment>
                            ));
                          })()}
                        </>
                      )}
                    </EvidenceMenu>
                  )}
                </PlusButtonWrapper>
                <GhostInput
                  ref={inputRef}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={inputPlaceholder}
                  disabled={isLocked || isThinking}
                />
              </MobileInputRow>
              <MobileButtonRow>
                <TypeButtonWrapper ref={mobileTypeMenuRef}>
                  <TypeButton
                    onClick={() => !isLocked && !suspect.isDeceased && setShowTypePicker(!showTypePicker)}
                    $disabled={isLocked || suspect.isDeceased}
                  >
                    {inputType === 'talk' ? '💬 Talk' : '🫴 Action'}
                  </TypeButton>
                  {showTypePicker && (
                    <TypeMenu>
                      <TypeMenuItem
                        $active={inputType === 'talk'}
                        onClick={() => { setInputType('talk'); setShowTypePicker(false); }}
                      >
                        {inputType === 'talk' && <span>✓</span>}💬 Talk
                      </TypeMenuItem>
                      <TypeMenuItem
                        $active={inputType === 'action'}
                        onClick={() => { setInputType('action'); setShowTypePicker(false); }}
                      >
                        {inputType === 'action' && <span>✓</span>}🫴 Action
                      </TypeMenuItem>
                    </TypeMenu>
                  )}
                </TypeButtonWrapper>
                <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                  <SendActionBtn
                    onClick={handleSend}
                    disabled={isLocked || isThinking}
                  >
                    SEND
                  </SendActionBtn>
                  <MicButton $listening={listening} $transcribing={transcribing} onClick={toggleListening} title={transcribing ? 'Transcribing...' : listening ? 'Tap to stop' : 'Voice Input'}>
                    {transcribing ? (
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="3" />
                        <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                      </svg>
                    )}
                  </MicButton>
                </div>
              </MobileButtonRow>
            </div>
          </InputContainer>
        </ChatPanel>

        <IntelOverlay $visible={mobileIntelOpen} onClick={() => onCloseMobileIntel?.()} />
        <RightPanel id="right-panel" $mobileOpen={mobileIntelOpen}>
          <AggravationMeter id="aggravation-meter">
            <h3>{suspect.isDeceased ? "Status" : "Aggravation"}</h3>
            {!suspect.isDeceased && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space)' }}>
                <span>{`${aggravationLevel}%`}</span>
              </div>
            )}
            {!suspect.isDeceased && <ProgressBar $level={aggravationLevel} />}
            {isLocked && <div style={{ color: 'red', marginTop: 'var(--space)', fontSize: 'var(--type-small)' }}>LAWYER REQUESTED</div>}
            {suspect.isDeceased && <DeceasedBadge>DECEASED</DeceasedBadge>}
          </AggravationMeter>

          <SidekickContainer id="partner-support">
            <h3>Partner Support</h3>
            <SidekickHeader>
              <div style={{ width: '60px', height: '60px', border: '2px solid #555', background: '#222' }}>
                <SuspectPortrait
                  suspect={partnerAsSuspect}
                  size={60}
                  emotion={partnerEmotion}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div className="info">
                <h3>{partnerName}</h3>
                <span>CHARGES: {partnerCharges}/3</span>
              </div>
            </SidekickHeader>

            <BubbleScrollArea>
              <WhisperBubble>
                <p key={sidekickComment}>
                  {sidekickComment ? `(Whispering) "${sidekickComment}"` : `(${partnerName} is watching carefully...)`}
                </p>
              </WhisperBubble>
            </BubbleScrollArea>

            <SidekickActions>
              {suspect.isDeceased ? (
                <>
                  <ActionButton
                    $type="neutral"
                    onClick={() => { onPartnerAction('examine'); onCloseMobileIntel?.(); }}
                    disabled={partnerCharges <= 0 || initialExamDone}
                    title="Perform Initial Examination (Once)"
                  >
                    {initialExamDone ? "Exam Done" : "Initial Exam"}
                  </ActionButton>
                </>
              ) : (
                <>
                  <ActionButton
                    $type="good"
                    onClick={() => { onPartnerAction('goodCop'); onCloseMobileIntel?.(); }}
                    disabled={partnerCharges <= 0 || isLocked}
                    title="Calm Suspect (-50% Aggravation)"
                  >
                    Good Cop
                  </ActionButton>
                  <ActionButton
                    $type="bad"
                    onClick={() => { onPartnerAction('badCop'); onCloseMobileIntel?.(); }}
                    disabled={partnerCharges <= 0 || isLocked}
                    title="Force Evidence (+Aggravation)"
                  >
                    Bad Cop
                  </ActionButton>
                </>
              )}
            </SidekickActions>
          </SidekickContainer>

        </RightPanel>
      </MainContent>

      {/* MOBILE PROFILE MODAL */}
      {showMobileProfile && (
        <ModalOverlay id="mobile-profile-modal" onClick={() => setShowMobileProfile(false)}>
          <div onClick={e => e.stopPropagation()}>
            <SuspectCard
              key={`mobile-profile-${suspect.id}-${isOnboarding}-${onboardingStep}`}
              id="active-suspect-card"
              suspect={suspect}
              emotion={emotion}
              aggravation={aggravationLevel}
              width="300px"
              height="450px"
              variant="default"
              initialFlipped={!(isOnboarding && onboardingStep === OnboardingStep.FLIP_CARD)}
              onFlip={(flipped) => {
                if (flipped) {
                  completeStep(OnboardingStep.FLIP_CARD, false);
                }
              }}
            />
          </div>
        </ModalOverlay>
      )}
    </Container>
  );
};

export default Interrogation;
