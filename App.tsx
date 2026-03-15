
import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import toast, { Toaster } from 'react-hot-toast';
import { GameState, ScreenState, ChatMessage, Emotion, CaseData, Evidence } from './types';
import { getSuspectResponse, getOfficerChatResponse, generateCaseFromPrompt, getBadCopHint, getPartnerIntervention, pregenerateCaseImages, calculateDifficulty } from './services/geminiService';
import { generateTTS } from './services/geminiTTS';
import { fetchCommunityCases, fetchUserCases, publishCase, deleteCase, updateCase, fetchAllCaseStats, fetchCaseStats, fetchUserVote, submitVote, recordGameResult, saveLocalDraft, fetchLocalDrafts, deleteLocalDraft } from './services/persistence';
import { CaseStats } from './types';
import { auth, logout } from './services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

// Import Modular Components
import Layout from './components/Layout';
import CaseSelection from './screens/CaseSelection';
import CaseHub from './screens/CaseHub';
import Interrogation from './screens/Interrogation';
import Accusation from './screens/Accusation';
import EndGame from './screens/EndGame';
import CreateCase from './screens/CreateCase';
import CaseReview from './screens/CaseReview';
import BootSequence from './components/BootSequence';
import Login from './components/Login';
import { OnboardingTour } from './components/OnboardingTour';

// --- STYLES FOR MODAL ---
const Overlay = styled.div`
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  flex-direction: column;
  gap: 20px;
`;

const ConfirmBox = styled.div`
  background: #050505;
  border: 2px solid #f00;
  padding: 30px;
  width: 500px;
  max-width: 90%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-shadow: 0 0 30px #500;
  text-align: center;
`;

const WarningTitle = styled.h2`
  color: #f00;
  margin: 0;
  text-transform: uppercase;
  font-size: var(--type-h2);
  text-shadow: 0 0 10px #f00;
`;

const WarningText = styled.p`
  color: #ddd;
  font-size: var(--type-body-lg);
  line-height: 1.5;
  margin: 0;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-top: 10px;
`;

const ModalButton = styled.button<{ $variant: 'cancel' | 'confirm' }>`
  background: ${props => props.$variant === 'confirm' ? '#500' : '#222'};
  color: #fff;
  border: 1px solid ${props => props.$variant === 'confirm' ? '#f00' : '#555'};
  padding: 10px 20px;
  font-family: inherit;
  font-size: var(--type-body-lg);
  cursor: pointer;
  flex: 1;
  text-transform: uppercase;

  &:hover {
    background: ${props => props.$variant === 'confirm' ? '#f00' : '#444'};
    box-shadow: ${props => props.$variant === 'confirm' ? '0 0 15px #f00' : 'none'};
  }
`;

const TIME_INCREMENT_MS = 5 * 60 * 1000; // 5 minutes per action
const WAIT_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes before they get mad
const INITIAL_TIME_MS = new Date('2030-09-12T09:00:00').getTime();

/** Formats "Noah Semus" → "Noah S." */
const formatAuthorName = (displayName: string | null | undefined): string => {
  if (!displayName) return 'Unknown Author';
  const parts = displayName.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || 'Unknown Author';
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
};

/**
 * Fallback timeline extraction: scans the suspect's text response for any
 * mention of their known timeline entries. Returns the first match, or null.
 * This catches cases where the AI mentions a time but forgets to populate
 * the structured `revealedTimelineStatement` field.
 */
const extractTimelineFromText = (
  text: string,
  suspectTimeline: { time: string; activity: string }[]
): { time: string; statement: string } | null => {
  if (!text || !suspectTimeline || suspectTimeline.length === 0) return null;
  const lowerText = text.toLowerCase();

  for (const entry of suspectTimeline) {
    // Normalize the time for matching (e.g. "10:35" or "8:00 PM")
    const timeStr = entry.time?.trim();
    if (!timeStr) continue;

    // Check if the response text contains the time string
    if (lowerText.includes(timeStr.toLowerCase())) {
      return { time: timeStr, statement: entry.activity };
    }

    // Also try matching just the numeric part (e.g. "10:35" from "10:35 AM")
    const numericMatch = timeStr.match(/(\d{1,2}:\d{2})/);
    if (numericMatch && lowerText.includes(numericMatch[1])) {
      return { time: timeStr, statement: entry.activity };
    }
  }

  // Also check if the text mentions a key phrase from any activity
  for (const entry of suspectTimeline) {
    if (!entry.activity) continue;
    // Extract meaningful keywords (4+ chars) from the activity
    const keywords = entry.activity
      .split(/\s+/)
      .filter(w => w.length >= 4)
      .map(w => w.toLowerCase().replace(/[^a-z]/g, ''));
    // If at least 2 significant keywords match, consider it a hit
    const matchCount = keywords.filter(kw => kw && lowerText.includes(kw)).length;
    if (keywords.length >= 2 && matchCount >= 2) {
      return { time: entry.time, statement: entry.activity };
    }
  }

  return null;
};

const DEFAULT_SUGGESTIONS = [
  { label: "Where were you?", text: "Good evening. I'm the detective assigned to this case. Can you tell me where you were at the time of the crime?" },
  { label: "Connection to Victim", text: "I apologize for the intrusion during this difficult time, but I need to ask: how exactly did you know the victim?" },
  { label: "Any Witnesses?", text: "We're verifying timelines. Is there anyone who can confirm your whereabouts during the incident?" }
];

