import { ConversationStyle, PaloozaConversation, Persona } from "../types/data";
import { getPersona } from "./personas";


const apiURL = process.env.REACT_APP_API_URL || '';

let cachedTopics: string[] = [];

export async function getTopics() : Promise<string[]> {
    if (cachedTopics.length > 0) {
      return cachedTopics;
    }
    return fetch( apiURL + '/api/topics')  
    .then(res => res.json())
    .then(data => {
      console.log(data);
      cachedTopics = data.topics;
      return cachedTopics;
    });

}

let cachedStyles: ConversationStyle[] = [];

export async function getStyles() : Promise<ConversationStyle[]> {
    if (cachedStyles.length > 0) {
      return cachedStyles;
    }
    return fetch( apiURL + '/api/styles')  
    .then(res => res.json())
    .then(data => {
      console.log(data);
      cachedStyles = data.styles;
      return cachedStyles;
    });

}

export async function getPersonas(conversation: PaloozaConversation) : Promise<Persona[]> {
    if (!conversation.personas || conversation.personas.length === 0) {
      return [];
    }
    const personasIds = conversation.personas;
    const personaA = await getPersona(personasIds[0]);
    const personaB = await getPersona(personasIds[1]);
    if (!personaA || !personaB) {
      return [];
    }
    return [personaA, personaB];
};