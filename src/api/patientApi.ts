/**
 * STILL-care Patient API Layer
 *
 * Exposes asynchronous functions for all patient data operations.
 * Isolates UI components from raw mock data, simulating future FastAPI network calls.
 */

import {
  Patient,
  Supervisor,
  CheckInSession,
  Message,
  RiskLevel,
  DistressTrend,
  TrendPoint,
  SupervisorActionRecord
} from '../types';
import {
  mockPatients,
  mockSupervisors,
  mockCheckInSessions,
  mockMessages,
  mockAlerts,
  mockRecommendations,
  mockTrendPoints,
  mockSupervisorActions
} from './mockData';

// Simulated network delay (beginner-friendly async behavior)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getCurrentPatient(patientId: string = 'pat-1'): Promise<Patient> {
  await delay(150);
  const patient = mockPatients.find((p) => p.id === patientId);
  if (!patient) {
    throw new Error(`Patient with ID ${patientId} not found`);
  }
  return { ...patient };
}

export async function getPatientSessions(patientId: string = 'pat-1'): Promise<CheckInSession[]> {
  await delay(200);
  return mockCheckInSessions
    .filter((s) => s.patientId === patientId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function createCheckIn(params: {
  patientId: string;
  mode: 'text' | 'voice';
  content: string;
}): Promise<CheckInSession> {
  await delay(350);

  const today = new Date().toISOString().split('T')[0];

  // Simple mock observation logic based on content keywords
  const text = params.content.toLowerCase();
  let riskLevel: RiskLevel = 'green';
  let distressTrend: DistressTrend = 'improving';
  let summary = 'Patient shared thoughts during a regular daily check-in.';
  let plainLanguageReason = 'Reflective tone with stable everyday rhythms noted.';

  if (text.includes('exhaust') || text.includes('overwhelm') || text.includes('can barely') || text.includes('behind') || text.includes('tired')) {
    riskLevel = 'yellow';
    distressTrend = 'worsening';
    summary = 'Patient shared feelings of fatigue, workload pressure, and difficulty unwinding.';
    plainLanguageReason = 'Recurring expressions of fatigue and cognitive overload noted during check-in.';
  } else if (text.includes('hopeless') || text.includes('no point') || text.includes('give up') || text.includes('isolated')) {
    riskLevel = 'red';
    distressTrend = 'worsening';
    summary = 'Patient expressed deep discouragement and thoughts of withdrawing from daily routines.';
    plainLanguageReason = 'Direct expressions of acute distress and feelings of helplessness.';
  }

  const newSession: CheckInSession = {
    id: `session-${Date.now()}`,
    patientId: params.patientId,
    date: today,
    mode: params.mode,
    summary,
    plainLanguageReason,
    riskLevel,
    distressTrend,
    transcript: params.content // Stored for patient's private self-reflection only
  };

  // Add to mock collections
  mockCheckInSessions.unshift(newSession);

  // Update patient's current risk level and trend
  const patient = mockPatients.find((p) => p.id === params.patientId);
  if (patient) {
    patient.currentRiskLevel = riskLevel;
    patient.distressTrend = distressTrend;
    patient.lastCheckInDate = today;
  }

  // Update trend points
  const points = mockTrendPoints[params.patientId] || [];
  points.push({
    date: `${new Date().getMonth() + 1}/${new Date().getDate()}`,
    checkInId: newSession.id,
    riskLevel,
    distressTrend
  });
  mockTrendPoints[params.patientId] = points;

  // If worsening or yellow/red, create a supervisor alert
  if (riskLevel !== 'green' || distressTrend === 'worsening') {
    mockAlerts.unshift({
      id: `alert-${Date.now()}`,
      patientId: params.patientId,
      patientName: patient?.name || 'Patient',
      date: today,
      riskLevel,
      distressTrend,
      reason: plainLanguageReason,
      isRead: false
    });

    mockRecommendations.unshift({
      id: `rec-${Date.now()}`,
      patientId: params.patientId,
      patientName: patient?.name || 'Patient',
      suggestedAction: riskLevel === 'red'
        ? 'Schedule direct check-in call within 12 hours.'
        : 'Send supportive asynchronous message to offer listening space.',
      contextReason: plainLanguageReason,
      status: 'pending'
    });
  }

  return newSession;
}

export async function getPatientMessages(patientId: string = 'pat-1'): Promise<Message[]> {
  await delay(150);
  return mockMessages
    .filter((m) => m.patientId === patientId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export async function sendPatientMessage(params: {
  patientId: string;
  supervisorId: string;
  content: string;
}): Promise<Message> {
  await delay(200);
  const newMessage: Message = {
    id: `msg-${Date.now()}`,
    senderRole: 'patient',
    patientId: params.patientId,
    supervisorId: params.supervisorId,
    content: params.content,
    timestamp: new Date().toISOString()
  };
  mockMessages.push(newMessage);
  return newMessage;
}

export async function getAssignedSupervisor(supervisorId: string = 'sup-1'): Promise<Supervisor | undefined> {
  await delay(100);
  return mockSupervisors.find((s) => s.id === supervisorId);
}

export async function getPatientTrendPoints(patientId: string = 'pat-1'): Promise<TrendPoint[]> {
  await delay(150);
  const points = mockTrendPoints[patientId] || [];
  return [...points];
}

export async function getPatientSupervisorActions(patientId: string = 'pat-1'): Promise<SupervisorActionRecord[]> {
  await delay(120);
  return mockSupervisorActions
    .filter((a) => a.patientId === patientId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function requestAppointmentAsPatient(params: {
  patientId: string;
  preferredTime: string;
  note?: string;
}): Promise<SupervisorActionRecord> {
  await delay(200);
  const newAction: SupervisorActionRecord = {
    id: `act-${Date.now()}`,
    patientId: params.patientId,
    type: 'appointment_request',
    status: 'Student requested appointment',
    details: `Preferred time: ${params.preferredTime}${params.note ? ` · Note: ${params.note}` : ''}`,
    timestamp: new Date().toISOString()
  };
  mockSupervisorActions.unshift(newAction);
  return newAction;
}

