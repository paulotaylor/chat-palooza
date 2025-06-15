import { ConversationStyle, TranscriptEntry, ConversationRequest } from "../../client/src/types/data";
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
