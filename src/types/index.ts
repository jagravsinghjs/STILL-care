export type Role = 'user' | 'supervisor';
export type Status = 'Stable' | 'Monitoring' | 'Increasing concern';
export type Trend = 'Improving' | 'No clear change' | 'Worsening';
export interface Continuity { id:string; date:string; mode:'Written'|'Voice'; observation:string; }
export interface Reflection extends Continuity { raw:string; }
export interface User { id:string; name:string; initials:string; context:string; status:Status; trend:Trend; summary:string; }
export interface Message { id:string; userId:string; sender:Role; text:string; date:string; }
