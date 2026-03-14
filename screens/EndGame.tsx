
import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { CaseData, Evidence } from '../types';
import { generateCaseSummary } from '../services/geminiService';
import SuspectPortrait from '../components/SuspectPortrait';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
  display: flex;
  height: 100%;
  padding: 40px;
  gap: 40px;
  background: #050505;
  
  @media (max-width: 768px) {
    display: block; /* Use block layout for vertical scrolling flow */
    height: 100%;
    overflow-y: auto; /* Enable scrolling for the whole screen */
    padding: 15px;
    gap: 0; /* Gap handled by margins in block layout */
  }
`;

const LeftPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  animation: ${fadeIn} 0.5s ease-out;
  height: 100%;
  min-height: 0;
  
  @media (max-width: 768px) {
    height: auto;
    display: block;
    margin-bottom: 30px;
  }
`;

const RightPanel = styled.div`
  flex: 0 0 350px;
  border: 1px solid #333;
  padding: 20px;
  background: #111;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  animation: ${fadeIn} 0.8s ease-out;
  
  @media (max-width: 768px) {
    width: 100%;
    height: auto;
    overflow-y: visible; /* Let it expand */
    padding: 15px;
  }
`;

// --- NEW TOP LAYOUT ---

const TopRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center; /* Center align items vertically */
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 2px solid #333;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch; /* Stretch to fill width */
    gap: 15px;
    text-align: center; /* Center text on mobile */
  }
`;

const Header = styled.h1<{ $gameResult: 'SUCCESS' | 'PARTIAL' | 'FAILURE' | null }>`
  font-size: var(--type-h1);
  color: ${props => props.$gameResult === 'SUCCESS' ? '#0f0' : props.$gameResult === 'PARTIAL' ? '#fa0' : '#f00'};
  margin: 0;
  text-transform: uppercase;
  text-shadow: 0 0 10px ${props => props.$gameResult === 'SUCCESS' ? '#0f0' : props.$gameResult === 'PARTIAL' ? '#fa0' : '#f00'};
  line-height: 1;
  
  @media (max-width: 768px) {
    font-size: 2.5rem;
  }
`;

const CompactStats = styled.div`
  display: flex;
  gap: 30px;
  
  @media (max-width: 768px) {
    width: 100%;
    justify-content: center; /* Center stats on mobile */
    gap: 20px;
  }
`;

const CompactStatItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  
  @media (max-width: 768px) {
    align-items: center; /* Center align items on mobile */
  }
  
  label { 
    font-size: var(--type-small); 
    color: #777; 
    text-transform: uppercase; 
    margin-bottom: 4px;
  }
  
  span { 
    font-size: var(--type-h3); 
    color: #fff; 
    font-weight: bold; 
    text-shadow: 0 0 5px rgba(255,255,255,0.2);
  }
`;

// --- REPORT CONTAINER & OVERLAY STAMP ---

const ReportWrapper = styled.div`
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  
  @media (max-width: 768px) {
    display: block;
    height: auto;
    min-height: 0;
  }
`;

const Stamp = styled.div<{ $gameResult: 'SUCCESS' | 'PARTIAL' | 'FAILURE' | null }>`
  position: absolute;
  top: 20px;
  right: 20px;
  font-size: var(--type-h1);
  border: 5px solid ${props => props.$gameResult === 'SUCCESS' ? '#0f0' : props.$gameResult === 'PARTIAL' ? '#fa0' : '#f00'};
  color: ${props => props.$gameResult === 'SUCCESS' ? '#0f0' : props.$gameResult === 'PARTIAL' ? '#fa0' : '#f00'};
  padding: 5px 20px;
  transform: rotate(12deg);
  font-weight: bold;
  text-align: center;
  z-index: 10;
  pointer-events: none;
  opacity: 0.8;
  text-transform: uppercase;
  mix-blend-mode: hard-light;
  background: rgba(0, 0, 0, 0.3);
  box-shadow: 0 0 15px rgba(0,0,0,0.5);
  backdrop-filter: blur(2px);
  
  @media (max-width: 768px) {
    top: 10px;
    right: 10px;
    font-size: 2rem;
    padding: 2px 10px;
  }
`;

