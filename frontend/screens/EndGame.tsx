
import React, { useEffect, useState } from 'react';
import { type } from '../theme';
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
  padding: calc(var(--space) * 5);
  gap: calc(var(--space) * 5);
  background: var(--color-surface-inset);
  
  @media (max-width: 768px) {
    display: block;
    height: 100%;
    overflow-y: auto;
    padding: calc(var(--space) * 2);
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
    margin-bottom: calc(var(--space) * 4);
  }
`;

const RightPanel = styled.div`
  flex: 0 0 380px;
  border: 1px solid var(--color-border);
  padding: calc(var(--space) * 3);
  background: var(--color-surface-raised);
  display: flex;
  flex-direction: column;
  gap: calc(var(--space) * 2);
  overflow-y: auto;
  animation: ${fadeIn} 0.8s ease-out;
  
  @media (max-width: 768px) {
    width: 100%;
    height: auto;
    overflow-y: visible;
    padding: calc(var(--space) * 2);
  }
`;

const TopRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: calc(var(--space) * 3);
  padding-bottom: calc(var(--space) * 3);
  border-bottom: 2px solid var(--color-border);
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
    gap: calc(var(--space) * 2);
    text-align: center;
  }
`;

const Header = styled.h1<{ $gameResult: 'SUCCESS' | 'PARTIAL' | 'FAILURE' | null }>`
  ${type.h1}
  color: ${props => props.$gameResult === 'SUCCESS' ? 'var(--color-accent-green)' : props.$gameResult === 'PARTIAL' ? 'var(--color-accent-orange)' : 'var(--color-accent-red)'};
  margin: 0;
  text-transform: uppercase;
  text-shadow: 0 0 10px ${props => props.$gameResult === 'SUCCESS' ? 'var(--color-accent-green)' : props.$gameResult === 'PARTIAL' ? 'var(--color-accent-orange)' : 'var(--color-accent-red)'};
  line-height: 1;
  
  @media (max-width: 768px) {
    ${type.h2}
  }
`;

const CompactStats = styled.div`
  display: flex;
  gap: calc(var(--space) * 4);
  
  @media (max-width: 768px) {
    width: 100%;
    justify-content: center;
    gap: calc(var(--space) * 3);
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
    ${type.small} 
    color: #777;
    text-transform: uppercase; 
    margin-bottom: var(--space);
  }
  
  span { 
    ${type.h3} 
    color: var(--color-text-bright);
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
  ${type.h1}
  border: 5px solid ${props => props.$gameResult === 'SUCCESS' ? 'var(--color-accent-green)' : props.$gameResult === 'PARTIAL' ? 'var(--color-accent-orange)' : 'var(--color-accent-red)'};
  color: ${props => props.$gameResult === 'SUCCESS' ? 'var(--color-accent-green)' : props.$gameResult === 'PARTIAL' ? 'var(--color-accent-orange)' : 'var(--color-accent-red)'};
  padding: var(--space) calc(var(--space) * 3);
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
    ${type.h2}
    padding: 0 var(--space);
  }
`;

const SummaryBox = styled.div`
  background: var(--color-surface-raised);
  padding: calc(var(--space) * 4);
  border-left: 4px solid var(--color-border-strong);
  color: var(--color-text);
  ${type.bodyLg}
  line-height: 1.6;
  white-space: pre-wrap;
  font-family: 'VT323', monospace;
  overflow-y: auto;
  flex: 1;
  
  @media (max-width: 768px) {
    padding: calc(var(--space) * 2);
    ${type.body}
    height: auto;
    overflow-y: visible;
    border-left: 2px solid var(--color-border-strong);
  }
`;

// --- RIGHT PANEL ITEMS ---

const StatItem = styled.div`
  background: var(--color-border-subtle);
  padding: calc(var(--space) * 2);
  h3 { margin: 0 0 5px 0; color: var(--color-text-subtle); ${type.small} text-transform: uppercase; }
  span { ${type.h3} color: var(--color-text-bright); }
`;

const EvidenceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space);
`;

const EvidenceRow = styled.div<{ $found: boolean }>`
  display: flex;
  align-items: center;
  gap: var(--space);
  color: ${props => props.$found ? 'var(--color-accent-green)' : 'var(--color-text-disabled)'};
  ${type.body}
  padding: var(--space);
  border-bottom: 1px solid var(--color-border-subtle);

  span.icon {
    width: 20px;
    text-align: center;
    font-weight: bold;
  }
