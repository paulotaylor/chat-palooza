import { ConversationSession, ConversationSessionListener, AudioBuffer, SessionListener, LiveSession } from "./conversation";
import { GenerateContentConfig, GenerationConfig, GoogleGenAI, LiveConnectConfig, LiveServerMessage, Modality, Session, Type } from '@google/genai';
import { getSystemInstructions, resamplePCM16 } from "./utils";
import { Persona, TranscriptEntry, ConversationRequest } from "../../client/src/types/data";
import * as crypto from 'crypto';

const ADVANCED_VOICES_MALE = ['Orus', 'Puck', 'Charon', 'Fenrir', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Rasalgethi', 'Alnilam', 'Schedar', 'Achird', 'Zubenelgenubi', 'Sadachbia', 'Sadaltager'];
const ADVANCED_VOICES_FEMALE = ['Aoede', 'Leda', 'Zephyr', 'Kore', 'Callirrhoe', 'Autonoe', 'Despina', 'Erinome', 'Laomedeia', 'Achernar', 'Gacrux', 'Pulcherrima', 'Vindemiatrix', 'Sulafat'];
const VOICES_MALE = ['Orus', 'Puck', 'Charon', 'Fenrir'];
const VOICES_FEMALE = ['Aoede', 'Leda', 'Zephyr', 'Kore'];

const ADVANCED_MODE = process.env.GEMINI_ADVANCED_MODE ? process.env.GEMINI_ADVANCED_MODE === 'true' : true;
const GEMINI_MODEL_ADVANCED = process.env.GEMINI_MODEL_ADVANCED || 'gemini-2.5-flash-preview-native-audio-dialog';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-live-001';


/**
 * Complete a google genai request
 * @param request Request to complete
 * @returns text response
 */
export async function completeRequest(request: string, systemInstruction: string | undefined = undefined) : Promise<string | undefined> {

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
        throw new Error('GOOGLE_AI_API_KEY env variable is not set. Please check your .env file.');
    }

    const ai = new GoogleGenAI({ apiKey });
    const generationConfig : GenerateContentConfig = {
        systemInstruction: systemInstruction,
        temperature: 1,
        topP: 0.95,
        maxOutputTokens: 8192,
        thinkingConfig: {
            includeThoughts: false,
            thinkingBudget: 0
        }
    };
    const model = "gemini-2.5-flash-preview-05-20";
    try {
        const response = await ai.models.generateContent({model, config: generationConfig, contents: request});
        return response.text;
    } catch (error) {
        console.error('Error completing request:', error);
        return undefined;
    }
}


/**
 * Gemini Live Session implementation
 */
export class GeminiLiveSession extends LiveSession {
    session: Session | undefined; // Gemini Session
    transcriptionBuffer = ''; // Current transcription buffer
    transcriptionId = crypto.randomUUID(); // Current transcription ID

    mediaType = "audio/pcm;rate=16000"; // Media type for audio

    audioBuffers: AudioBuffer[] = []; // Audio buffers

    /**
     * Constructor
     * @param persona Persona
     * @param systemInstruction System instruction
     */
    constructor(persona: Persona | undefined, systemInstruction: string | undefined = undefined) {
        super(persona, systemInstruction);
    }

    getVoice(): string {
        if (this.persona?.voice === "male") {
            if (ADVANCED_MODE) {
                return ADVANCED_VOICES_MALE[Math.floor(Math.random() * ADVANCED_VOICES_MALE.length)];
            }
            return VOICES_MALE[Math.floor(Math.random() * VOICES_MALE.length)];
        }
        if (this.persona?.voice === "female") {
            if (ADVANCED_MODE) {
                return ADVANCED_VOICES_FEMALE[Math.floor(Math.random() * ADVANCED_VOICES_FEMALE.length)];
            }
            return VOICES_FEMALE[Math.floor(Math.random() * VOICES_FEMALE.length)];
        }
        return 'Kore';
    }

