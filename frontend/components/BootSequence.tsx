
import React, { useState, useEffect, useRef } from 'react';
import { type } from '../theme';
import styled, { keyframes } from 'styled-components';

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
`;

// --- STYLED COMPONENTS ---

const Container = styled.div`
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #000;
  color: #33ff33;
  font-family: 'VT323', monospace;
  ${type.h3}
  padding: calc(var(--screen-edge-top, 50px) + 20px) calc(var(--screen-edge-horizontal, 80px) + 20px) calc(var(--screen-edge-bottom, 30px) + 20px) calc(var(--screen-edge-horizontal, 80px) + 20px);
  z-index: 100;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;

  @media (max-width: 768px) {
    ${type.small}
  }
`;

const Line = styled.div`
  margin-bottom: var(--space);
  white-space: pre-wrap;
  text-shadow: 0 0 5px #33ff33;
`;

const Cursor = styled.span`
  display: inline-block;
  width: 10px;
  height: 1.2em;
  background: #33ff33;
  animation: ${blink} 0.5s step-end infinite;
  vertical-align: text-bottom;
  margin-left: var(--space);
`;

const PressKeyPrompt = styled.div`
  margin-top: calc(var(--space) * 3);
  color: #33ff33;
  text-shadow: 0 0 5px #33ff33;
  animation: ${blink} 1s step-end infinite;
`;

interface BootSequenceProps {
  onComplete: () => void;
}

const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
  const [lines, setLines] = useState<string[]>([]);
  const [phase, setPhase] = useState<'init' | 'booting' | 'waiting'>('init');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Wait for Layout's "Turn On" animation (1.2s) to finish before showing text
    const initTimer = setTimeout(() => {
      setPhase('booting');
    }, 1300);

    return () => clearTimeout(initTimer);
  }, []);

  useEffect(() => {
    if (phase !== 'booting') return;

    const sequence = [
      { text: "BIOS DATE 01/15/95 09:22:56 VER 1.0.2", delay: 50 },
      { text: "CPU: INTEL 486DX2 @ 66MHz", delay: 100 },
      { text: "Memory Test: 32768KB OK", delay: 150 },
      { text: " ", delay: 50 },
      { text: "Detecting Primary Drive 0 ... HDD 540MB", delay: 200 },
      { text: "Detecting Primary Drive 1 ... CD-ROM DRIVE", delay: 100 },
      { text: " ", delay: 50 },
      { text: "Loading SYSTEM.SYS ...", delay: 300 },
      { text: "Initializing DETECTIVE_OS kernel...", delay: 200 },
      { text: "Mounting volumes...", delay: 300 },
      { text: "Checking peripheral devices...", delay: 100 },
      { text: "Loading Case Database...", delay: 200 },
      { text: "Decrypting Files...", delay: 150 },
      { text: "SYSTEM READY.", delay: 200 },
      { text: " ", delay: 100 },
    ];

    let mounted = true;

    const runSequence = async () => {
      for (const step of sequence) {
        if (!mounted) break;
        await new Promise(r => setTimeout(r, step.delay));
        setLines(prev => [...prev, step.text]);
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }
      if (mounted) {
        setPhase('waiting');
      }
    };

    runSequence();

    return () => { mounted = false; };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'waiting') return;

    const handleInteract = () => {
      // Notify parent immediately; parent handles the visual exit animation
      onComplete();
    };

    window.addEventListener('keydown', handleInteract);
    window.addEventListener('click', handleInteract);
    window.addEventListener('touchstart', handleInteract);

    return () => {
      window.removeEventListener('keydown', handleInteract);
      window.removeEventListener('click', handleInteract);
      window.removeEventListener('touchstart', handleInteract);
    };
  }, [phase, onComplete]);

  // If in init phase (waiting for screen to open), show nothing in the container
  if (phase === 'init') return <Container />;

  return (
    <Container ref={scrollRef}>
      {lines.map((line, i) => (
        <Line key={i}>{line}</Line>
      ))}
      {phase === 'waiting' && (
        <PressKeyPrompt>PRESS ANY KEY TO START_</PressKeyPrompt>
      )}
      {phase !== 'waiting' && <Line>_ <Cursor /></Line>}
    </Container>
  );
};

export default BootSequence;
