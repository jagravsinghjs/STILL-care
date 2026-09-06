/**
 * STILL-care Supervisor Store
 *
 * Manages supervisor clinical triage state:
 * - Patient roster & selected patient for review
 * - Real-time alerts and plain-language recommendations
 * - Messaging and intervention dispatch
 */

import { create } from 'zustand';
import {
  SupervisorPatient,
  SupervisorSessionSummary,
  SupervisorAlert,
  SupervisorActionRecord,
  RecommendationItem,
  Message
} from '../types';
import {
  getSupervisorPatients,
  getSupervisorPatient,
  getSupervisorPatientSessions,
  getSupervisorAlerts,
  markAlertReviewed,
  getSupervisorRecommendations,
  updateRecommendationStatus,
  getMessages,
  sendMessage,
  logSupervisorAction,
  getSupervisorActions
} from '../api/supervisorApi';

interface SupervisorState {
  patients: SupervisorPatient[];
  selectedPatientId: string | null;
  activePatient: SupervisorPatient | null;
  activePatientSessions: SupervisorSessionSummary[];
  activePatientActions: SupervisorActionRecord[];
  alerts: SupervisorAlert[];
  recommendations: RecommendationItem[];
  messages: Message[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadSupervisorData: () => Promise<void>;
  setSelectedPatientId: (patientId: string | null) => void;
  loadPatientDetail: (patientId: string) => Promise<void>;
  loadPatientMessages: (patientId: string) => Promise<void>;
  markAlertReviewed: (alertId: string) => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
  updateRecommendation: (recId: string, status: 'pending' | 'addressed') => Promise<void>;
  completeRecommendation: (recId: string) => Promise<void>;
  logAction: (
    patientId: string,
    type: 'reach_out' | 'supportive_message' | 'appointment_request',
    status: string,
    details?: string
  ) => Promise<void>;
  sendSupportiveMessage: (patientId: string, content: string) => Promise<void>;
  sendInterventionMessage: (patientId: string, content: string) => Promise<void>;
}

export const useSupervisorStore = create<SupervisorState>((set, get) => ({
  patients: [],
  selectedPatientId: null,
  activePatient: null,
  activePatientSessions: [],
  activePatientActions: [],
  alerts: [],
  recommendations: [],
  messages: [],
  isLoading: false,
  error: null,

  loadSupervisorData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [patients, alerts, recommendations] = await Promise.all([
        getSupervisorPatients(),
        getSupervisorAlerts(),
        getSupervisorRecommendations()
      ]);
      set({
        patients,
        alerts,
        recommendations,
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to load supervisor data:', error);
      set({ isLoading: false, error: 'Could not load supervisor workspace data.' });
    }
  },

  setSelectedPatientId: (patientId) => {
    set({ selectedPatientId: patientId });
    if (patientId) {
      get().loadPatientDetail(patientId);
      get().loadPatientMessages(patientId);
    }
  },

  loadPatientDetail: async (patientId) => {
    set({ isLoading: true, error: null });
    try {
      const [patient, sessions, actions, messages] = await Promise.all([
        getSupervisorPatient(patientId),
        getSupervisorPatientSessions(patientId),
        getSupervisorActions(patientId),
        getMessages(patientId)
      ]);

      set({
        activePatient: patient || null,
        activePatientSessions: sessions,
        activePatientActions: actions,
        messages,
        selectedPatientId: patientId,
        isLoading: false
      });
    } catch (error) {
      console.error(`Failed to load patient detail for ${patientId}:`, error);
      set({ isLoading: false, error: 'Could not load patient continuity record.' });
    }
  },

  loadPatientMessages: async (patientId) => {
    try {
      const messages = await getMessages(patientId);
      set({ messages });
    } catch (error) {
      console.error('Failed to load patient messages:', error);
    }
  },

  markAlertReviewed: async (alertId) => {
    await markAlertReviewed(alertId);
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === alertId ? { ...a, isRead: true } : a))
    }));
  },

  dismissAlert: async (alertId) => {
    return get().markAlertReviewed(alertId);
  },

  updateRecommendation: async (recId, status) => {
    await updateRecommendationStatus(recId, status);
    set((state) => ({
      recommendations: state.recommendations.map((r) =>
        r.id === recId ? { ...r, status } : r
      )
    }));
  },

  completeRecommendation: async (recId) => {
    return get().updateRecommendation(recId, 'addressed');
  },

  logAction: async (patientId, type, status, details) => {
    try {
      const newAction = await logSupervisorAction({
        patientId,
        type,
        status,
        details
      });
      set((state) => ({
        activePatientActions: [newAction, ...state.activePatientActions]
      }));
    } catch (error) {
      console.error('Failed to log supervisor action:', error);
    }
  },

  sendSupportiveMessage: async (patientId, content) => {
    if (!content.trim()) return;
    try {
      const newMsg = await sendMessage({
        patientId,
        supervisorId: 'sup-1',
        content
      });
      // Also log as an action record
      const newAction = await logSupervisorAction({
        patientId,
        type: 'supportive_message',
        status: 'Supportive message sent',
        details: content.length > 80 ? content.slice(0, 77) + '...' : content
      });
      set((state) => ({
        messages: [...state.messages, newMsg],
        activePatientActions: [newAction, ...state.activePatientActions]
      }));
    } catch (error) {
      console.error('Failed to send supportive message:', error);
    }
  },

  sendInterventionMessage: async (patientId, content) => {
    return get().sendSupportiveMessage(patientId, content);
  }
}));
