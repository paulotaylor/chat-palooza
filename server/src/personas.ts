import { Persona } from "../../client/src/types/data";
import * as fs from 'fs';

if (!process.env.PERSONAS) {
    throw new Error('PERSONAS env variable is not set. Please check your .env file.');
}

// read file from process.env.GOOGLE_SERVICE_ACCOUNT  async
const personas: Persona[] = JSON.parse(fs.readFileSync(process.env.PERSONAS, 'utf8'));

export function getPersonaById(id: string): Persona | undefined {
    return personas.find(persona => persona.id === id);
}
    
export function getPersonas(): Persona[] {
    return personas;
}

  