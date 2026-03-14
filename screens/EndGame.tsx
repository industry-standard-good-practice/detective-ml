
import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { CaseData, CaseStats, Evidence } from '../types';
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
    display: block;
    height: 100%;
    overflow-y: auto;
    padding: 15px;
    gap: 0;
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
  flex: 0 0 380px;
  border: 1px solid #333;
  padding: 20px;
  background: #111;
  display: flex;
  flex-direction: column;
  gap: 15px;
  overflow-y: auto;
  animation: ${fadeIn} 0.8s ease-out;
  
  @media (max-width: 768px) {
    width: 100%;
    height: auto;
    overflow-y: visible;
    padding: 15px;
  }
`;

const TopRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 2px solid #333;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
    gap: 15px;
    text-align: center;
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
    justify-content: center;
    gap: 20px;
  }
`;

const CompactStatItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  
  @media (max-width: 768px) {
    align-items: center;
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
    overflow-y: visible;
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

// --- VOTING ---

const VoteRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 15px;
  background: #1a1a1a;
  border: 1px solid #333;
`;

const VoteButton = styled.button<{ $active: boolean; $type: 'up' | 'down' }>`
  background: ${props => props.$active 
    ? (props.$type === 'up' ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)') 
    : 'transparent'};
  border: 2px solid ${props => props.$active 
    ? (props.$type === 'up' ? '#0f0' : '#f00') 
    : '#444'};
  color: ${props => props.$active 
    ? (props.$type === 'up' ? '#0f0' : '#f00') 
    : '#888'};
  padding: 8px 20px;
  font-family: inherit;
  font-size: var(--type-h3);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    border-color: ${props => props.$type === 'up' ? '#0f0' : '#f00'};
    color: ${props => props.$type === 'up' ? '#0f0' : '#f00'};
    background: ${props => props.$type === 'up' ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)'};
  }
`;

const VoteCount = styled.span`
  font-size: var(--type-body);
  color: #888;
`;

// --- GLOBAL INTEL / LEADERBOARD ---

const IntelSection = styled.div`
  background: #0a0a0a;
  border: 1px solid #222;
  padding: 15px;
`;

const IntelTitle = styled.h3`
  color: #0ff;
  font-size: var(--type-small);
  text-transform: uppercase;
  margin: 0 0 12px 0;
  letter-spacing: 1px;
  border-bottom: 1px solid #222;
  padding-bottom: 8px;
`;

const IntelRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: var(--type-body);
  
  label { color: #777; font-size: var(--type-small); text-transform: uppercase; }
`;

const CompareBar = styled.div`
  position: relative;
  height: 6px;
  background: #222;
  margin-top: 4px;
  border-radius: 3px;
  overflow: hidden;
`;

const CompareBarFill = styled.div<{ $width: number; $color: string }>`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: ${props => props.$width}%;
  background: ${props => props.$color};
  border-radius: 3px;
  transition: width 0.8s ease-out;
`;

const CompareRow = styled.div`
  margin-bottom: 12px;
`;