    /**
     * Start the conversation
     */
    async start() {

        const apiKey = process.env.GOOGLE_AI_API_KEY;
        if (!apiKey) {
            throw new Error('GOOGLE_AI_API_KEY env variable is not set. Please check your .env file.');
        }

        const ai = new GoogleGenAI({ apiKey });
        const model = ADVANCED_MODE ? GEMINI_MODEL_ADVANCED : GEMINI_MODEL;

        console.debug('Using Gemini model:', model);

        // Live Connect config
        const config : LiveConnectConfig = {
            responseModalities: [Modality.AUDIO],
            systemInstruction: this.systemInstruction,
            realtimeInputConfig: {
            automaticActivityDetection: {
                disabled: false,
                prefixPaddingMs: 100,
                silenceDurationMs: 1000,
            }
            },
            speechConfig : {
            voiceConfig: {
                prebuiltVoiceConfig: {
                voiceName: this.getVoice() || "Kore"
                }
            }
            },
            outputAudioTranscription: {},
        };

        // Add tools
        config.tools = [
            {
            functionDeclarations: [
                {
                name: 'conversationStopped',
                description: 'Notify that the conversation has terminated',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                    },
                }
                }
            ]
            }
        ];
        // Create sessions for both personas
        try {
            // Session A for Persona A
            this.session = await ai.live.connect({
                model: model,
                config: config,
                callbacks: {
                    onopen: () => console.debug('Gemini session opened'),
                    onmessage: (message: LiveServerMessage) => this.handleMessage(this.persona?.id || '', message),
                    onerror: (e: any) => console.error('Gemini session error:', e),
                    onclose: (e: CloseEvent) => {
                        if (e.reason) {
                            console.debug('Gemini session closed:', e);
                            this.listener?.onError(this, e.reason);
                        }
                        this.listener?.onSessionEnd(this);
                    },
                }
            });
        } catch (err) {
            console.error('Failed to setup Gemini Live sessions:', err);
        }
    }

    async close() {
        this.session?.close();
        this.session = undefined;
        this.listener?.onSessionEnd(this);
        this.listener = undefined;
    }

    sendMessage(message: string): Promise<void> {
        this.session?.sendClientContent({ turns: message });
        return Promise.resolve();
    }

    /**
     * Handle Gemini Live Session message
     * @param speakerId Speaker ID
     * @param message Geimini Live server message
     */
    handleMessage (speakerId: string, message: LiveServerMessage): void {

        if (message.setupComplete) {
            console.debug('Session setup complete', speakerId);
            this.listener?.onSessionStart(this);
            return;
        }

        if (message.toolCall?.functionCalls) {
            console.log('Received tool call', speakerId, message.toolCall?.functionCalls);
            if (message.toolCall?.functionCalls?.[0].name === 'conversationStopped') {
                // conversation was marked to stop
                // Stop the conversation
                console.debug('Conversation stopped', speakerId, message);
                this.close();
                return;
            }
        }
    
        if (message.serverContent?.outputTranscription?.text) {
            const text = message.serverContent?.outputTranscription?.text;
            // Accumulate delta into buffer
            this.transcriptionBuffer += text;
            console.debug('Output transcription', speakerId, message, this.transcriptionId, this.transcriptionBuffer);
            const entry: TranscriptEntry = {
                id: this.transcriptionId,
                speakerId: this.persona?.id || '',
                text: this.transcriptionBuffer,
                timestamp: new Date().getTime()
            }
            // notify listener
            this.listener?.onTranscriptEntry(this, entry);
            return;
        }
        if (message.serverContent?.turnComplete) {
            // End of turn: finalize and clear buffer
            console.debug('Turn complete', speakerId);
            this.listener?.onTurnComplete(this);

            return;
        }
        if (message.serverContent?.generationComplete) {
            console.log('Received generation complete', speakerId);
            // check if the transcription buffer is empty or contains the stop conversation message
            // this is a gemini tool bug where it sometimes sends the conversationStopped() call in the message
            if (this.transcriptionBuffer.trim().length <= 0 || this.transcriptionBuffer.includes('conversationStopped')) {
                this.close();
                return;
            }
            // reset transcription buffer
            this.transcriptionBuffer = '';
            this.transcriptionId = crypto.randomUUID();
            return;
        }
        if (message.serverContent?.modelTurn) {
            const parts = message.serverContent?.modelTurn?.parts;
            if (!parts) return;
            for (const part of parts) {
                const data = part.inlineData?.data;
                if (!data) {
                    console.log('Received empty audio', speakerId, part);
                    continue;
                }
                console.debug('Received audio', speakerId, data.length);
                const buffer = Buffer.from(data, 'base64');
                // although gemini sends 24kHz audio, it receives in 16kHz
                const resampledBuffer = resamplePCM16(buffer, 24000, 16000);
                const resampledBase64Audio = resampledBuffer.toString('base64');
                // notify listener
                this.listener?.onAudioBuffer(this, {personaId: this.persona?.id || '', transcriptionId: this?.transcriptionId, buffer: resampledBuffer, mediaType: "audio/pcm;rate=16000"})
            }
            return;
        }
        console.debug('Received unhandled gemini live message', speakerId, message);
    };

    addAudioBuffer(audioBuffer: AudioBuffer) {
        this.audioBuffers.push(audioBuffer);
    }

    async sendAudio(audioBuffer: AudioBuffer) {
        this.session?.sendRealtimeInput({
            audio: {
                data: audioBuffer.buffer.toString('base64'),
                mimeType: audioBuffer.mediaType
            }
        });
    }

    async flushAudio() {
        this.session?.sendRealtimeInput({
            audioStreamEnd: true
        });
    }
}


