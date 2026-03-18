
export enum ScreenState {
  CASE_SELECTION = 'CASE_SELECTION',
  CREATE_CASE = 'CREATE_CASE',
  CASE_REVIEW = 'CASE_REVIEW',
  CASE_HUB = 'CASE_HUB',
  INTERROGATION = 'INTERROGATION',
  ACCUSATION = 'ACCUSATION',
  ENDGAME = 'ENDGAME'
}

export enum Emotion {
  NEUTRAL = 'NEUTRAL',
  ANGRY = 'ANGRY',
  SAD = 'SAD',
  NERVOUS = 'NERVOUS',
  HAPPY = 'HAPPY',
  SURPRISED = 'SURPRISED',
  SLY = 'SLY',
  CONTENT = 'CONTENT',
  DEFENSIVE = 'DEFENSIVE',
  ARROGANT = 'ARROGANT',
  // Special States for Deceased Victims (Views)
  HEAD = 'HEAD',
  TORSO = 'TORSO',
  HANDS = 'HANDS',
  LEGS = 'LEGS'
}

export interface Evidence {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
}

export interface Alibi {
  statement: string; // The text they say
  isTrue: boolean;
  location: string;
  witnesses: string[];
}

export interface Relationship {
  targetName: string; // The name of the other person
  type: string; // e.g. "Brother", "Rival", "Lover"
  description: string; // How they feel about them
}

export interface TimelineEvent {
  time: string; // e.g. "8:00 PM"
  activity: string; // "I was eating dinner"
  day: string; // e.g. "Today", "Yesterday", "2 Days Ago", "Last Week"
  dayOffset: number; // 0 = today (day of questioning), -1 = yesterday, -2 = 2 days ago, etc.
}

export interface Suspect {
  id: string;
  name: string;
  gender: string; // New field for robust image generation
  age: number;
  bio: string;
  role: string; // e.g., "The Victim's Brother"
  personality: string; // Defines how they react to manners/aggression
  avatarSeed: number; // For picsum/dicebear
  baseAggravation: number;
  isGuilty: boolean;
  secret: string;
  physicalDescription?: string; // Short visual description for image generation
  isDeceased?: boolean; // New: Marks if this is the victim's body
  
  // --- ROBUST KNOWLEDGE BASE (Prevents Hallucinations) ---
  alibi: Alibi;
  motive: string;
  relationships: Relationship[];
  timeline: TimelineEvent[];
  knownFacts: string[]; // Specific true facts they know about the case
  professionalBackground: string; // Skills they have
  witnessObservations: string; // What they specifically saw regarding the crime
  
  hiddenEvidence: Evidence[]; // Evidence they possess and might reveal
  portraits?: Record<string, string>; // Pre-generated portraits
  voice?: string; // TTS Voice Name
}

export interface SupportCharacter {
  id: string; // Added ID for consistency
  name: string;
  gender: string;
  role: string;
  personality: string;
  avatarSeed: number;
  portraits?: Record<string, string>;
  voice?: string;
}

export interface CaseData {
  id: string;
  title: string;
  type: string; // Murder, Larceny, etc.
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  suspects: Suspect[];
  initialEvidence: Evidence[];
  initialTimeline: TimelineEvent[]; // Known facts about the timeline at start
  officer: SupportCharacter; // The hint giver
  partner: SupportCharacter; // The intervention character
  startTime?: string; // ISO datetime string for investigation start (e.g. "2030-09-12T23:30")
  isUploaded?: boolean; // Tracks if this custom case has been published
  isFeatured?: boolean; // New: Tracks if this case is featured by admin
  heroImageUrl?: string; // New: Image for the case card
  version?: number; // New: Tracks the version of the case
  authorId?: string; // New: Tracks the UID of the user who created the case
  authorDisplayName?: string; // Display name from Google Auth
  createdAt?: number; // Epoch timestamp for when the case was first created
  updatedAt?: number; // Epoch timestamp for when the case was last edited
  hasVictim?: boolean; // Whether the crime has a victim (auto-set by AI during creation/edit/consistency)
}

export interface CaseStats {
  plays: number;
  successes: number;
  failures: number;
  upvotes: number;
  downvotes: number;
  totalEvidenceFound: number;
  totalSuspectsSpoken: number;
  totalTimelineFound: number;
}

export interface UserVote {
  caseId: string;
  vote: 'up' | 'down';
}

export interface ChatMessage {
  sender: 'player' | 'suspect' | 'officer' | 'partner' | 'system';
  text: string;
  timestamp: string;
  type?: 'talk' | 'action'; // New field: is this dialogue or a physical action?
  attachment?: string | null; // Title of evidence shown
  evidence?: string | null; // Title of evidence revealed BY THE SUSPECT
  isEvidenceCollected?: boolean; // Has the player clicked it?
  audioUrl?: string | null;
}

export interface TimelineStatement {
  id: string;
  suspectId: string;
  suspectName: string;
  suspectPortrait?: string;
  time: string;
  statement: string;
  day: string; // e.g. "Today", "Yesterday", "2 Days Ago"
  dayOffset: number; // 0 = today (day of questioning), -1 = yesterday, -2 = 2 days ago, etc.
}

export interface GameState {
  currentScreen: ScreenState;
  selectedCaseId: string | null;
  currentSuspectId: string | null;
  aggravationLevels: Record<string, number>; // suspectId -> 0-100
  notes: Record<string, string[]>; // suspectId -> notes list
  evidenceDiscovered: Evidence[];
  timelineStatementsDiscovered: TimelineStatement[];
  chatHistory: Record<string, ChatMessage[]>;
  officerHistory: ChatMessage[];
  suspectEmotions: Record<string, Emotion>;
  partnerEmotion: Emotion; // New: Tracks the partner's current reaction
  suspectTurnIds: Record<string, string | undefined>; // suspectId -> unique ID for current portrait state, or undefined for base
  gameResult: 'SUCCESS' | 'PARTIAL' | 'FAILURE' | null;
  accusedSuspectIds: string[]; // Track who was accused
  officerHintsRemaining: number; // Used as "Patience" or "Battery" for the officer chat
  currentOfficerHint: string | null;
  sidekickComment: string | null; // The result text of the partner's action
  partnerCharges: number; // 3 charges per game
  
  // Time System
  gameTime: number; // JS Timestamp
  lastInteractionTimes: Record<string, number>; // suspectId -> last timestamp they were spoken to
  
  // Suggestions (Hints) - Persisted per suspect so they don't leak/reset incorrectly
  suspectSuggestions: Record<string, (string | { label: string; text: string })[]>;
}