const CompareValues = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: var(--type-small);
  margin-bottom: 4px;
  
  .you { color: #0ff; }
  .avg { color: #666; }
`;

interface EndGameProps {
  gameResult: 'SUCCESS' | 'PARTIAL' | 'FAILURE' | null;
  caseData: CaseData;
  accusedIds: string[];
  evidenceDiscovered: Evidence[];
  onReset: () => void;
  caseStats: CaseStats | null;
  userVote: 'up' | 'down' | null;
  onVote: (vote: 'up' | 'down') => void;
  suspectsSpoken: number;
  timelineFound: number;
}

const EndGame: React.FC<EndGameProps> = ({ 
  gameResult, caseData, accusedIds, evidenceDiscovered, onReset,
  caseStats, userVote, onVote, suspectsSpoken, timelineFound
}) => {
  const [summary, setSummary] = useState("Generating case report...");
  
  useEffect(() => {
    const accusedNames = caseData.suspects.filter(s => accusedIds.includes(s.id)).map(s => s.name).join(', ');
    generateCaseSummary(caseData, accusedIds[0], gameResult || 'FAILURE', evidenceDiscovered)
        .then(setSummary);
  }, [caseData, accusedIds, gameResult, evidenceDiscovered]);

  const accusedSuspects = caseData.suspects.filter(s => accusedIds.includes(s.id));
  const guiltySuspects = caseData.suspects.filter(s => s.isGuilty);
  const guiltyNames = guiltySuspects.map(s => s.name).join(', ');

  // Calculate stats
  const totalHiddenEvidence = caseData.suspects.reduce((acc, s) => acc + (s.hiddenEvidence?.length || 0), 0);
  const allHiddenTitles = new Set(caseData.suspects.flatMap(s => (s.hiddenEvidence || []).map(e => e.title)));
  const foundHiddenCount = evidenceDiscovered.filter(e => allHiddenTitles.has(e.title)).length;
  const totalSuspects = caseData.suspects.filter(s => !s.isDeceased).length;
  const totalTimeline = caseData.suspects.reduce((acc, s) => acc + (s.timeline?.length || 0), 0);
  
  const getResultColor = () => {
      if (gameResult === 'SUCCESS') return '#0f0';
      if (gameResult === 'PARTIAL') return '#fa0';
      return '#f00';
  };

  const resultColor = getResultColor();

  // Global stats calculations
  const plays = caseStats?.plays || 0;
  const successRate = plays > 0 ? Math.round((caseStats!.successes / plays) * 100) : 0;
  const failRate = plays > 0 ? Math.round((caseStats!.failures / plays) * 100) : 0;
  const avgEvidence = plays > 0 ? ((caseStats!.totalEvidenceFound || 0) / plays) : 0;
  const avgSuspects = plays > 0 ? ((caseStats!.totalSuspectsSpoken || 0) / plays) : 0;
  const avgTimeline = plays > 0 ? ((caseStats!.totalTimelineFound || 0) / plays) : 0;
  
  const formatReport = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
        const parts = line.split(/(\\{\\{FOUND:.*?\\}\\}|\\{\\{MISSED:.*?\\}\\}|\*\*.*?\*\*)/g);
        return (
            <div key={i} style={{ minHeight: '1.2em', marginBottom: '4px' }}>
                {parts.map((part, j) => {
                    if (part.startsWith('{{FOUND:')) {
                        const content = part.slice(8, -2);
                        return <span key={j} style={{ color: '#0f0', fontWeight: 'bold' }}>{content}</span>;
                    }
                    if (part.startsWith('{{MISSED:')) {
                        const content = part.slice(9, -2);
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

        <div className="desktop-only" style={{ display: window.innerWidth > 768 ? 'block' : 'none' }}>
            <ResetButton onClick={onReset}>RETURN TO HQ</ResetButton>
        </div>
      </LeftPanel>

      <RightPanel>
        <Stamp $gameResult={gameResult}>
            {gameResult === 'SUCCESS' ? "SUCCESS" : gameResult === 'PARTIAL' ? "PARTIAL" : "FAILURE"}
        </Stamp>
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
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

        {/* VOTING */}
        <VoteRow>
          <VoteButton $active={userVote === 'up'} $type="up" onClick={() => onVote('up')}>
            ▲ <VoteCount>{caseStats?.upvotes || 0}</VoteCount>
          </VoteButton>
          <span style={{ color: '#555', fontSize: 'var(--type-small)', textTransform: 'uppercase' }}>Rate this case</span>
          <VoteButton $active={userVote === 'down'} $type="down" onClick={() => onVote('down')}>
            ▼ <VoteCount>{caseStats?.downvotes || 0}</VoteCount>
          </VoteButton>
        </VoteRow>

        {/* GLOBAL INTEL */}
        <IntelSection>
          <IntelTitle>▸ GLOBAL INTEL</IntelTitle>
          <IntelRow>
            <label>Total Plays</label>
            <span style={{ color: '#0ff', fontWeight: 'bold' }}>{plays}</span>
          </IntelRow>
          <IntelRow>
            <label>Success Rate</label>
            <span style={{ color: '#0f0' }}>{successRate}%</span>
          </IntelRow>
          <IntelRow>
            <label>Failure Rate</label>
            <span style={{ color: '#f55' }}>{failRate}%</span>
          </IntelRow>
        </IntelSection>

        {/* YOUR PERFORMANCE vs GLOBAL */}
        <IntelSection>
          <IntelTitle>▸ YOUR PERFORMANCE vs GLOBAL</IntelTitle>
          
          <CompareRow>
            <CompareValues>
              <span className="you">Result: {gameResult}</span>
              <span className="avg">{successRate}% of detectives succeed</span>
            </CompareValues>
            <CompareBar>
              <CompareBarFill $width={successRate} $color="#0f03" />
              <CompareBarFill $width={gameResult === 'SUCCESS' ? 100 : 0} $color={resultColor} />
            </CompareBar>
          </CompareRow>

          <CompareRow>
            <CompareValues>
              <span className="you">Evidence: {foundHiddenCount}/{totalHiddenEvidence}</span>
              <span className="avg">Avg: {avgEvidence.toFixed(1)}/{totalHiddenEvidence}</span>
            </CompareValues>
            <CompareBar>
              <CompareBarFill $width={totalHiddenEvidence > 0 ? (avgEvidence / totalHiddenEvidence) * 100 : 0} $color="rgba(0, 255, 255, 0.3)" />
              <CompareBarFill $width={totalHiddenEvidence > 0 ? (foundHiddenCount / totalHiddenEvidence) * 100 : 0} $color="#0ff" />
            </CompareBar>
          </CompareRow>

          <CompareRow>
            <CompareValues>
              <span className="you">Suspects Spoken: {suspectsSpoken}/{totalSuspects}</span>
              <span className="avg">Avg: {avgSuspects.toFixed(1)}/{totalSuspects}</span>
            </CompareValues>
            <CompareBar>
              <CompareBarFill $width={totalSuspects > 0 ? (avgSuspects / totalSuspects) * 100 : 0} $color="rgba(255, 170, 0, 0.3)" />
              <CompareBarFill $width={totalSuspects > 0 ? (suspectsSpoken / totalSuspects) * 100 : 0} $color="#fa0" />
            </CompareBar>
          </CompareRow>

          <CompareRow>
            <CompareValues>
              <span className="you">Timeline: {timelineFound}/{totalTimeline}</span>
              <span className="avg">Avg: {avgTimeline.toFixed(1)}/{totalTimeline}</span>
            </CompareValues>
            <CompareBar>
              <CompareBarFill $width={totalTimeline > 0 ? (avgTimeline / totalTimeline) * 100 : 0} $color="rgba(170, 0, 255, 0.3)" />
              <CompareBarFill $width={totalTimeline > 0 ? (timelineFound / totalTimeline) * 100 : 0} $color="#a0f" />
            </CompareBar>
          </CompareRow>
        </IntelSection>

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