/**
 * Gemini Live Conversation Session implementation
 */
export class GeminiLiveConversationSession implements ConversationSession, SessionListener {
    id: string; // Session ID
    listener: ConversationSessionListener | undefined; // Session listener
    request: ConversationRequest; // Conversation request
    sessionA: LiveSession | undefined; // Live Session A for Persona A
    sessionB: LiveSession | undefined; // Live Session B for Persona B

    requestStop = false; // Request stop flag

    mediaType = "audio/pcm;rate=16000"; // Media type for audio

    audioBuffers: AudioBuffer[] = []; // Audio buffers

    sessionAStarted = false; // Session A started flag
    sessionBStarted = false; // Session B started flag

    /**
     * Constructor
     * @param listener Conversation session listener
     * @param request Conversation request
     */
    constructor(listener: ConversationSessionListener | undefined, request: ConversationRequest) {
        this.id = crypto.randomUUID();
        this.listener = listener;
        this.request = request;
        const {systemInstructionA, systemInstructionB} = getSystemInstructions(this.request);

        this.sessionA = new GeminiLiveSession(request.personas[0], systemInstructionA);
        this.sessionB = new GeminiLiveSession(request.personas[1], systemInstructionB);
        this.sessionA.listener = this;
        this.sessionB.listener = this;
    }

    onTranscriptEntry(session: LiveSession, entry: TranscriptEntry): void {
        this.listener?.onTranscriptEntry(entry);
    }
    onAudioBuffer(session: LiveSession, audioBuffer: AudioBuffer): void {
        this.listener?.onAudioBuffer(audioBuffer);
        // keep audio buffer
        this.addAudioBuffer(audioBuffer);
        if (session.persona?.id === this.sessionA?.persona?.id) {
            this.sessionB?.sendAudio(audioBuffer);
        } else if (session.persona?.id === this.sessionB?.persona?.id) {
            this.sessionA?.sendAudio(audioBuffer);
        }
    }
    onError(session: LiveSession, error: string): void {
        this.listener?.onError(error);
        this.close();
    }
    onSessionEnd(session: LiveSession): void {
        if (session.persona?.id === this.sessionA?.persona?.id) {
            this.sessionB?.close()
        }
        if (session.persona?.id === this.sessionB?.persona?.id) {
            this.sessionA?.close()
        }
        this.listener?.onSessionEnd();
        this.sessionA = undefined;
        this.sessionB = undefined;
    }

    onSessionStart(session: LiveSession): void {
        if (session.persona?.id === this.sessionA?.persona?.id) {
            this.sessionAStarted = true;
        } else if (session.persona?.id === this.sessionB?.persona?.id) {
            this.sessionBStarted = true;
        }
        if (this.sessionAStarted && this.sessionBStarted) {
            this.sessionB?.sendMessage(`Hello, ${this.sessionB.persona?.name}!`);
            this.listener?.onSessionStart();
        }
    }
    onTurnComplete(session: LiveSession): void {
        if (session.persona?.id === this.sessionA?.persona?.id) {
            this.sessionB?.flushAudio();
            if (this.requestStop) {
                // conversation was marked to stop
                console.log('Request stop', session.persona?.id);
                this.requestStop = false;
                // send message to the other session to stop the conversation
                this.sessionB?.sendMessage('Unfortunately our time is up we need to wrap up this conversation.');
            }
        } else if (session.persona?.id === this.sessionB?.persona?.id) {
            this.sessionA?.flushAudio();
            if (this.requestStop) {
                // conversation was marked to stop
                console.log('Request stop', session.persona?.id);
                this.requestStop = false;
                // send message to the other session to stop the conversation
                this.sessionA?.sendMessage('Unfortunately our time is up we need to wrap up this conversation.');
            }
        }
    }

    /**
     * Start the conversation
     */
    async start() {
        this.sessionA?.start();
        this.sessionB?.start();
    }

    async close() {
        this.sessionA?.close();
        this.sessionB?.close();
        this.listener?.onSessionEnd();
        this.sessionA = undefined;
        this.sessionB = undefined;
        return Promise.resolve();
    }

    async stop() {
        this.requestStop = true;
    }

    addAudioBuffer(audioBuffer: AudioBuffer) {
        this.audioBuffers.push(audioBuffer);
    }
}

