import { ConversationStyle, TranscriptEntry, ConversationRequest, Persona } from "../../client/src/types/data";
import * as fs from 'fs';

/**
 * Audio buffer to be sent to the client
 */
export interface AudioBuffer {
    personaId: string;
    transcriptionId: string;
    buffer: Buffer;
    mediaType: string;
}

/**
 * Conversation session interface
 */
export interface ConversationSession {
    id: string;
    listener: ConversationSessionListener | undefined;
    request: ConversationRequest;
    mediaType: string;
    start(): Promise<void>;
    close(): Promise<void>;
    stop(): Promise<void>;
}

/**
 * Conversation session listener interface
 */
export interface ConversationSessionListener {
    onTranscriptEntry(entry: TranscriptEntry): void;
    onAudioBuffer(audioBuffer: AudioBuffer): void;
    onError(error: string): void;
    onSessionEnd(): void;
    onSessionStart(): void;
}

if (!process.env.STYLES) {
    throw new Error('STYLES env variable is not set. Please check your .env file.');
}

const styles: ConversationStyle[] = JSON.parse(fs.readFileSync(process.env.STYLES, 'utf8'));

export function getStyleById(id: string): ConversationStyle | undefined {
    return styles.find(style => style.id === id);
}

export function getStyles(): ConversationStyle[] {
    return styles;
}

/**
 * Session listener interface
 */
export interface SessionListener {
    onTranscriptEntry(session: LiveSession, entry: TranscriptEntry): void;
    onAudioBuffer(session: LiveSession, audioBuffer: AudioBuffer): void;
    onError(session: LiveSession, error: string): void;
    onSessionEnd(session: LiveSession): void;
    onSessionStart(session: LiveSession): void;
    onTurnComplete(session: LiveSession): void;
}

/**
 * Live session class for realtime models implementation like Gemini, OpenAI Realtime, etc
 */
export class LiveSession {
    persona: Persona | undefined; // Persona
    listener: SessionListener | undefined;
    systemInstruction: string | undefined; // System instruction
    constructor(persona: Persona | undefined, systemInstruction: string | undefined = undefined) {
        this.persona = persona;
        this.systemInstruction = systemInstruction;
    }

    async start() {
        
    }

    async close() {

    }

    async sendMessage(message: string) {

    }

    async sendAudio(audioBuffer: AudioBuffer) {

    }

    async flushAudio() {

    }

}