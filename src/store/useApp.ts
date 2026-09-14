import {create} from 'zustand';
import {reflections,messages} from '../data/mock';
import type {Role,Reflection,Message} from '../types';
interface State {role:Role|null; reflections:Reflection[]; messages:Message[]; followed:string[]; login:(role:Role)=>void; logout:()=>void; addReflection:(r:Reflection)=>void; send:(m:Message)=>void; follow:(id:string)=>void;}
// Session memory only: sensitive demo entries are not written to browser storage.
export const useApp=create<State>((set)=>({role:null,reflections,messages,followed:[],login:role=>set({role}),logout:()=>set({role:null}),addReflection:r=>set(s=>({reflections:[r,...s.reflections]})),send:m=>set(s=>({messages:[...s.messages,m]})),follow:id=>set(s=>({followed:[...new Set([...s.followed,id])]}))}));