`;

const ResetButton = styled.button`
  background: var(--color-text-bright);
  color: var(--color-text-inverse);
  border: none;
  padding: calc(var(--space) * 2) calc(var(--space) * 4);
  ${type.h3}
  font-family: inherit;
  font-weight: bold;
  cursor: pointer;
  text-transform: uppercase;
  margin-top: calc(var(--space) * 3);
  
  &:hover { background: #ccc; }
  
  @media (max-width: 768px) {
    width: 100%;
    padding: calc(var(--space) * 3);
    margin-bottom: calc(var(--space) * 3);
  }
`;

// --- VOTING ---

const VoteRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(var(--space) * 3);
  padding: calc(var(--space) * 2);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
`;

const VoteButton = styled.button<{ $active: boolean; $type: 'up' | 'down' }>`
  background: ${props => props.$active 
    ? (props.$type === 'up' ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)') 
    : 'transparent'};
  border: 2px solid ${props => props.$active 
    ? (props.$type === 'up' ? 'var(--color-accent-green)' : 'var(--color-accent-red)') 
    : 'var(--color-border)'};
  color: ${props => props.$active 
    ? (props.$type === 'up' ? 'var(--color-accent-green)' : 'var(--color-accent-red)') 
    : 'var(--color-text-subtle)'};
  padding: var(--space) calc(var(--space) * 3);
  font-family: inherit;
  ${type.h3}
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: var(--space);

  &:hover {
    border-color: ${props => props.$type === 'up' ? 'var(--color-accent-green)' : 'var(--color-accent-red)'};
    color: ${props => props.$type === 'up' ? 'var(--color-accent-green)' : 'var(--color-accent-red)'};
    background: ${props => props.$type === 'up' ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)'};
  }
`;

const VoteCount = styled.span`
  ${type.body}
  color: var(--color-text-subtle);
`;

// --- GLOBAL INTEL / LEADERBOARD ---

const IntelSection = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  padding: calc(var(--space) * 2);
`;

const IntelTitle = styled.h3`
  color: var(--color-accent-cyan);
  ${type.small}
  text-transform: uppercase;
  margin: 0 0 12px 0;
  letter-spacing: 1px;
  border-bottom: 1px solid var(--color-border-subtle);
  padding-bottom: var(--space);
`;

const IntelRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  ${type.body}
  
  label { color: #777; ${type.small} text-transform: uppercase; }
`;

const CompareBar = styled.div`
  position: relative;
  height: 6px;
  background: var(--color-border-subtle);
  margin-top: var(--space);
  overflow: hidden;
`;

const CompareBarFill = styled.div<{ $width: number; $color: string }>`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: ${props => props.$width}%;
  background: ${props => props.$color};
  transition: width 0.8s ease-out;
`;

const CompareRow = styled.div`
  margin-bottom: calc(var(--space) * 2);
`;

const CompareValues = styled.div`
  display: flex;
  justify-content: space-between;
  ${type.small}
  margin-bottom: var(--space);
  
  .you { color: var(--color-accent-cyan); }
  .avg { color: var(--color-text-dim); }
`;

/* ─── Inline style replacements ─── */

const ReportLine = styled.div`
  min-height: 1.2em;
  margin-bottom: var(--space);
`;

const FoundTag = styled.span`
  color: var(--color-accent-green);
  font-weight: bold;
`;

const MissedTag = styled.span`
  color: var(--color-accent-red-bright);
  font-weight: bold;
`;

const BoldTag = styled.span`
  color: var(--color-text-bright);
  font-weight: bold;
`;

const AccusedPortraitGrid = styled.div`
  text-align: center;
  margin-bottom: calc(var(--space) * 1.25);
`;

const PortraitRow = styled.div`
  display: flex;
  gap: calc(var(--space) * 1.25);
  justify-content: center;
  flex-wrap: wrap;
`;

const SubjectHeading = styled.h2`
  margin-top: calc(var(--space) * 1.25);
  ${type.h2}
`;

const DesktopOnly = styled.div`
  @media (max-width: 768px) { display: none; }
`;

const MobileOnly = styled.div`
  display: none;
  @media (max-width: 768px) { display: block; }
`;

const VoteDividerLabel = styled.span`
  color: var(--color-text-disabled);
  ${type.small}
  text-transform: uppercase;
`;

const IntelValue = styled.span<{ $color: string }>`
  color: ${props => props.$color};
  font-weight: bold;
`;

const EvidenceLogTitle = styled.h3`
  border-bottom: 1px solid var(--color-border-strong);
  padding-bottom: var(--space);
  margin-top: calc(var(--space) * 1.25);
  ${type.small}
`;

const EvidenceInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const EvidenceTitle = styled.span`
  font-weight: bold;
`;

const EvidenceMissedHint = styled.span`
  ${type.small}
  font-style: italic;
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
      if (gameResult === 'SUCCESS') return 'var(--color-accent-green)';
      if (gameResult === 'PARTIAL') return 'var(--color-accent-orange)';
      return 'var(--color-accent-red)';
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
        const parts = line.split(/(\{\{FOUND:.*?\}\}|\{\{MISSED:.*?\}\}|\*\*.*?\*\*)/g);
        return (
            <ReportLine key={i}>
                {parts.map((part, j) => {
                    if (part.startsWith('{{FOUND:')) {
                        const content = part.slice(8, -2);
                        return <FoundTag key={j}>{content}</FoundTag>;
                    }
                    if (part.startsWith('{{MISSED:')) {
                        const content = part.slice(9, -2);
                        return <MissedTag key={j}>{content}</MissedTag>;
                    }
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <BoldTag key={j}>{part.slice(2, -2)}</BoldTag>;
                    }
                    return <span key={j}>{part}</span>;
                })}
            </ReportLine>
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

        <DesktopOnly>
            <ResetButton onClick={onReset}>RETURN TO HQ</ResetButton>
        </DesktopOnly>
      </LeftPanel>

      <RightPanel>
        <Stamp $gameResult={gameResult}>
            {gameResult === 'SUCCESS' ? "SUCCESS" : gameResult === 'PARTIAL' ? "PARTIAL" : "FAILURE"}
        </Stamp>
        <AccusedPortraitGrid>
            {accusedSuspects.length > 0 ? (
                <PortraitRow>
                    {accusedSuspects.map(s => (
                        <SuspectPortrait 
                            key={s.id}
                            suspect={s} 
                            size={120} 
                        />
                    ))}
                </PortraitRow>
            ) : (
                <SuspectPortrait 
                    suspect={caseData.suspects[0]} 
                    size={200} 
                />
            )}
            <SubjectHeading>
                {accusedSuspects.length > 0 ? `SUBJECTS: ${accusedSuspects.map(s => s.name).join(', ')}` : "SUBJECT: None"}
            </SubjectHeading>
        </AccusedPortraitGrid>

        {/* VOTING */}
        <VoteRow>
          <VoteButton $active={userVote === 'up'} $type="up" onClick={() => onVote('up')}>
            ▲ <VoteCount>{caseStats?.upvotes || 0}</VoteCount>
          </VoteButton>
          <VoteDividerLabel>Rate this case</VoteDividerLabel>
          <VoteButton $active={userVote === 'down'} $type="down" onClick={() => onVote('down')}>
            ▼ <VoteCount>{caseStats?.downvotes || 0}</VoteCount>
          </VoteButton>
        </VoteRow>

        {/* GLOBAL INTEL */}
        <IntelSection>
          <IntelTitle>▸ GLOBAL INTEL</IntelTitle>
          <IntelRow>
            <label>Total Plays</label>
            <IntelValue $color="var(--color-accent-cyan)">{plays}</IntelValue>
          </IntelRow>
          <IntelRow>
            <label>Success Rate</label>
            <IntelValue $color="var(--color-accent-green)">{successRate}%</IntelValue>
          </IntelRow>
          <IntelRow>
            <label>Failure Rate</label>
            <IntelValue $color="var(--color-accent-red-bright)">{failRate}%</IntelValue>
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

        <EvidenceLogTitle>EVIDENCE LOG</EvidenceLogTitle>
        <EvidenceList>
            {caseData.suspects.flatMap(s => s.hiddenEvidence || []).map((ev, i) => {
                const isFound = evidenceDiscovered.some(e => e.title === ev.title);
                return (
                    <EvidenceRow key={i} $found={isFound}>
                        <span className="icon">{isFound ? '✓' : '✗'}</span>
                        <EvidenceInfo>
                            <EvidenceTitle>{ev.title}</EvidenceTitle>
                            {!isFound && <EvidenceMissedHint>Held by: {caseData.suspects.find(s => (s.hiddenEvidence || []).includes(ev))?.name}</EvidenceMissedHint>}
                        </EvidenceInfo>
                    </EvidenceRow>
                );
            })}
        </EvidenceList>

        <MobileOnly>
            <ResetButton onClick={onReset}>RETURN TO HQ</ResetButton>
        </MobileOnly>
      </RightPanel>
    </Container>
  );
};

export default EndGame;
