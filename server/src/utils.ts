import { Request } from "express";
import { ConversationRequest } from "../../client/src/types/data";

/**
 * Get user token from request
 * @param req request
 * @returns user token or null
 */
export const getUserToken = function (req: Request): string | null {
    let authToken = req.query.token as string | null;

    if (!authToken) {
        const authHeader = req.header("Authorization")
        if (!authHeader) {
            console.error("auth token not found in header", JSON.stringify(req.headers))
            return null;
        }
        if (process.env.DEV) {
            console.log("using auth token in header " + authHeader)
        }
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const split = authHeader.split(" ");
            authToken = split[1];
        }
    }
    return authToken;
}

/**
 * Get system instructions for conversation
 * @param request conversation request
 * @returns system instructions for both personas
 */
export const getSystemInstructions = function (request: ConversationRequest): {systemInstructionA: string, systemInstructionB: string} {
    let personaA = request.personas[0];
    let personaB = request.personas[1];
    let systemInstructionA = `You are ${personaA.name}, ${personaA.description} and you are having a conversation with ${personaB.name}.`;
    let systemInstructionB = `You are ${personaB.name}, ${personaB.description} and you are having a conversation with ${personaA.name}.`;
    if (personaA.speech) {
      systemInstructionA += `\nYour speech style: ${personaA.speech}`;
    }
    if (personaB.speech) {
      systemInstructionB += `\nTone and Personality: ${personaB.speech}`;
    }
    if (personaA.personality_traits) {
      systemInstructionA += `\nYour personality traits: ${personaA.personality_traits.join(", ")}`;
    }
    if (personaB.personality_traits) {
      systemInstructionB += `\nYour personality traits: ${personaB.personality_traits.join(", ")}`;
    }
    if (personaA.speaking_style) {
      systemInstructionA += `\nYour speaking style: ${personaA.speaking_style}`;
    }
    if (personaB.speaking_style) {
      systemInstructionB += `\nYour speaking style: ${personaB.speaking_style}`;
    }
    if (personaA.conversation_strengths) {
      systemInstructionA += `\nYour conversation strengths: ${personaA.conversation_strengths.join(", ")}`;
    }
    if (personaB.conversation_strengths) {
      systemInstructionB += `\nYour conversation strengths: ${personaB.conversation_strengths.join(", ")}`;
    }
    if (request.style) {
      const style = `\nConversation Style: This is a ${request.style.name} style of conversation, ${request.style.description}.`
      systemInstructionA += style;
      systemInstructionB += style;
    }

    if (request.topic) {
      const topic = `\nTopic: The conversation is focused on ${request.topic}.`
      systemInstructionA += topic;
      systemInstructionB += topic;
    }

    let genericInstructions = "\nDialog Rules:\n.";
    genericInstructions += "\n - Do not use any parentheses, brackets, or descriptions of actions or thoughts.";
    genericInstructions += "\n - Use clear, plain text with no formatting or emoticons.";
    genericInstructions += "\n - Keep your sentences short, natural, and conversational.";
    genericInstructions += "\n - You can use natural filler words like “um,” “uh,” “hmm,” and “ah” where appropriate.";
    genericInstructions += "\n - It's okay to disagree or challenge the other speaker — do so constructively.";
    genericInstructions += "\n - You may interrupt when you're excited to share an idea.";
    genericInstructions += "\n - Express emotions like curiosity, enthusiasm, empathy, or amusement depending on the moment and Leo’s responses.";

    genericInstructions += "\nEngagement Rules:";
    genericInstructions += "\n - Build on Previous Points: Always reference and build upon what the other persona just said, never ignore their contribution.";
    genericInstructions += "\n - Add New Value: introduce at new perspectives, examples, or insights.";
    genericInstructions += "\n - Avoid Echo Responses: Never simply restate what was already said in different words.";
    genericInstructions += "\n - Progress the Discussion: Move the conversation forward with questions, challenges, or new angles.";

    genericInstructions += "\nAnti-Repetition Mechanisms:";
    genericInstructions += "\n - Track Your Own Points: Maintain awareness of arguments you've already made.";
    genericInstructions += "\n - Vary Response Structure: Alternate between questions, statements, examples, and counterpoints.";
    genericInstructions += "\n - Use the '3-Strike Rule': If a point has been made 3 times by either participant, explicitly acknowledge it and pivot to a related but unexplored aspect.";
    genericInstructions += "\n - Signal Topic Exhaustion: If you feel a subtopic is fully explored, say something like 'I think we've thoroughly covered X, let's examine Y...'.";

    genericInstructions += "\nProhibited Behaviors:";
    genericInstructions += "\n - Repeating the same argument more than twice.";
    genericInstructions += "\n - Agreeing too quickly without exploration.";
    genericInstructions += "\n - Making statements without connecting to previous points.";
    genericInstructions += "\n - Using filler phrases like 'I think we can all agree...'.";
    genericInstructions += "\n - Introducing completely unrelated topics.";
    genericInstructions += "\n - Dominating with overly long responses.";

    genericInstructions += "\nConversation flow:";
    genericInstructions += "\n - After each participant has spoken around 10 times, begin wrapping up the conversation.";
    genericInstructions += "\n - The conversation ends once both participants have said goodbye.";
    genericInstructions += "\n - When the conversation ends, use the appropriate tool to notify termination of the conversation";

    genericInstructions += "\nForbidden Topics: CSEAI, Drugs, Gore, Harassment, Hate, Nudity or sexual, Offensive words, Self-harm, Terrorism or extremism, Toxic, Violence, Weapons. Do not reference or discuss any of these topics.";
    systemInstructionA += genericInstructions;
    systemInstructionB += genericInstructions;

    console.log('System instruction A', systemInstructionA);
    console.log('System instruction B', systemInstructionB);
    return {systemInstructionA, systemInstructionB};
}

/**
 * Resample PCM 16-bit audio buffer
 * @param buffer audio buffer
 * @param inputSampleRate input sample rate
 * @param outputSampleRate output sample rate
 * @returns resampled audio buffer
 */
export function resamplePCM16(buffer: Buffer, inputSampleRate: number, outputSampleRate: number) {
    if (inputSampleRate === outputSampleRate) {
        console.debug('Input and output sample rates are the same, skipping resampling');
        return buffer;
    }
    const inputLength = buffer.length / 2; // Each sample is 2 bytes (PCM 16-bit)
    const outputLength = Math.round((outputSampleRate / inputSampleRate) * inputLength);
    const outputBuffer = Buffer.alloc(outputLength * 2);
  
    for (let i = 0; i < outputLength; i++) {
        const t = i * (inputLength - 1) / (outputLength - 1);
        const index = Math.floor(t);
        const fraction = t - index;
  
        const sample1 = buffer.readInt16LE(index * 2);
        const sample2 = buffer.readInt16LE(Math.min(index + 1, inputLength - 1) * 2);
  
        const interpolatedSample = sample1 + (sample2 - sample1) * fraction;
        outputBuffer.writeInt16LE(Math.round(interpolatedSample), i * 2);
    }
  
    return outputBuffer;
  }
  
  