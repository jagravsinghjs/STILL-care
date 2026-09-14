import type {Continuity, Reflection} from '../types';
// Explicit allowlist: never return private reflection text to supervisor UI.
export function toContinuity(item:Reflection):Continuity {
 return {id:item.id,date:item.date,mode:item.mode,observation:item.observation};
}
export async function createReflection(raw:string,mode:Reflection['mode']):Promise<Reflection> {
 if (!raw.trim()) throw new Error('Add a few words before submitting.');
 return {id:crypto.randomUUID(),date:new Date().toISOString(),mode,raw:raw.trim(),observation:'A new check-in was shared.'};
}