const App: React.FC = () => {
  // --- AUTH ---
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const isAdmin = user?.email === 'noahsemus@gmail.com';

  // --- STATE ---
  const [hasBooted, setHasBooted] = useState(false);
  const [powerState, setPowerState] = useState<'on' | 'off' | 'turning-on' | 'turning-off'>('turning-on');
  
  const [communityCases, setCommunityCases] = useState<CaseData[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState(false);
  
  // Social features state
  const [localDrafts, setLocalDrafts] = useState<CaseData[]>([]);
  const [allCaseStats, setAllCaseStats] = useState<Record<string, CaseStats>>({});
  const [currentCaseStats, setCurrentCaseStats] = useState<CaseStats | null>(null);
  const [currentUserVote, setCurrentUserVote] = useState<'up' | 'down' | null>(null);
  const [hasRecordedResult, setHasRecordedResult] = useState(false);

  const [gameState, setGameState] = useState<GameState>({
    currentScreen: ScreenState.CASE_SELECTION,
    selectedCaseId: null,
    currentSuspectId: null,
    aggravationLevels: {},
    notes: {},
    evidenceDiscovered: [],
    timelineStatementsDiscovered: [],
    chatHistory: {},
    officerHistory: [],
    suspectEmotions: {},
    partnerEmotion: Emotion.NEUTRAL,
    suspectTurnIds: {},
    gameResult: null,
    accusedSuspectIds: [],
    officerHintsRemaining: 10,
    currentOfficerHint: null,
    sidekickComment: null,
    partnerCharges: 3,
    gameTime: INITIAL_TIME_MS,
    lastInteractionTimes: {},
    suspectSuggestions: {}
  });

  const [draftCase, setDraftCase] = useState<CaseData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [thinkingSuspectId, setThinkingSuspectId] = useState<string | null>(null);
  const [hasUnsavedDraftChanges, setHasUnsavedDraftChanges] = useState(false);
  const draftSaveFnRef = useRef<(() => Promise<void>) | null>(null);
  const draftCheckConsistencyFnRef = useRef<(() => void) | null>(null);
  const draftCloseFnRef = useRef<(() => void) | null>(null);
  
  const [currentSuggestions, setCurrentSuggestions] = useState<(string | { label: string; text: string })[]>([]);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('isMuted') === 'true');
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('globalVolume');
    return saved !== null ? parseFloat(saved) : 0.7;
  });
  const [mobileIntelOpen, setMobileIntelOpen] = useState(false);
  const [unreadSuspects, setUnreadSuspects] = useState<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem('isMuted', String(isMuted));
  }, [isMuted]);

  useEffect(() => {
    localStorage.setItem('globalVolume', String(volume));
  }, [volume]);

  // Sync draftCase changes back to communityCases for UI consistency
  useEffect(() => {
    if (draftCase) {
      setCommunityCases(prev => prev.map(c => c.id === draftCase.id ? draftCase : c));
    }
  }, [draftCase]);

  // DEBUG: Log State Transitions
  useEffect(() => {
    console.log("[DEBUG] Game State Update:", { 
      screen: gameState.currentScreen,
      case: gameState.selectedCaseId,
      suspect: gameState.currentSuspectId,
      aggravation: gameState.aggravationLevels,
      time: new Date(gameState.gameTime).toLocaleTimeString()
    });
  }, [gameState.currentScreen, gameState.selectedCaseId, gameState.currentSuspectId, gameState.aggravationLevels, gameState.gameTime]);

  // Handle Boot Sequence Completion
  const handleBootComplete = () => {
    // 1. Start turning off (collapse screen)
    setPowerState('turning-off');
    
    // 2. Wait for collapse (500ms), then switch to game mode and turn on again
    setTimeout(() => {
       setHasBooted(true);
       setPowerState('turning-on');
    }, 600);
  };



  // Handle Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Community Cases and Stats on Mount
  useEffect(() => {
    if (user) {
      loadCommunity();
      loadDrafts();
    }
  }, [user]);

  const loadCommunity = async () => {
    setLoadingCommunity(true);
    // Fetch published community cases AND the current user's own cases (published+unpublished)
    const fetches: [Promise<CaseData[]>, Promise<CaseData[]>, Promise<Record<string, CaseStats>>] = [
      fetchCommunityCases(),
      user?.uid ? fetchUserCases(user.uid) : Promise.resolve([]),
      fetchAllCaseStats()
    ];
    const [publishedCases, userCases, stats] = await Promise.all(fetches);
    
    // Merge: user's own cases take precedence (they may have unpublished edits)
    const caseMap = new Map<string, CaseData>();
    publishedCases.forEach(c => caseMap.set(c.id, c));
    userCases.forEach(c => caseMap.set(c.id, c)); // User's version overwrites community version
    
    // Filter out corrupted cases (missing ID or title or empty strings)
    const validCases = Array.from(caseMap.values()).filter(c => 
      c && 
      c.id && typeof c.id === 'string' && c.id.trim() !== '' &&
      c.title && typeof c.title === 'string' && c.title.trim() !== ''
    );
    setCommunityCases(validCases);
    setAllCaseStats(stats);
    setLoadingCommunity(false);
  };

  const loadDrafts = () => {
    setLocalDrafts(fetchLocalDrafts());
  };



  // --- HELPERS ---

  // Resolves a case by ID from all sources (community, draft, local)
  const findCaseById = (caseId: string | null | undefined): CaseData | undefined => {
    if (!caseId) return undefined;
    return communityCases.find(c => c.id === caseId)
      || (draftCase?.id === caseId ? draftCase : undefined)
      || localDrafts.find(d => d.id === caseId);
  };

  // --- ACTIONS ---

  const selectCase = (caseInput: string | CaseData) => {
    console.log('[DEBUG] selectCase:', typeof caseInput === 'string' ? caseInput : caseInput.title);
    let selectedCase: CaseData | undefined;
    if (typeof caseInput === 'string') {
        selectedCase = findCaseById(caseInput);
    } else {
        selectedCase = caseInput;
    }
    if (!selectedCase) return;

    const initialAggravation: Record<string, number> = {};
    const initialNotes: Record<string, string[]> = {};
    const initialHistory: Record<string, ChatMessage[]> = {};
    const initialEmotions: Record<string, Emotion> = {};
    const initialTurnIds: Record<string, string | undefined> = {};
    // Don't pre-fill time. Timer starts on first interaction.
    const initialInteractionTimes: Record<string, number> = {}; 
    
    selectedCase.suspects.forEach(s => {
      initialAggravation[s.id] = s.baseAggravation;
      initialNotes[s.id] = [];
      initialHistory[s.id] = [];
      initialEmotions[s.id] = Emotion.NEUTRAL;
      initialTurnIds[s.id] = undefined; 
    });

    const officerName = selectedCase.officer?.name || "The Chief";
    const officerGreeting = `This is ${officerName}. I'm busy, so make it quick. What do you have?`;

    setGameState(prev => ({
      ...prev,
      currentScreen: ScreenState.CASE_HUB,
      selectedCaseId: selectedCase!.id,
      currentSuspectId: null,
      aggravationLevels: initialAggravation,
      notes: initialNotes,
      evidenceDiscovered: [...selectedCase!.initialEvidence],
      timelineStatementsDiscovered: (selectedCase!.initialTimeline || []).map((t, i) => ({
        id: `initial-ts-${i}`,
        suspectId: 'system',
        suspectName: 'POLICE REPORT',
        time: t.time,
        statement: t.activity || (t as any).statement || ''
      })),
      chatHistory: initialHistory,
      officerHistory: [{ sender: 'officer', text: officerGreeting, timestamp: new Date(INITIAL_TIME_MS).toLocaleTimeString() }],
      suspectEmotions: initialEmotions,
      partnerEmotion: Emotion.NEUTRAL,
      suspectTurnIds: initialTurnIds,
      officerHintsRemaining: 10,
      currentOfficerHint: null,
      sidekickComment: "I'm ready to back you up, Detective. I've got 3 moves I can pull if things get hairy.",
      partnerCharges: 3,
      winner: null,
      accusedSuspectId: null,
      gameTime: INITIAL_TIME_MS,
      lastInteractionTimes: initialInteractionTimes,
      suspectSuggestions: {} // Reset suggestions for new case
    }));

    // Pre-load default suggestions but don't persist them yet (since no suspect is selected)
    setCurrentSuggestions(DEFAULT_SUGGESTIONS);
  };

  const startInterrogation = (suspectId: string) => {
    // Check for "Kept Waiting" Penalty logic
    const { gameTime, lastInteractionTimes, aggravationLevels, chatHistory, selectedCaseId, suspectSuggestions } = gameState;
    const currentCase = findCaseById(selectedCaseId)!;
    const suspect = currentCase.suspects.find(s => s.id === suspectId)!;
    
    let newAgg = aggravationLevels[suspectId] || 0;
    let newHistory = chatHistory[suspectId] || [];
    let updatedInteractionTimes = { ...lastInteractionTimes };

    if (!suspect.isDeceased) {
        const lastSeen = lastInteractionTimes[suspectId];
        
        // ONLY check penalty if we have spoken before (timer is running)
        if (lastSeen !== undefined) {
            const diffMs = gameTime - lastSeen;
            
            if (diffMs > WAIT_THRESHOLD_MS) {
                const hours = Math.floor(diffMs / (60 * 60 * 1000));
                const mins = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
                const penalty = 5 + Math.floor(diffMs / (60 * 60 * 1000)) * 5; // +5, then +5 more per hour
                
                newAgg = Math.min(100, newAgg + penalty);
                
                const timeStr = hours > 0 ? `${hours} hour${hours > 1 ? 's' : ''}` : `${mins} mins`;
                
                newHistory = [...newHistory, {
                    sender: 'system',
                    text: `[SYSTEM] Subject is annoyed. You kept them waiting for ${timeStr}. (+${penalty}% Aggravation)`,
                    timestamp: new Date(gameTime).toLocaleTimeString()
                }];
            }
            // Update interaction time to NOW since we are back with them
            updatedInteractionTimes[suspectId] = gameTime;
        }
    }

    // LOAD PERSISTED SUGGESTIONS OR DEFAULTS
    const savedSuggestions = suspectSuggestions[suspectId];
    if (savedSuggestions && savedSuggestions.length > 0) {
        setCurrentSuggestions(savedSuggestions);
    } else {
        setCurrentSuggestions(DEFAULT_SUGGESTIONS);
    }


    setGameState(prev => ({
      ...prev,
      currentScreen: ScreenState.INTERROGATION,
      currentSuspectId: suspectId,
      sidekickComment: prev.sidekickComment,
      aggravationLevels: { ...prev.aggravationLevels, [suspectId]: newAgg },
      chatHistory: { ...prev.chatHistory, [suspectId]: newHistory },
      lastInteractionTimes: updatedInteractionTimes
    }));
  };

  const handlePartnerAction = async (action: 'goodCop' | 'badCop' | 'examine' | 'hint') => {
      console.log('[DEBUG] handlePartnerAction:', action);
      const { currentSuspectId, partnerCharges, aggravationLevels, selectedCaseId, evidenceDiscovered, chatHistory, gameTime } = gameState;
      if (!currentSuspectId || !selectedCaseId || partnerCharges <= 0) return;

      const currentCase = findCaseById(selectedCaseId)!;
      const suspect = currentCase.suspects.find(s => s.id === currentSuspectId)!;
      const currentAgg = aggravationLevels[currentSuspectId] || 0;
      
      // ADVANCE TIME
      const newGameTime = gameTime + TIME_INCREMENT_MS;
      
      setThinkingSuspectId(currentSuspectId);

      // Reaction Logic
      let newPartnerEmotion = Emotion.NEUTRAL;
      if (action === 'goodCop') newPartnerEmotion = Emotion.HAPPY;
      else if (action === 'badCop') newPartnerEmotion = Emotion.ANGRY;
      else if (action === 'examine' || action === 'hint') newPartnerEmotion = Emotion.NEUTRAL;

      try {
        const partnerDialogue = await getPartnerIntervention(
           action, 
           suspect,
           currentCase,
           chatHistory[currentSuspectId] || []
        );

        let newAgg = currentAgg;
        let whisperComment = "";

        if (action === 'goodCop') {
            newAgg = Math.floor(currentAgg * 0.5);
            whisperComment = "I smoothed things over. They seem calmer now.";
        } else if (action === 'badCop') {
            let aggIncrease = 20 + Math.floor(Math.random() * 15);
            newAgg = Math.min(100, currentAgg + aggIncrease);
            whisperComment = "Reading their reaction...";
        } else if (action === 'examine') {
            whisperComment = "Examination logged.";
        } else if (action === 'hint') {
            whisperComment = "Hope that helps.";
        }

        const partnerMsg: ChatMessage = {
            sender: 'partner',
            text: partnerDialogue,
            timestamp: new Date(newGameTime).toLocaleTimeString(),
            type: action === 'badCop' ? 'action' : 'talk'
        };

        // Partner clears suggestions for now, as context changes
        setCurrentSuggestions([]);

        setGameState(prev => ({
          ...prev,
          partnerCharges: prev.partnerCharges - 1,
          chatHistory: { ...prev.chatHistory, [currentSuspectId]: [...(prev.chatHistory[currentSuspectId] || []), partnerMsg] },
          sidekickComment: whisperComment,
          partnerEmotion: newPartnerEmotion,
          gameTime: newGameTime,
          // Partner action counts as interaction, starting/resetting timer
          lastInteractionTimes: { ...prev.lastInteractionTimes, [currentSuspectId]: newGameTime },
          suspectSuggestions: { ...prev.suspectSuggestions, [currentSuspectId]: [] } // Clear persisted
        }));
        


        // IF Deceased, we don't need a response from the suspect for these actions, the partner just talks.
        if (suspect.isDeceased) {
             setThinkingSuspectId(null);
             return; 
        }

        const promptForSuspect = `[PARTNER INTERVENTION (${action === 'goodCop' ? 'GOOD COP' : 'BAD COP'})]: "${partnerDialogue}"`;

        const response = await getSuspectResponse(
          suspect,
          currentCase,
          promptForSuspect,
          'action', 
          null, 
          newAgg, 
          false,
          evidenceDiscovered // Pass discovered evidence
        );

        let finalAgg = newAgg + response.aggravationDelta;
        finalAgg = Math.max(0, Math.min(100, finalAgg));
        // Generate TTS Audio
        let audioUrl: string | null = null;
        if (!isMuted && suspect.voice && suspect.voice !== 'None') {
            audioUrl = await generateTTS(
              finalAgg >= 100 ? "That's it! I want my lawyer!" : response.text,
              suspect.voice
            );
        }

        const suspectMsg: ChatMessage = {
            sender: 'suspect',
            text: finalAgg >= 100 ? "That's it! I want my lawyer!" : response.text,
            timestamp: new Date(newGameTime).toLocaleTimeString(),
            evidence: response.revealedEvidence,
            isEvidenceCollected: false,
            audioUrl: audioUrl
        };

        let finalWhisper = whisperComment;
        if (action === 'badCop') {
            const unrevealed = suspect.hiddenEvidence.filter(hiddenEv => {
                const cleanHiddenTitle = hiddenEv.title.toLowerCase();
                
                const isDiscovered = evidenceDiscovered.some(discoveredEv => 
                    discoveredEv.title.toLowerCase().includes(cleanHiddenTitle)
                );
                
                const isJustRevealed = response.revealedEvidence 
                    ? response.revealedEvidence.toLowerCase().includes(cleanHiddenTitle)
                    : false;

                return !isDiscovered && !isJustRevealed;
            });
            finalWhisper = await getBadCopHint(suspect, unrevealed, response.text);
        }

        setGameState(prev => {
            const prevHistory = prev.chatHistory[currentSuspectId] || [];
            const newHistory = [...prevHistory, suspectMsg];

            // Timeline extraction for partner action responses (was previously missing!)
            let newTimelineStatements = [...prev.timelineStatementsDiscovered];
            let timelineEntry = response.revealedTimelineStatement;
            if (!timelineEntry && finalAgg < 100) {
              timelineEntry = extractTimelineFromText(response.text, suspect.timeline || []);
              if (timelineEntry) {
                console.log("[DEBUG] Timeline Statement (PARTNER FALLBACK):", timelineEntry);
              }
            }
            if (timelineEntry && finalAgg < 100) {
              const alreadyExists = newTimelineStatements.some(ts => 
                ts.suspectId === currentSuspectId && 
                ts.time === timelineEntry!.time
              );
              if (!alreadyExists) {
                newTimelineStatements.push({
                  id: `ts-${Date.now()}`,
                  suspectId: currentSuspectId,
                  suspectName: suspect.name,
                  suspectPortrait: suspect.portraits?.[Emotion.NEUTRAL] || undefined,
                  time: timelineEntry.time,
                  statement: timelineEntry.statement
                });
              }
            }

            return {
                ...prev,
                aggravationLevels: { ...prev.aggravationLevels, [currentSuspectId]: finalAgg },
                sidekickComment: finalWhisper,
                suspectEmotions: { ...prev.suspectEmotions, [currentSuspectId]: response.emotion },
                chatHistory: { ...prev.chatHistory, [currentSuspectId]: newHistory },
                timelineStatementsDiscovered: newTimelineStatements
            };
        });

        // Mark suspect as having unread message (badge appears when user switches away)
        setUnreadSuspects(prev => new Set(prev).add(currentSuspectId));
        // TTS playback is handled by Interrogation.tsx

    } catch (e: any) {
        console.error("Partner Action Error:", e);
        setGameState(prev => ({
          ...prev,
          sidekickComment: "I... lost my train of thought. Let's try that again.",
          chatHistory: {
            ...prev.chatHistory,
            [currentSuspectId]: [
               ...(prev.chatHistory[currentSuspectId] || []),
               { sender: 'system', text: "[ERROR] Connection Interrupted. Please retry.", timestamp: new Date(newGameTime).toLocaleTimeString() }
            ]
          }
        }));
      } finally {
        setThinkingSuspectId(null);
      }
  };

  const handleSendMessage = async (text: string, type: 'talk' | 'action' = 'talk', attachment?: string) => {
    console.log('[DEBUG] handleSendMessage:', { text, type, attachment });
    const { selectedCaseId, currentSuspectId, chatHistory, aggravationLevels, evidenceDiscovered, gameTime } = gameState;
    if (!selectedCaseId || !currentSuspectId) return;

    const currentCase = findCaseById(selectedCaseId);
    if (!currentCase) return;

    const currentSuspect = currentCase.suspects.find(s => s.id === currentSuspectId)!;
    const currentAgg = aggravationLevels[currentSuspectId];

    if (currentAgg >= 100) return;

    // ADVANCE TIME
    const newGameTime = gameTime + TIME_INCREMENT_MS;

    const suspectHistory = chatHistory[currentSuspectId] || [];
    const isFirstTurn = !suspectHistory.some(m => m.sender === 'player');

    let finalText = text;
    if (type === 'action') {
      const words = text.trim().split(' ');
      let verb = words[0].toLowerCase();
      if (verb === 'i' && words.length > 1) {
         verb = words[1].toLowerCase();
         words.shift(); 
      }
      if (verb === 'be') verb = 'is';
      else if (verb === 'have') verb = 'has';
      else if (verb.match(/(ss|x|ch|sh|o)$/)) verb += 'es';
      else if (verb.endsWith('y') && !verb.match(/[aeiou]y$/)) verb = verb.slice(0, -1) + 'ies';
      else if (!verb.endsWith('s')) verb += 's';
      words[0] = verb;
      finalText = `* ${words.join(' ')} *`;
    }

    const userMsg: ChatMessage = { 
      sender: 'player', 
      text: finalText, 
      type: type,
      attachment: attachment || null,
      timestamp: new Date(newGameTime).toLocaleTimeString() 
    };

    setGameState(prev => ({
      ...prev,
      gameTime: newGameTime,
      // Message interaction starts/resets the timer
      lastInteractionTimes: { ...prev.lastInteractionTimes, [currentSuspectId]: newGameTime },
      chatHistory: { ...prev.chatHistory, [currentSuspectId]: [...(chatHistory[currentSuspectId] || []), userMsg] },
    }));
    
    setThinkingSuspectId(currentSuspectId);

    try {
      const response = await getSuspectResponse(
        currentSuspect, 
        currentCase, 
        userMsg.text, 
        type,
        attachment || null,
        currentAgg,
        isFirstTurn,
        evidenceDiscovered // Pass discovered evidence
      );

      let newAgg = (aggravationLevels[currentSuspectId] || 0) + response.aggravationDelta;
      newAgg = Math.max(0, Math.min(100, newAgg));

      const finalMsgText = newAgg >= 100 
        ? "That's it! I'm done talking. I want my lawyer. Now!"
        : response.text;

      // Generate TTS Audio
      let audioUrl: string | null = null;
      if (!isMuted && currentSuspect.voice && currentSuspect.voice !== 'None') {
          audioUrl = await generateTTS(finalMsgText, currentSuspect.voice);
      }
      
      const suspectMsg: ChatMessage = { 
          sender: 'suspect', 
          text: finalMsgText, 
          timestamp: new Date(newGameTime).toLocaleTimeString(),
          evidence: newAgg >= 100 ? null : response.revealedEvidence, 
          isEvidenceCollected: false,
          audioUrl: audioUrl
      };

      setGameState(prev => {
        const updatedHistory = [...prev.chatHistory[currentSuspectId], suspectMsg];
        let newTimelineStatements = [...prev.timelineStatementsDiscovered];

        // Use AI's explicit timeline statement, or fall back to client-side extraction
        let timelineEntry = response.revealedTimelineStatement;
        if (!timelineEntry && newAgg < 100) {
          timelineEntry = extractTimelineFromText(response.text, currentSuspect.timeline || []);
          if (timelineEntry) {
            console.log("[DEBUG] Timeline Statement (FALLBACK extraction):", timelineEntry);
          }
        }

        if (timelineEntry && newAgg < 100) {
          console.log("[DEBUG] Timeline Statement Revealed:", timelineEntry);
          const alreadyExists = newTimelineStatements.some(ts => 
            ts.suspectId === currentSuspectId && 
            ts.time === timelineEntry!.time
          );

          if (!alreadyExists) {
            newTimelineStatements.push({
              id: `ts-${Date.now()}`,
              suspectId: currentSuspectId,
              suspectName: currentSuspect.name,
              suspectPortrait: currentSuspect.portraits?.[Emotion.NEUTRAL] || undefined,
              time: timelineEntry.time,
              statement: timelineEntry.statement
            });
          }
        }

        return {
          ...prev,
          chatHistory: { ...prev.chatHistory, [currentSuspectId]: updatedHistory },
          aggravationLevels: { ...prev.aggravationLevels, [currentSuspectId]: newAgg },
          suspectEmotions: { ...prev.suspectEmotions, [currentSuspectId]: response.emotion },
          timelineStatementsDiscovered: newTimelineStatements,
          // PERSIST SUGGESTIONS PER SUSPECT
          suspectSuggestions: { ...prev.suspectSuggestions, [currentSuspectId]: response.hints }
        };
      });

      // Mark suspect as having unread message (badge appears when user switches away)
      setUnreadSuspects(prev => new Set(prev).add(currentSuspectId));
      // TTS playback is handled by Interrogation.tsx

      setCurrentSuggestions(response.hints);
    } catch (e: any) {
      console.error("AI Generation Error:", e);
      setGameState(prev => ({
        ...prev,
        chatHistory: {
           ...prev.chatHistory,
           [currentSuspectId]: [
             ...(prev.chatHistory[currentSuspectId] || []),
             { sender: 'system', text: "[ERROR] Uplink Interrupted. Please retransmit.", timestamp: new Date(newGameTime).toLocaleTimeString() }
           ]
        }
      }));
    } finally {
      setThinkingSuspectId(null);
    }
  };

  const handleSendOfficerMessage = async (text: string) => {
    if (gameState.officerHintsRemaining <= 0 || !gameState.selectedCaseId) return;
    
    // Officer chat also advances time, though maybe less? Let's stick to consistent 5 mins for simplicity
    const newGameTime = gameState.gameTime + TIME_INCREMENT_MS;

    const userMsg: ChatMessage = { sender: 'player', text, timestamp: new Date(newGameTime).toLocaleTimeString() };
    setGameState(prev => ({
      ...prev,
      gameTime: newGameTime,
      officerHistory: [...prev.officerHistory, userMsg],
      officerHintsRemaining: prev.officerHintsRemaining - 1
    }));

    setThinkingSuspectId('__officer__');
    
    try {
      const currentCase = findCaseById(gameState.selectedCaseId)!;
      
      const responseText = await getOfficerChatResponse(
        currentCase, 
        text, 
        gameState.evidenceDiscovered, 
        gameState.notes,
        gameState.chatHistory 
      );
      

      
      const officerMsg: ChatMessage = { sender: 'officer', text: responseText, timestamp: new Date(newGameTime).toLocaleTimeString() };
      
      setGameState(prev => ({
        ...prev,
        officerHistory: [...prev.officerHistory, officerMsg]
      }));
    } catch (e: any) {
      console.error("Officer Chat Error:", e);
      setGameState(prev => ({
        ...prev,
        officerHistory: [...prev.officerHistory, { sender: 'system', text: "[SECURE LINE DISCONNECTED]", timestamp: new Date(newGameTime).toLocaleTimeString() }]
      }));
    } finally {
      setThinkingSuspectId(null);
    }
  };

  const handleGenerateCase = async (prompt: string, isLucky: boolean) => {
    // CRITICAL: User must be logged in to create a case (enforced by login gate)
    if (!user?.uid) {
        console.error('[CRITICAL] handleGenerateCase: No user logged in!');
        toast.error('You must be logged in to create a case.');
        return;
    }
    
    setIsGenerating(true);
    setGenerationStatus("Creating criminal profiles...");
    try {
        const newCase = await generateCaseFromPrompt(prompt, isLucky);
        // CRITICAL: Always stamp creator identity — never optional
        newCase.authorId = user.uid;
        newCase.authorDisplayName = formatAuthorName(user.displayName);
        newCase.createdAt = Date.now();
        setGenerationStatus("Generating suspect portraits and evidence... (0%)");
        await pregenerateCaseImages(newCase, (msg) => setGenerationStatus(msg), user.uid);
        setGenerationStatus("");
        
        // Save as local draft
        saveLocalDraft(newCase);
        setLocalDrafts(fetchLocalDrafts());
        
        // Open edit screen first
        setDraftCase(newCase);
        setGameState(prev => ({ ...prev, currentScreen: ScreenState.CASE_REVIEW }));
    } catch (e: any) {
        console.error("Generation Error:", e);
        toast.error(`Case generation failed: ${e.message || 'Unknown error'}`);
    } finally {
        setIsGenerating(false);
        setGenerationStatus("");
    }
  };

  const handleSaveAndStart = async () => {
    if (!draftCase) return;
    
    // CRITICAL: Enforce author identity on every save
    if (!user?.uid) {
        console.error('[CRITICAL] handleSaveAndStart: No user logged in!');
        toast.error('You must be logged in to save a case.');
        return;
    }
    
    // Always stamp author info from the CURRENT user — never trust what's on the draft alone
    const stamped: CaseData = {
      ...draftCase,
      authorId: user.uid,
      authorDisplayName: draftCase.authorDisplayName && draftCase.authorDisplayName !== 'Anonymous' && draftCase.authorDisplayName !== 'Unknown Author'
        ? draftCase.authorDisplayName
        : formatAuthorName(user.displayName),
      createdAt: draftCase.createdAt || Date.now()
    };

    if (stamped.isUploaded) {
        // Persist the edit to the server (case is already published)
        const success = await updateCase(stamped.id, stamped);
        if (!success) {
            toast.error('Failed to save changes to the server.');
            return;
        }
        // Fetch updated case to get the new version number
        await loadCommunity();
        const updatedCase = communityCases.find(c => c.id === stamped.id) || stamped;
        selectCase(updatedCase);
    } else {
        // Save to Firebase (private, not published) AND locally
        saveLocalDraft(stamped);
        setLocalDrafts(fetchLocalDrafts());
        // Also persist to Firebase so it's not lost if localStorage clears
        await updateCase(stamped.id, stamped);
        setCommunityCases(prev => {
            if (!stamped.id || !stamped.title) return prev;
            const exists = prev.some(c => c.id === stamped.id);
            if (exists) return prev.map(c => c.id === stamped.id ? stamped : c);
            return [stamped, ...prev];
        });
        selectCase(stamped);
    }
    setDraftCase(null);
  };

  // Test Investigation: starts the case without saving
  const handleTestInvestigation = () => {
    if (draftCase) {
      selectCase(draftCase);
      // Don't clear draftCase — user can return to editing
    }
  };

  // App-level save for when CaseReview is unmounted (e.g., during gameplay testing)
  const handleSaveDraftFromHeader = async () => {
    if (!draftCase) return;
    
    // CRITICAL: Always stamp authorId before any save
    if (!user?.uid) {
      console.error('[CRITICAL] handleSaveDraftFromHeader: No user logged in!');
      toast.error('You must be logged in to save.');
      return;
    }
    
    const stamped: CaseData = {
      ...draftCase,
      authorId: user.uid,
      authorDisplayName: draftCase.authorDisplayName && draftCase.authorDisplayName !== 'Anonymous' && draftCase.authorDisplayName !== 'Unknown Author'
        ? draftCase.authorDisplayName
        : formatAuthorName(user.displayName),
    };
    
    const { updateCase: doUpdate, saveLocalDraft: doSaveLocal } = await import('./services/persistence');
    // Always save locally as a safety net
    doSaveLocal(stamped);
    // Also persist to Firebase
    const success = await doUpdate(stamped.id, stamped);
    setDraftCase(stamped); // Keep stamped version in state
    setHasUnsavedDraftChanges(false);
    if (success) {
      toast.success('Case saved successfully!');
    } else {
      toast.error('Firebase save failed — saved locally as fallback.');
    }
  };

  const handleEditCase = (caseId?: string | any) => {
    const idToEdit = (typeof caseId === 'string') ? caseId : gameState.selectedCaseId;
    const caseToEdit = communityCases.find(c => c.id === idToEdit) || localDrafts.find(d => d.id === idToEdit);
    if (!caseToEdit) return;

    setDraftCase(caseToEdit);
    setGameState(prev => ({ ...prev, currentScreen: ScreenState.CASE_REVIEW }));
  };

  const initiatePublish = () => {
    if (!gameState.selectedCaseId) return;
    setShowPublishConfirm(true);
  };

  const executePublish = async () => {
    setShowPublishConfirm(false); 
    if (!gameState.selectedCaseId || !user?.uid) return;
    const caseToPublish = communityCases.find(c => c.id === gameState.selectedCaseId);
    if (!caseToPublish) return;

    setIsPublishing(true);
    const success = await publishCase(
      { ...caseToPublish, isUploaded: true, authorId: user.uid }, 
      user.uid, 
      formatAuthorName(user.displayName)
    );
    
    if (success) {
      // Remove from local drafts since it's now published
      deleteLocalDraft(caseToPublish.id);
      setLocalDrafts(fetchLocalDrafts());
      // Re-fetch to get the version and authorId
      await loadCommunity();
    }
    setIsPublishing(false);
  };

  const collectEvidence = (msgIndex: number, rawEvidenceString: string, suspectId: string) => {
    setGameState(prev => {
      const history = [...(prev.chatHistory[suspectId] || [])];
      if (history[msgIndex]) {
        history[msgIndex] = { ...history[msgIndex], isEvidenceCollected: true };
      }
      
      const currentCase = findCaseById(prev.selectedCaseId);
      if (!currentCase) return prev;

      // PARSE STRING: Support "Title: Description" format from AI
      let parsedTitle = rawEvidenceString;
      let parsedDesc = `Evidence discovered from ${currentCase.suspects.find(s=>s.id===suspectId)?.name || 'Unknown'}.`;
      
      if (rawEvidenceString.includes(':')) {
          const parts = rawEvidenceString.split(':');
          parsedTitle = parts[0].trim();
          if (parts.length > 1 && parts[1].trim().length > 0) {
             parsedDesc = parts.slice(1).join(':').trim();
          }
      }

      // Find actual Evidence object in known lists
      let foundEvidence: Evidence | undefined;
      
      // Check Hidden Evidence for Suspects
      const suspect = currentCase.suspects.find(s => s.id === suspectId);
      if (suspect) {
          foundEvidence = suspect.hiddenEvidence.find(e => 
              e.title.toLowerCase() === parsedTitle.toLowerCase() || 
              parsedTitle.toLowerCase().includes(e.title.toLowerCase())
          );
      }
      
      // Fallback: Check Initial Evidence
      if (!foundEvidence) {
          foundEvidence = currentCase.initialEvidence.find(e => 
            e.title.toLowerCase() === parsedTitle.toLowerCase()
          );
      }

      // If not found (AI hallucinated new item), create entry with parsed title/desc
      if (!foundEvidence) {
          foundEvidence = {
              id: `discovered-${Date.now()}`,
              title: parsedTitle,
              description: parsedDesc, // Uses parsed description from AI or generic fallback
              imageUrl: undefined
          };
      }

      const alreadyHas = prev.evidenceDiscovered.some(e => e.title === foundEvidence!.title);
      
      return {
        ...prev,
        chatHistory: { ...prev.chatHistory, [suspectId]: history },
        evidenceDiscovered: alreadyHas ? prev.evidenceDiscovered : [...prev.evidenceDiscovered, foundEvidence!]
      };
    });
  };

  const handleForceEvidence = (suspectId: string, evidenceTitle: string) => {
    const msg: ChatMessage = {
      sender: 'suspect',
      text: "[DEBUG FORCE] Okay, fine! I'll tell you about this.",
      timestamp: new Date(gameState.gameTime).toLocaleTimeString(),
      evidence: evidenceTitle,
      isEvidenceCollected: false
    };
    
    setGameState(prev => ({
      ...prev,
      chatHistory: {
        ...prev.chatHistory,
        [suspectId]: [...(prev.chatHistory[suspectId] || []), msg]
      }
    }));
  };

  const makeAccusation = async (suspectIds: string[]) => {
    const currentCase = findCaseById(gameState.selectedCaseId)!;
    
    const guiltySuspectIds = currentCase.suspects.filter(s => s.isGuilty).map(s => s.id);
    const accusedGuiltyIds = suspectIds.filter(id => guiltySuspectIds.includes(id));
    const accusedInnocentIds = suspectIds.filter(id => !guiltySuspectIds.includes(id));

    let result: 'SUCCESS' | 'PARTIAL' | 'FAILURE';
    if (accusedGuiltyIds.length === guiltySuspectIds.length && accusedInnocentIds.length === 0) {
        result = 'SUCCESS';
    } else if (accusedGuiltyIds.length > 0) {
        result = 'PARTIAL';
    } else {
        result = 'FAILURE';
    }

    setHasRecordedResult(false);

    setGameState(prev => ({
      ...prev,
      gameResult: result,
      accusedSuspectIds: suspectIds,
      currentScreen: ScreenState.ENDGAME
    }));

    // Record result & fetch stats for endgame display
    const suspectsSpoken = Object.keys(gameState.chatHistory).filter(
      sid => (gameState.chatHistory[sid] || []).some(m => m.sender === 'player')
    ).length;
    const evidenceFound = gameState.evidenceDiscovered.length;
    const timelineFound = gameState.timelineStatementsDiscovered.length;

    if (currentCase.isUploaded) {
      await recordGameResult(currentCase.id, result, { evidenceFound, suspectsSpoken, timelineFound });
      const [stats, vote] = await Promise.all([
        fetchCaseStats(currentCase.id),
        user ? fetchUserVote(currentCase.id, user.uid) : Promise.resolve(null)
      ]);
      setCurrentCaseStats(stats);
      setCurrentUserVote(vote);
      // Refresh global stats too
      const allStats = await fetchAllCaseStats();
      setAllCaseStats(allStats);
    }
    setHasRecordedResult(true);
  };

  const handleVote = async (vote: 'up' | 'down') => {
    if (!user || !gameState.selectedCaseId) return;
    await submitVote(gameState.selectedCaseId, user.uid, vote);
    setCurrentUserVote(vote);
    const stats = await fetchCaseStats(gameState.selectedCaseId);
    setCurrentCaseStats(stats);
    setAllCaseStats(prev => ({ ...prev, [gameState.selectedCaseId!]: stats }));
  };

  const handlePublishDraft = async (caseId: string) => {
    if (!user?.uid) {
      toast.error('You must be logged in to publish.');
      return;
    }
    // Check both local drafts and community cases
    const draft = localDrafts.find(d => d.id === caseId) || communityCases.find(c => c.id === caseId);
    if (!draft) return;
    setIsPublishing(true);
    const success = await publishCase(
      { ...draft, isUploaded: true, authorId: user.uid },
      user.uid,
      formatAuthorName(user.displayName)
    );
    if (success) {
      deleteLocalDraft(caseId);
      setLocalDrafts(fetchLocalDrafts());
      await loadCommunity();
    }
    setIsPublishing(false);
  };

  const handleUnpublishCase = async (caseId: string) => {
    const caseToUnpublish = communityCases.find(c => c.id === caseId);
    if (!caseToUnpublish) return;
    // Save to local drafts first, then remove from server
    saveLocalDraft({ ...caseToUnpublish, isUploaded: false });
    setLocalDrafts(fetchLocalDrafts());
    const success = await deleteCase(caseId);
    if (success) {
      await loadCommunity();
    }
  };

  const handleDeleteDraft = (caseId: string) => {
    deleteLocalDraft(caseId);
    setLocalDrafts(fetchLocalDrafts());
  };

  const handlePlayDraft = (caseData: CaseData) => {
    // Add draft to communityCases temporarily so selectCase can find it
    setCommunityCases(prev => {
      const exists = prev.some(c => c.id === caseData.id);
      return exists ? prev : [caseData, ...prev];
    });
    selectCase(caseData);
  };

  const resetGame = () => {
    setGameState({
      ...gameState, 
      currentScreen: ScreenState.CASE_SELECTION, 
      selectedCaseId: null, 
      gameResult: null 
    });
  };

  const navigateTo = (screen: ScreenState) => {
    if (screen === ScreenState.CASE_SELECTION) {
       resetGame();
       return;
    }
    setGameState(prev => ({ ...prev, currentScreen: screen }));
  };

  const [caseToDelete, setCaseToDelete] = useState<string | null>(null);
  const [myCaseToDelete, setMyCaseToDelete] = useState<string | null>(null);

  const handleDeleteCase = async (caseId: string) => {
    if (!isAdmin) return;
    setCaseToDelete(caseId);
  };

  const handleDeleteMyCase = (caseId: string) => {
    setMyCaseToDelete(caseId);
  };

  const confirmDeleteMyCase = async () => {
    if (!myCaseToDelete) return;
    // Delete from Firebase if published
    const isPublished = communityCases.some(c => c.id === myCaseToDelete && c.isUploaded);
    if (isPublished) {
      await deleteCase(myCaseToDelete);
    }
    // Delete from local drafts
    deleteLocalDraft(myCaseToDelete);
    setLocalDrafts(fetchLocalDrafts());
    setCommunityCases(prev => prev.filter(c => c.id !== myCaseToDelete));
    setMyCaseToDelete(null);
  };

  const confirmDeleteCase = async () => {
    if (!caseToDelete || !isAdmin) return;
    const success = await deleteCase(caseToDelete);
    if (success) {
      setCommunityCases(prev => prev.filter(c => c.id !== caseToDelete));
    }
    setCaseToDelete(null);
  };

  const handleToggleFeatured = async (caseId: string, isFeatured: boolean) => {
    if (!isAdmin) return;
    const targetCase = communityCases.find(c => c.id === caseId);
    const authorId = targetCase?.authorId || user?.uid;
    if (!authorId) return;
    const success = await updateCase(caseId, { isFeatured, authorId });
    if (success) {
      setCommunityCases(prev => prev.map(c => c.id === caseId ? { ...c, isFeatured } : c));
    }
  };

  const currentCase = gameState.selectedCaseId 
    ? findCaseById(gameState.selectedCaseId)
    : undefined;
  
  const isGameplay = 
    gameState.currentScreen === ScreenState.CASE_HUB || 
    gameState.currentScreen === ScreenState.INTERROGATION || 
    gameState.currentScreen === ScreenState.ACCUSATION ||
    gameState.currentScreen === ScreenState.ENDGAME;

  const isCustomCase = currentCase?.id.startsWith('custom-');
  const isNetworkCase = communityCases.some(c => c.id === currentCase?.id && c.isUploaded);
  const isCreator = currentCase?.authorId === user?.uid;

  const canPublish = !!(isCustomCase && !currentCase?.isUploaded && isGameplay && gameState.currentScreen !== ScreenState.ENDGAME);
  const canEdit = !!(isCustomCase && (isAdmin || isCreator) && isGameplay && gameState.currentScreen !== ScreenState.ENDGAME);

  if (authLoading) {
    return (
      <Layout screenState={gameState.currentScreen} isMuted={isMuted} onToggleMute={() => setIsMuted(!isMuted)} onNavigate={() => {}} isBooting>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#0f0' }}>
          INITIALIZING SECURE CONNECTION...
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout screenState={gameState.currentScreen} isMuted={isMuted} onToggleMute={() => setIsMuted(!isMuted)} onNavigate={() => {}} isBooting>
        <Login />
      </Layout>
    );
  }

  return (
    <>
    <Layout 
      screenState={gameState.currentScreen}
      caseTitle={currentCase?.title}
      onNavigate={navigateTo}
      isMuted={isMuted}
      onToggleMute={() => setIsMuted(!isMuted)}
      volume={volume}
      onVolumeChange={setVolume}
      onPublish={initiatePublish}
      canPublish={canPublish}
      isPublishing={isPublishing}
      onEdit={handleEditCase}
      canEdit={canEdit}
      isBooting={!hasBooted}
      powerState={powerState}
      mobileAction={gameState.currentScreen === ScreenState.INTERROGATION ? {
        label: mobileIntelOpen ? 'CLOSE' : 'OPEN INTEL',
        onClick: () => setMobileIntelOpen(!mobileIntelOpen),
        active: mobileIntelOpen
      } : undefined}
      user={user}
      onLogout={logout}
      hasUnsavedChanges={hasUnsavedDraftChanges}
      onSaveCase={() => {
        if (draftSaveFnRef.current && gameState.currentScreen === ScreenState.CASE_REVIEW) {
          draftSaveFnRef.current();
        } else {
          handleSaveDraftFromHeader();
        }
      }}
      onCloseCase={gameState.currentScreen === ScreenState.CASE_REVIEW ? () => {
        draftCloseFnRef.current?.();
      } : undefined}
      onCheckConsistency={gameState.currentScreen === ScreenState.CASE_REVIEW ? () => {
        draftCheckConsistencyFnRef.current?.();
      } : undefined}
      onTestInvestigation={gameState.currentScreen === ScreenState.CASE_REVIEW ? handleTestInvestigation : undefined}
    >
      {!hasBooted ? (
        <BootSequence onComplete={handleBootComplete} />
      ) : (
        <>
          {gameState.currentScreen === ScreenState.CASE_SELECTION && (
            <CaseSelection 
                key="screen-selection"
                communityCases={communityCases}
                localDrafts={localDrafts}
                caseStats={allCaseStats}
                isLoadingCommunity={loadingCommunity}
                onSelectCase={selectCase} 
                onCreateNew={() => setGameState(prev => ({ ...prev, currentScreen: ScreenState.CREATE_CASE }))}
                isAdmin={isAdmin}
                userId={user?.uid}
                onDeleteCase={handleDeleteCase}
                onToggleFeatured={handleToggleFeatured}
                onEditCase={handleEditCase}
                onPublishDraft={handlePublishDraft}
                onDeleteDraft={handleDeleteDraft}
                onPlayDraft={handlePlayDraft}
                onUnpublish={handleUnpublishCase}
                onDeleteMyCase={handleDeleteMyCase}
            />
          )}

          {gameState.currentScreen === ScreenState.CREATE_CASE && (
            <CreateCase 
                key="screen-create"
                onGenerate={handleGenerateCase}
                onCancel={() => setGameState(prev => ({ ...prev, currentScreen: ScreenState.CASE_SELECTION }))}
                isLoading={isGenerating}
                loadingStatus={generationStatus}
            />
          )}

          {gameState.currentScreen === ScreenState.CASE_REVIEW && draftCase && (
            <CaseReview 
                key="screen-review"
                draftCase={draftCase}
                onUpdateDraft={(updated) => {
                    const withDiff = { ...updated, difficulty: calculateDifficulty(updated) };
                    setDraftCase(withDiff);
                }}
                onStart={handleTestInvestigation}
                onCancel={() => {
                    setDraftCase(null);
                    setHasUnsavedDraftChanges(false);
                    setGameState(prev => ({ ...prev, currentScreen: ScreenState.CASE_SELECTION }));
                }}
                userId={user?.uid}
                userDisplayName={formatAuthorName(user?.displayName)}
                onRegisterSave={(fn) => { draftSaveFnRef.current = fn; }}
                onRegisterCheckConsistency={(fn) => { draftCheckConsistencyFnRef.current = fn; }}
                onRegisterClose={(fn) => { draftCloseFnRef.current = fn; }}
                onHasUnsavedChanges={setHasUnsavedDraftChanges}
            />
          )}

          {gameState.currentScreen === ScreenState.CASE_HUB && currentCase && (
            <CaseHub 
              key="screen-hub"
              caseData={currentCase} 
              evidenceDiscovered={gameState.evidenceDiscovered}
              timelineStatements={gameState.timelineStatementsDiscovered}
              notes={gameState.notes}
              officerHintsRemaining={gameState.officerHintsRemaining}
              officerHistory={gameState.officerHistory}
              isThinking={thinkingSuspectId === '__officer__'}
              onStartInterrogation={startInterrogation}
              onNavigate={navigateTo}
              onSendOfficerMessage={handleSendOfficerMessage}
              unreadSuspectIds={unreadSuspects}
            />
          )}

          {gameState.currentScreen === ScreenState.INTERROGATION && currentCase && gameState.currentSuspectId && (
            <Interrogation 
              key="screen-interrogation"
              activeCase={currentCase}
              suspect={currentCase.suspects.find(s => s.id === gameState.currentSuspectId)!}
              chatHistory={gameState.chatHistory[gameState.currentSuspectId] || []}
              aggravationLevel={gameState.aggravationLevels[gameState.currentSuspectId] || 0}
              emotion={gameState.suspectEmotions[gameState.currentSuspectId] || Emotion.NEUTRAL}
              partnerEmotion={gameState.partnerEmotion}
              suspectTurnIds={gameState.suspectTurnIds}
              evidenceDiscovered={gameState.evidenceDiscovered}
              timelineStatementsDiscovered={gameState.timelineStatementsDiscovered}
              suggestions={currentSuggestions}
              isThinking={thinkingSuspectId === gameState.currentSuspectId}
              sidekickComment={gameState.sidekickComment}
              partnerCharges={gameState.partnerCharges}
              gameTime={gameState.gameTime}
              soundEnabled={!isMuted}
              volume={volume}
              onSendMessage={handleSendMessage}
              onCollectEvidence={collectEvidence}
              onSwitchSuspect={startInterrogation}
              onForceEvidence={handleForceEvidence}
              onPartnerAction={handlePartnerAction}
              mobileIntelOpen={mobileIntelOpen}
              isAdmin={isAdmin}
              userId={user?.uid}
              unreadSuspectIds={unreadSuspects}
              onClearUnread={(suspectId) => {
                setUnreadSuspects(prev => {
                  const next = new Set(prev);
                  next.delete(suspectId);
                  return next;
                });
              }}
            />
          )}

          {gameState.currentScreen === ScreenState.ACCUSATION && currentCase && (
            <Accusation 
              key="screen-accusation"
              suspects={currentCase.suspects} 
              onAccuse={makeAccusation}
              onBack={() => navigateTo(ScreenState.CASE_HUB)}
            />
          )}

          {gameState.currentScreen === ScreenState.ENDGAME && currentCase && (
            <EndGame 
              key="screen-endgame"
              gameResult={gameState.gameResult} 
              caseData={currentCase}
              accusedIds={gameState.accusedSuspectIds}
              evidenceDiscovered={gameState.evidenceDiscovered}
              onReset={resetGame}
              caseStats={currentCaseStats}
              userVote={currentUserVote}
              onVote={handleVote}
              suspectsSpoken={Object.keys(gameState.chatHistory).filter(
                sid => (gameState.chatHistory[sid] || []).some(m => m.sender === 'player')
              ).length}
              timelineFound={gameState.timelineStatementsDiscovered.length}
            />
          )}
        </>
      )}

      {showPublishConfirm && (
        <Overlay>
          <ConfirmBox>
            <WarningTitle>⚠ WARNING ⚠</WarningTitle>
            <WarningText>
              Uploading this case to the Network will make it <strong>PUBLICLY AVAILABLE</strong>.
            </WarningText>
            <ButtonRow>
              <ModalButton $variant="cancel" onClick={() => setShowPublishConfirm(false)}>
                [ Cancel ]
              </ModalButton>
              <ModalButton $variant="confirm" onClick={executePublish}>
                [ CONFIRM UPLOAD ]
              </ModalButton>
            </ButtonRow>
          </ConfirmBox>
        </Overlay>
      )}

      {caseToDelete && (
        <Overlay>
          <ConfirmBox>
            <WarningTitle>⚠ DELETE CASE ⚠</WarningTitle>
            <WarningText>
              Are you sure you want to delete this case permanently? This action cannot be undone.
            </WarningText>
            <ButtonRow>
              <ModalButton $variant="cancel" onClick={() => setCaseToDelete(null)}>
                [ Cancel ]
              </ModalButton>
              <ModalButton $variant="confirm" onClick={confirmDeleteCase}>
                [ DELETE ]
              </ModalButton>
            </ButtonRow>
          </ConfirmBox>
        </Overlay>
      )}

      {myCaseToDelete && (
        <Overlay>
          <ConfirmBox>
            <WarningTitle>⚠ DELETE CASE ⚠</WarningTitle>
            <WarningText>
              Are you sure you want to permanently delete this case? If it's published, it will also be removed from the Network. <strong>This cannot be undone.</strong>
            </WarningText>
            <ButtonRow>
              <ModalButton $variant="cancel" onClick={() => setMyCaseToDelete(null)}>
                [ Cancel ]
              </ModalButton>
              <ModalButton $variant="confirm" onClick={confirmDeleteMyCase}>
                [ DELETE PERMANENTLY ]
              </ModalButton>
            </ButtonRow>
          </ConfirmBox>
        </Overlay>
      )}
      <OnboardingTour />
    </Layout>
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#111',
          color: '#0f0',
          border: '1px solid #333',
          fontFamily: "'VT323', monospace",
          fontSize: '1rem',
          boxShadow: '0 0 15px rgba(0,255,0,0.1)',
        },
        success: {
          iconTheme: { primary: '#0f0', secondary: '#111' },
          duration: 3000,
        },
        error: {
          style: { color: '#f55', borderColor: '#500' },
          iconTheme: { primary: '#f55', secondary: '#111' },
          duration: 6000,
        },
      }}
    />
    </>
  );
};

export default App;
