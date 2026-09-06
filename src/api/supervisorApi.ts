/**
 * STILL-care Supervisor API Layer
 *
 * Exposes asynchronous functions for supervisor triage, alerts, trends, and interventions.
 *
 * PRIVACY BY DESIGN:
 * Notice that `getPatientSessions` does NOT return raw conversation transcripts.
 * Supervisors receive summaries, plainLanguageReason, riskLevel, and distressTrend only.
 */

import {
  Patient,
  Supervisor,
  CheckInSession,
  TrendPoint,
  AlertItem,
  RecommendationItem,
  Message,
  SupervisorPatient,
  SupervisorSessionSummary,
  SupervisorAlert,
  SupervisorActionRecord
} from '../types';
import {
  mockPatients,
  mockSupervisors,
  mockCheckInSessions,
  mockTrendPoints,
  mockAlerts,
  mockRecommendations,
  mockMessages,
  mockSupervisorActions
} from './mockData';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getSupervisorProfile(supervisorId: string = 'sup-1'): Promise<Supervisor> {
  await delay(150);
  const supervisor = mockSupervisors.find((s) => s.id === supervisorId);
  if (!supervisor) {
    throw new Error(`Supervisor with ID ${supervisorId} not found`);
  }
  return { ...supervisor };
}

/**
 * Priority weighting for supervisor caseload sorting:
 * 1. Increasing concern (red)
 * 2. Monitoring (yellow)
 * 3. Stable (green)
 */
const RISK_PRIORITY: Record<string, number> = {
  red: 1,
  yellow: 2,
  green: 3
};

/**
 * SUPERVISOR PATIENT COHORT
 * Returns assigned students sorted strictly by continuity priority:
 * 1. Increasing concern first
 * 2. Monitoring next
 * 3. Stable after them
 * Within the same state: most recently active first.
 *
 * PRIVACY GUARANTEE:
 * Does not expose raw patient reflections or transcripts.
 */
export async function getSupervisorPatients(): Promise<SupervisorPatient[]> {
  await delay(200);

  const cohort: SupervisorPatient[] = mockPatients.map((patient) => {
    // Find sessions for this patient, sorted newest first
    const patientSessions = mockCheckInSessions
      .filter((s) => s.patientId === patient.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const latestSession = patientSessions[0];

    return {
      ...patient,
      latestSessionMode: latestSession ? latestSession.mode : undefined,
      latestObservation: latestSession ? latestSession.plainLanguageReason : undefined,
      sessionsCount: patientSessions.length
    };
  });

  // Sort by priority (red -> yellow -> green), then by lastCheckInDate descending
  return cohort.sort((a, b) => {
    const priorityA = RISK_PRIORITY[a.currentRiskLevel] || 99;
    const priorityB = RISK_PRIORITY[b.currentRiskLevel] || 99;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // Secondary sort: most recently active first
    return new Date(b.lastCheckInDate).getTime() - new Date(a.lastCheckInDate).getTime();
  });
}

export async function getSupervisorPatient(patientId: string): Promise<SupervisorPatient | undefined> {
  await delay(150);
  const cohort = await getSupervisorPatients();
  return cohort.find((p) => p.id === patientId);
}

/**
 * SUPERVISOR LONGITUDINAL SESSIONS:
 * STRICT PRIVACY BY DESIGN:
 * Strips raw patient conversation transcripts. Supervisors receive high-level care continuity
 * observations, dates, reflection modes, and distress trends only.
 */
export async function getSupervisorPatientSessions(patientId: string): Promise<SupervisorSessionSummary[]> {
  await delay(200);
  return mockCheckInSessions
    .filter((s) => s.patientId === patientId)
    .map(({ transcript, ...supervisorSafeSession }) => supervisorSafeSession) // Transcript is stripped at data boundary
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getPatients(): Promise<Patient[]> {
  return getSupervisorPatients();
}

export async function getPatientById(patientId: string): Promise<Patient | undefined> {
  return getSupervisorPatient(patientId);
}

export async function getPatientSessionSummaries(patientId: string): Promise<SupervisorSessionSummary[]> {
  return getSupervisorPatientSessions(patientId);
}

export async function getPatientTrend(patientId: string): Promise<TrendPoint[]> {
  await delay(150);
  const points = mockTrendPoints[patientId] || [];
  return [...points];
}

export async function getSupervisorAlerts(): Promise<SupervisorAlert[]> {
  await delay(150);
  return mockAlerts.map((a) => ({ ...a }));
}

export async function getAlerts(): Promise<AlertItem[]> {
  return getSupervisorAlerts();
}

export async function markAlertReviewed(alertId: string): Promise<void> {
  await delay(100);
  const alert = mockAlerts.find((a) => a.id === alertId);
  if (alert) {
    alert.isRead = true;
  }
}

export async function markAlertAsRead(alertId: string): Promise<void> {
  return markAlertReviewed(alertId);
}

export async function getSupervisorRecommendations(): Promise<RecommendationItem[]> {
  await delay(150);
  return mockRecommendations.map((r) => ({ ...r }));
}

export async function getRecommendations(): Promise<RecommendationItem[]> {
  return getSupervisorRecommendations();
}

export async function updateRecommendationStatus(
  recommendationId: string,
  status: 'pending' | 'addressed'
): Promise<void> {
  await delay(100);
  const item = mockRecommendations.find((r) => r.id === recommendationId);
  if (item) {
    item.status = status;
  }
}

export async function getMessages(patientId: string): Promise<Message[]> {
  await delay(150);
  return mockMessages
    .filter((m) => m.patientId === patientId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export async function sendMessage(params: {
  patientId: string;
  supervisorId: string;
  content: string;
}): Promise<Message> {
  await delay(200);
  const newMessage: Message = {
    id: `msg-${Date.now()}`,
    senderRole: 'supervisor',
    patientId: params.patientId,
    supervisorId: params.supervisorId,
    content: params.content,
    timestamp: new Date().toISOString()
  };
  mockMessages.push(newMessage);
  return newMessage;
}

export async function logSupervisorAction(params: {
  patientId: string;
  type: 'reach_out' | 'supportive_message' | 'appointment_request';
  status: string;
  details?: string;
}): Promise<SupervisorActionRecord> {
  await delay(150);
  const newAction: SupervisorActionRecord = {
    id: `act-${Date.now()}`,
    patientId: params.patientId,
    type: params.type,
    status: params.status,
    details: params.details,
    timestamp: new Date().toISOString()
  };
  mockSupervisorActions.unshift(newAction);
  return newAction;
}

export async function getSupervisorActions(patientId: string): Promise<SupervisorActionRecord[]> {
  await delay(100);
  return mockSupervisorActions
    .filter((a) => a.patientId === patientId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
