import { Timestamp } from "firebase/firestore";

export interface Persona {
  id: string;
  name: string;
  description: string;
  category: string;
  avatar_url: string;
  voice?: string;
  speech?: string;
  hidden?: boolean;
  personality_traits?: string[];
  speaking_style?: string;
  conversation_strengths?: string[];
}

export interface ConversationStyle {
  id: string;
  name: string;
  description: string;
}

export interface TranscriptEntry {
    speakerId: string;
    text: string;
    timestamp: number;
    id: string;
};

export interface ConversationRequest {
  personas: Persona[];
  topic: string;
  style: ConversationStyle;
}

export interface PaloozaConversation {
  id: string;
  userId: string;
  topic: string;
  personas: string[];
  style: ConversationStyle;
  audio_url: string;
  transcript: TranscriptEntry[];
  created_at: Timestamp;
  upvotes: number;
  downvotes: number;
  isStarred: boolean;
  summary: string | undefined;
}