const SummaryBox = styled.div`
  background: #1a1a1a;
  padding: 30px;
  border-left: 4px solid #555;
  color: #ddd;
  font-size: var(--type-body-lg);
  line-height: 1.6;
  white-space: pre-wrap;
  font-family: 'VT323', monospace;
  overflow-y: auto;
  flex: 1;
  
  @media (max-width: 768px) {
    padding: 15px;
    font-size: var(--type-body);
    height: auto;
    overflow-y: visible; /* Let it grow on mobile */
    border-left: 2px solid #555;
  }
`;

// --- RIGHT PANEL ITEMS ---

const StatItem = styled.div`
  background: #222;
  padding: 15px;
  h3 { margin: 0 0 5px 0; color: #888; font-size: var(--type-small); text-transform: uppercase; }
  span { font-size: var(--type-h3); color: #fff; }
`;

const EvidenceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const EvidenceRow = styled.div<{ $found: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  color: ${props => props.$found ? '#0f0' : '#555'};
  font-size: var(--type-body);
  padding: 5px;
  border-bottom: 1px solid #222;

  span.icon {
    width: 20px;
    text-align: center;
    font-weight: bold;
  }
`;

const ResetButton = styled.button`
  background: #fff;
  color: #000;
  border: none;
  padding: 15px 30px;
  font-size: var(--type-h3);
  font-family: inherit;
  font-weight: bold;
  cursor: pointer;
  text-transform: uppercase;
  margin-top: 20px;
  
  &:hover { background: #ccc; }
  
  @media (max-width: 768px) {
    width: 100%;
    padding: 20px;
    margin-bottom: 20px;
  }
`;

interface EndGameProps {
  gameResult: 'SUCCESS' | 'PARTIAL' | 'FAILURE' | null;
  caseData: CaseData;
  accusedIds: string[];
  evidenceDiscovered: Evidence[];
  onReset: () => void;
}

const EndGame: React.FC<EndGameProps> = ({ gameResult, caseData, accusedIds, evidenceDiscovered, onReset }) => {
  const [summary, setSummary] = useState("Generating case report...");
  
  useEffect(() => {
    // For summary, we can just pass the first accused suspect or join names
    const accusedNames = caseData.suspects.filter(s => accusedIds.includes(s.id)).map(s => s.name).join(', ');
    generateCaseSummary(caseData, accusedIds[0], gameResult || 'FAILURE', evidenceDiscovered)
        .then(setSummary);
  }, [caseData, accusedIds, gameResult, evidenceDiscovered]);

  const accusedSuspects = caseData.suspects.filter(s => accusedIds.includes(s.id));
  const guiltySuspects = caseData.suspects.filter(s => s.isGuilty);
  const guiltyNames = guiltySuspects.map(s => s.name).join(', ');

  // Calculate stats - Safeguard against undefined hiddenEvidence
  const totalHiddenEvidence = caseData.suspects.reduce((acc, s) => acc + (s.hiddenEvidence?.length || 0), 0);
  const allHiddenTitles = new Set(caseData.suspects.flatMap(s => (s.hiddenEvidence || []).map(e => e.title)));
  const foundHiddenCount = evidenceDiscovered.filter(e => allHiddenTitles.has(e.title)).length;
  
  const getResultColor = () => {
      if (gameResult === 'SUCCESS') return '#0f0';
      if (gameResult === 'PARTIAL') return '#fa0';
      return '#f00';
  };

  const resultColor = getResultColor();
  
  const formatReport = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
        // Regex captures {{FOUND:Content}}, {{MISSED:Content}}, or **Bold**
        const parts = line.split(/(\{\{FOUND:.*?\}\}|\{\{MISSED:.*?\}\}|\*\*.*?\*\*)/g);
        return (
            <div key={i} style={{ minHeight: '1.2em', marginBottom: '4px' }}>
                {parts.map((part, j) => {
                    if (part.startsWith('{{FOUND:')) {
                        const content = part.slice(8, -2); // Remove {{FOUND: and }}
                        return <span key={j} style={{ color: '#0f0', fontWeight: 'bold' }}>{content}</span>;
                    }
                    if (part.startsWith('{{MISSED:')) {
                        const content = part.slice(9, -2); // Remove {{MISSED: and }}
                        return <span key={j} style={{ color: '#f55', fontWeight: 'bold' }}>{content}</span>;
                    }
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <span key={j} style={{ color: '#fff', fontWeight: 'bold' }}>{part.slice(2, -2)}</span>;
                    }
                    return <span key={j}>{part}</span>;
                })}
            </div>
        );
    });
  };

  return (
    <Container>
      <LeftPanel>
        <TopRow>
            <Header $gameResult={gameResult}>
                {gameResult === 'SUCCESS' ? "CASE CLOSED" : gameResult === 'PARTIAL' ? "PARTIAL SUCCESS" : "CASE FAILED"}
            </Header>
            <CompactStats>
                <CompactStatItem>
                    <label>Accused Suspect(s)</label>
                    <span style={{ color: resultColor }}>{accusedSuspects.map(s => s.name).join(', ') || "None"}</span>
                </CompactStatItem>
                <CompactStatItem>
                    <label>True Perpetrator(s)</label>
                    <span>{guiltyNames}</span>
                </CompactStatItem>
            </CompactStats>
        </TopRow>

        <ReportWrapper>
            <SummaryBox>
                {formatReport(summary)}
            </SummaryBox>
        </ReportWrapper>

        {/* Hide reset button on left panel on mobile, move to bottom of right panel for natural flow */}
        <div className="desktop-only" style={{ display: window.innerWidth > 768 ? 'block' : 'none' }}>
            <ResetButton onClick={onReset}>RETURN TO HQ</ResetButton>
        </div>
      </LeftPanel>

      <RightPanel>
        <Stamp $gameResult={gameResult}>
            {gameResult === 'SUCCESS' ? "SUCCESS" : gameResult === 'PARTIAL' ? "PARTIAL" : "FAILURE"}
        </Stamp>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            {accusedSuspects.length > 0 ? (
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {accusedSuspects.map(s => (
                        <SuspectPortrait 
                            key={s.id}
                            suspect={s} 
                            size={120} 
                            style={{ 
                                border: `4px solid ${resultColor}`, 
                                filter: gameResult === 'SUCCESS' ? 'none' : 'grayscale(100%) contrast(1.2)'
                            }} 
                        />
                    ))}
                </div>
            ) : (
                <SuspectPortrait 
                    suspect={caseData.suspects[0]} 
                    size={200} 
                    style={{ 
                        border: `4px solid ${resultColor}`, 
                        margin: '0 auto',
                        filter: gameResult === 'SUCCESS' ? 'none' : 'grayscale(100%) contrast(1.2)'
                    }} 
                />
            )}
            <h2 style={{ marginTop: '10px', fontSize: 'var(--type-h2)' }}>
                {accusedSuspects.length > 0 ? `SUBJECTS: ${accusedSuspects.map(s => s.name).join(', ')}` : "SUBJECT: None"}
            </h2>
        </div>

        <StatItem>
            <h3>Evidence Recovery Rate</h3>
            <span>{foundHiddenCount} / {totalHiddenEvidence} SECRETS FOUND</span>
        </StatItem>

        <h3 style={{ borderBottom: '1px solid #444', paddingBottom: '5px', marginTop: '10px', fontSize: 'var(--type-small)' }}>EVIDENCE LOG</h3>
        <EvidenceList>
            {caseData.suspects.flatMap(s => s.hiddenEvidence || []).map((ev, i) => {
                const isFound = evidenceDiscovered.some(e => e.title === ev.title);
                return (
                    <EvidenceRow key={i} $found={isFound}>
                        <span className="icon">{isFound ? '✓' : '✗'}</span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 'bold' }}>{ev.title}</span>
                            {!isFound && <span style={{ fontSize: 'var(--type-small)', fontStyle: 'italic' }}>Held by: {caseData.suspects.find(s => (s.hiddenEvidence || []).includes(ev))?.name}</span>}
                        </div>
                    </EvidenceRow>
                );
            })}
        </EvidenceList>

        <div className="mobile-only" style={{ display: window.innerWidth <= 768 ? 'block' : 'none' }}>
            <ResetButton onClick={onReset}>RETURN TO HQ</ResetButton>
        </div>
      </RightPanel>
    </Container>
  );
};

export default EndGame;
