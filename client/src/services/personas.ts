import { Persona } from "../types/data";

const apiURL = process.env.REACT_APP_API_URL || '';

let cachedPersonas: Persona[] = [];

export function getPersona(id: string) : Persona | null {
    return cachedPersonas.find(p => p.id === id) || null;
}


export async function getPersonas() : Promise<Persona[]> {

    if (cachedPersonas.length > 0) {
        return cachedPersonas;
    }

    return fetch(apiURL + '/api/personas')
        .then(res => res.json())
        .then(data => {
            console.log(data);
            cachedPersonas = data.personas || [];
            return cachedPersonas;
        })
        .catch(err => {
            console.log(err);
            return [];
        });
};
