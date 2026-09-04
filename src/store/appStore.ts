/**
 * STILL-care App Store (Global & Demo Switcher State)
 *
 * Manages the global role perspective for hackathon demonstration.
 * Transient UI states (like dropdown open/close or form inputs) stay in local component useState.
 */

import { create } from 'zustand';

export type UserRole = 'patient' | 'supervisor';

interface AppState {
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeRole: 'patient',
  setActiveRole: (role) => set({ activeRole: role })
}));
