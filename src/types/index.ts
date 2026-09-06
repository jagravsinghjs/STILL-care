/**
 * STILL-care Data Contracts & Type Definitions
 *
 * Strictly follows the approved STILL-care architecture and PRD:
 * - Simple semantic risk model ('green' | 'yellow' | 'red')
 * - Distress trend ('improving' | 'worsening')
 * - No diagnostic scores, no clinical numerical ratings (e.g. no 78/100)
 * - Privacy by design: supervisor never receives raw conversation transcripts by default
 */

export type RiskLevel = 'green' | 'yellow' | 'red';
export type DistressTrend = 'improving' | 'worsening';

export interface Patient {
  id: string;
  name: string;
  assignedSupervisorId: string;
  lastCheckInDate: string;
  currentRiskLevel: RiskLevel;
  distressTrend: DistressTrend;
}

export interface Supervisor {
  id: string;
  name: string;
  title: string;
  organization: string;
  verificationStatus: 'verified' | 'pending';
}

export interface CheckInSession {
  id: string;
  patientId: string;
  date: string;
  mode: 'text' | 'voice';
  summary: string;
  plainLanguageReason: string;
  riskLevel: RiskLevel;
  distressTrend: DistressTrend;
  transcript?: string; // Kept private to the patient; omitted or hidden in supervisor views
}

export interface TrendPoint {
  date: string;
  checkInId: string;
  riskLevel: RiskLevel;
  distressTrend: DistressTrend;
  // Note: numeric mapping (e.g. green=1, yellow=2, red=3) may be used internally
  // ONLY for Recharts visualization coordinates, never displayed as a clinical score.
}

export interface AlertItem {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  riskLevel: RiskLevel;
  distressTrend: DistressTrend;
  reason: string;
  isRead: boolean;
}

export interface RecommendationItem {
  id: string;
  patientId: string;
  patientName: string;
  suggestedAction: string;
  contextReason: string;
  status: 'pending' | 'addressed';
}

export interface Message {
  id: string;
  senderRole: 'patient' | 'supervisor';
  patientId: string;
  supervisorId: string;
  content: string;
  timestamp: string;
}

/**
 * SUPERVISOR PRIVACY SEPARATION:
 * The supervisor never receives the raw reflection or transcript.
 * This type guarantee ensures the data model excludes transcript.
 */
export type SupervisorSessionSummary = Omit<CheckInSession, 'transcript'>;

export interface SupervisorPatient extends Patient {
  latestSessionMode?: 'text' | 'voice';
  latestObservation?: string;
  sessionsCount?: number;
}

export interface SupervisorAlert extends AlertItem {
  recurringThemes?: string[];
  suggestedAction?: string;
}

export interface SupervisorActionRecord {
  id: string;
  patientId: string;
  type: 'reach_out' | 'supportive_message' | 'appointment_request';
  status: string;
  details?: string;
  timestamp: string;
}
