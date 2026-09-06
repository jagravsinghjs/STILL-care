/**
 * STILL-care Patient Store
 *
 * Holds state relevant to the currently active patient session:
 * - Patient profile details
 * - Asynchronous check-in history
 * - Active check-in draft
 * - Messages with assigned supervisor
 */

import { create } from 'zustand';
import { Patient, CheckInSession, Message, TrendPoint, SupervisorActionRecord } from '../types';
import {
  getCurrentPatient,
  getPatientSessions,
  createCheckIn,
  getPatientMessages,
  sendPatientMessage,
  getPatientTrendPoints,
  getPatientSupervisorActions,
  requestAppointmentAsPatient
} from '../api/patientApi';

interface PatientState {
  currentPatient: Patient | null;
  sessions: CheckInSession[];
  messages: Message[];
  supervisorActions: SupervisorActionRecord[];
  trendPoints: TrendPoint[];
  isLoading: boolean;
  activeCheckInDraft: {
    mode: 'text' | 'voice';
    content: string;
  };

  // Actions
  loadPatientData: (patientId?: string) => Promise<void>;
  loadMessages: (patientId?: string) => Promise<void>;
  loadSupervisorActions: (patientId?: string) => Promise<void>;
  setDraftContent: (content: string) => void;
  setDraftMode: (mode: 'text' | 'voice') => void;
  resetDraft: () => void;
  submitCheckIn: (overrideParams?: { mode?: 'text' | 'voice'; content?: string }) => Promise<CheckInSession | null>;
  sendMessageToSupervisor: (content: string) => Promise<void>;
  requestAppointment: (preferredTime: string, note?: string) => Promise<SupervisorActionRecord | null>;
}

export const usePatientStore = create<PatientState>((set, get) => ({
  currentPatient: null,
  sessions: [],
  messages: [],
  supervisorActions: [],
  trendPoints: [],
  isLoading: false,
  activeCheckInDraft: {
    mode: 'text',
    content: ''
  },

  loadPatientData: async (patientId = 'pat-1') => {
    set({ isLoading: true });
    try {
      const patient = await getCurrentPatient(patientId);
      const sessions = await getPatientSessions(patientId);
      const messages = await getPatientMessages(patientId);
      const trendPoints = await getPatientTrendPoints(patientId);
      const supervisorActions = await getPatientSupervisorActions(patientId);
      set({
        currentPatient: patient,
        sessions,
        messages,
        trendPoints,
        supervisorActions,
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to load patient data:', error);
      set({ isLoading: false });
    }
  },

  loadMessages: async (patientId = 'pat-1') => {
    try {
      const messages = await getPatientMessages(patientId);
      set({ messages });
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  },

  loadSupervisorActions: async (patientId = 'pat-1') => {
    try {
      const supervisorActions = await getPatientSupervisorActions(patientId);
      set({ supervisorActions });
    } catch (error) {
      console.error('Failed to load supervisor actions:', error);
    }
  },

  setDraftContent: (content) => {
    set((state) => ({
      activeCheckInDraft: { ...state.activeCheckInDraft, content }
    }));
  },

  setDraftMode: (mode) => {
    set((state) => ({
      activeCheckInDraft: { ...state.activeCheckInDraft, mode }
    }));
  },

  resetDraft: () => {
    set({ activeCheckInDraft: { mode: 'text', content: '' } });
  },

  submitCheckIn: async (overrideParams?: { mode?: 'text' | 'voice'; content?: string }) => {
    let { currentPatient } = get();
    const { activeCheckInDraft } = get();

    if (!currentPatient) {
      await get().loadPatientData('pat-1');
      currentPatient = get().currentPatient;
    }

    const mode = overrideParams?.mode || activeCheckInDraft.mode;
    const content = overrideParams?.content !== undefined ? overrideParams.content : activeCheckInDraft.content;

    if (!currentPatient || !content.trim()) return null;

    set({ isLoading: true });
    try {
      const newSession = await createCheckIn({
        patientId: currentPatient.id,
        mode,
        content
      });

      // Refresh patient profile and sessions
      const updatedPatient = await getCurrentPatient(currentPatient.id);
      const updatedSessions = await getPatientSessions(currentPatient.id);

      set({
        currentPatient: updatedPatient,
        sessions: updatedSessions,
        isLoading: false,
        activeCheckInDraft: { mode: 'text', content: '' }
      });

      return newSession;
    } catch (error) {
      console.error('Failed to submit check-in:', error);
      set({ isLoading: false });
      return null;
    }
  },

  sendMessageToSupervisor: async (content: string) => {
    const { currentPatient } = get();
    if (!currentPatient || !content.trim()) return;

    try {
      const newMsg = await sendPatientMessage({
        patientId: currentPatient.id,
        supervisorId: currentPatient.assignedSupervisorId,
        content
      });
      set((state) => ({ messages: [...state.messages, newMsg] }));
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  },

  requestAppointment: async (preferredTime: string, note?: string) => {
    const { currentPatient } = get();
    if (!currentPatient) return null;

    try {
      const newAction = await requestAppointmentAsPatient({
        patientId: currentPatient.id,
        preferredTime,
        note
      });
      set((state) => ({
        supervisorActions: [newAction, ...state.supervisorActions]
      }));
      return newAction;
    } catch (error) {
      console.error('Failed to request appointment:', error);
      return null;
    }
  }
}));

