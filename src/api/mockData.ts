/**
 * STILL-care Realistic Fictional Mock Database
 *
 * All records are entirely fictional and designed for hackathon demonstration.
 * No clinical diagnoses or numerical medical scores are used.
 */

import {
  Patient,
  Supervisor,
  CheckInSession,
  TrendPoint,
  AlertItem,
  RecommendationItem,
  Message
} from '../types';

export const mockSupervisors: Supervisor[] = [
  {
    id: 'sup-1',
    name: 'Dr. Meera Iyer',
    title: 'Supervising Counselor',
    organization: 'Campus Wellbeing & Counseling Services',
    verificationStatus: 'verified'
  }
];

export const mockPatients: Patient[] = [
  {
    id: 'pat-1',
    name: 'Ananya Sharma',
    assignedSupervisorId: 'sup-1',
    lastCheckInDate: '2026-09-02',
    currentRiskLevel: 'yellow',
    distressTrend: 'worsening'
  },
  {
    id: 'pat-2',
    name: 'Marcus Vance',
    assignedSupervisorId: 'sup-1',
    lastCheckInDate: '2026-09-01',
    currentRiskLevel: 'red',
    distressTrend: 'worsening'
  },
  {
    id: 'pat-3',
    name: 'Elena Rostova',
    assignedSupervisorId: 'sup-1',
    lastCheckInDate: '2026-09-02',
    currentRiskLevel: 'green',
    distressTrend: 'improving'
  },
  {
    id: 'pat-4',
    name: 'David Kim',
    assignedSupervisorId: 'sup-1',
    lastCheckInDate: '2026-08-30',
    currentRiskLevel: 'green',
    distressTrend: 'improving'
  }
];

export const mockCheckInSessions: CheckInSession[] = [
  // Ananya Sharma's longitudinal check-in sessions
  {
    id: 'session-101',
    patientId: 'pat-1',
    date: '2026-08-20',
    mode: 'text',
    summary: 'Patient shared that work projects are progressing steadily. Feeling generally centered.',
    plainLanguageReason: 'Positive tone and steady daily routines mentioned throughout check-in.',
    riskLevel: 'green',
    distressTrend: 'improving',
    transcript: 'Had a fairly good day today. Managed to get out for a walk during lunch and finished my project report.'
  },
  {
    id: 'session-102',
    patientId: 'pat-1',
    date: '2026-08-24',
    mode: 'voice',
    summary: 'Reported occasional restless nights and mild deadline pressure, but coping well overall.',
    plainLanguageReason: 'Minor mentions of upcoming work stress, balanced with positive outlook.',
    riskLevel: 'green',
    distressTrend: 'improving',
    transcript: 'Things are getting a bit busier with end of month deadlines. Felt a little restless last night but feeling okay now.'
  },
  {
    id: 'session-103',
    patientId: 'pat-1',
    date: '2026-08-28',
    mode: 'text',
    summary: 'Noticed recurring difficulty unwinding in the evening. Workload feels increasingly heavy.',
    plainLanguageReason: 'Emerging stress indicators and recurring difficulty disconnecting from responsibilities.',
    riskLevel: 'yellow',
    distressTrend: 'worsening',
    transcript: 'I have not been able to disconnect this week. Every evening feels packed with lingering worry about what is next.'
  },
  {
    id: 'session-104',
    patientId: 'pat-1',
    date: '2026-09-02',
    mode: 'voice',
    summary: 'Reported persistent overwhelm and fatigue over the past four days. Expressed feeling behind.',
    plainLanguageReason: 'Persistent fatigue and feelings of cognitive overwhelm spanning consecutive days.',
    riskLevel: 'yellow',
    distressTrend: 'worsening',
    transcript: 'I feel completely exhausted. It feels like every time I solve one problem, three more appear and I can barely keep up.'
  },

  // Marcus Vance's sessions
  {
    id: 'session-201',
    patientId: 'pat-2',
    date: '2026-08-26',
    mode: 'text',
    summary: 'Reported significant social withdrawal and cancellation of usual weekly activities.',
    plainLanguageReason: 'Repeated language of isolation and giving up on personal routines.',
    riskLevel: 'yellow',
    distressTrend: 'worsening',
    transcript: 'Did not go to my group meetup. Just stayed home with curtains drawn.'
  },
  {
    id: 'session-202',
    patientId: 'pat-2',
    date: '2026-09-01',
    mode: 'voice',
    summary: 'Expressed profound sense of helplessness and lack of motivation to continue current efforts.',
    plainLanguageReason: 'Escalating distress themes and expressed loss of agency over daily situations.',
    riskLevel: 'red',
    distressTrend: 'worsening',
    transcript: 'I honestly do not see the point in trying anymore. Everything feels like too much effort.'
  },

  // Elena Rostova's sessions
  {
    id: 'session-301',
    patientId: 'pat-3',
    date: '2026-08-29',
    mode: 'text',
    summary: 'Completed regular morning routine and spent time outdoors with family.',
    plainLanguageReason: 'Stable emotional grounding and active connection with support system.',
    riskLevel: 'green',
    distressTrend: 'improving',
    transcript: 'Spent a calm morning walking in the park. Feeling peaceful and grateful.'
  },
  {
    id: 'session-302',
    patientId: 'pat-3',
    date: '2026-09-02',
    mode: 'text',
    summary: 'Shared positive reflection on managing mid-week tasks with calmness.',
    plainLanguageReason: 'Continued stability and self-reported calm pacing.',
    riskLevel: 'green',
    distressTrend: 'improving',
    transcript: 'Handled a tricky conversation at work today without getting anxious. Feeling grounded.'
  },

  // David Kim's sessions
  {
    id: 'session-401',
    patientId: 'pat-4',
    date: '2026-08-18',
    mode: 'text',
    summary: 'Completed regular exercise routines and maintained steady class attendance.',
    plainLanguageReason: 'Positive mood, strong daily activity adherence, and calm disposition.',
    riskLevel: 'green',
    distressTrend: 'improving',
    transcript: 'Had soccer practice and finished lab assignments on time. Sleeping well.'
  },
  {
    id: 'session-402',
    patientId: 'pat-4',
    date: '2026-08-30',
    mode: 'voice',
    summary: 'Reported feeling steady with consistent routines and good social connections.',
    plainLanguageReason: 'Consistent coping mechanisms, positive outlook, and low perceived strain.',
    riskLevel: 'green',
    distressTrend: 'improving',
    transcript: 'Classes are going fine. Caught up with friends over the weekend. Feeling relaxed and on schedule.'
  }
];

export const mockTrendPoints: Record<string, TrendPoint[]> = {
  'pat-1': [
    { date: '08/20', checkInId: 'session-101', riskLevel: 'green', distressTrend: 'improving' },
    { date: '08/24', checkInId: 'session-102', riskLevel: 'green', distressTrend: 'improving' },
    { date: '08/28', checkInId: 'session-103', riskLevel: 'yellow', distressTrend: 'worsening' },
    { date: '09/02', checkInId: 'session-104', riskLevel: 'yellow', distressTrend: 'worsening' }
  ],
  'pat-2': [
    { date: '08/22', checkInId: 'session-200', riskLevel: 'green', distressTrend: 'improving' },
    { date: '08/26', checkInId: 'session-201', riskLevel: 'yellow', distressTrend: 'worsening' },
    { date: '09/01', checkInId: 'session-202', riskLevel: 'red', distressTrend: 'worsening' }
  ],
  'pat-3': [
    { date: '08/25', checkInId: 'session-300', riskLevel: 'yellow', distressTrend: 'improving' },
    { date: '08/29', checkInId: 'session-301', riskLevel: 'green', distressTrend: 'improving' },
    { date: '09/02', checkInId: 'session-302', riskLevel: 'green', distressTrend: 'improving' }
  ],
  'pat-4': [
    { date: '08/18', checkInId: 'session-401', riskLevel: 'green', distressTrend: 'improving' },
    { date: '08/30', checkInId: 'session-402', riskLevel: 'green', distressTrend: 'improving' }
  ]
};

export const mockAlerts: (AlertItem & { recurringThemes?: string[]; suggestedAction?: string })[] = [
  {
    id: 'alert-1',
    patientId: 'pat-2',
    patientName: 'Marcus Vance',
    date: '2026-09-01',
    riskLevel: 'red',
    distressTrend: 'worsening',
    reason: 'Escalation to elevated distress with expressed helplessness and routine withdrawal.',
    recurringThemes: ['social withdrawal', 'feelings of helplessness', 'cancellation of routines'],
    suggestedAction: 'Prioritize direct outreach call within 12 hours.',
    isRead: false
  },
  {
    id: 'alert-2',
    patientId: 'pat-1',
    patientName: 'Ananya Sharma',
    date: '2026-09-02',
    riskLevel: 'yellow',
    distressTrend: 'worsening',
    reason: 'Consecutive check-ins noting persistent overwhelm and difficulty unwinding.',
    recurringThemes: ['workload pressure', 'fatigue', 'difficulty unwinding'],
    suggestedAction: 'Consider a supportive check-in with the student.',
    isRead: false
  }
];

export const mockRecommendations: RecommendationItem[] = [
  {
    id: 'rec-1',
    patientId: 'pat-2',
    patientName: 'Marcus Vance',
    suggestedAction: 'Prioritize direct outreach call within 12 hours.',
    contextReason: 'Check-in indicates feelings of helplessness and isolation.',
    status: 'pending'
  },
  {
    id: 'rec-2',
    patientId: 'pat-1',
    patientName: 'Ananya Sharma',
    suggestedAction: 'Send supportive asynchronous message suggesting breathing check-in or brief chat.',
    contextReason: 'Emerging stress trajectory across two consecutive check-ins.',
    status: 'pending'
  },
  {
    id: 'rec-3',
    patientId: 'pat-1',
    patientName: 'Ananya Sharma',
    suggestedAction: 'Review recent check-in continuity before upcoming appointment.',
    contextReason: 'Workload strain referenced across recent voice and written reflections.',
    status: 'pending'
  },
  {
    id: 'rec-4',
    patientId: 'pat-3',
    patientName: 'Elena Rostova',
    suggestedAction: 'Continue monitoring upcoming reflections.',
    contextReason: 'Student is maintaining positive grounding and regular routines.',
    status: 'addressed'
  }
];

export const mockMessages: Message[] = [
  {
    id: 'msg-1',
    senderRole: 'supervisor',
    patientId: 'pat-1',
    supervisorId: 'sup-1',
    content: 'Hi Ananya, thank you for completing your check-ins this week. Remember that taking short pauses during the day can help ease the pressure.',
    timestamp: '2026-08-25T14:30:00Z'
  },
  {
    id: 'msg-2',
    senderRole: 'patient',
    patientId: 'pat-1',
    supervisorId: 'sup-1',
    content: 'Thank you Dr. Iyer. I appreciate the reminder. I will try to take a short walk around campus tomorrow.',
    timestamp: '2026-08-25T16:15:00Z'
  }
];

export interface MockActionRecord {
  id: string;
  patientId: string;
  type: 'reach_out' | 'supportive_message' | 'appointment_request';
  status: string;
  details?: string;
  timestamp: string;
}

export const mockSupervisorActions: MockActionRecord[] = [
  {
    id: 'act-1',
    patientId: 'pat-1',
    type: 'reach_out',
    status: 'Reached out to student',
    details: 'Called student phone; left gentle voicemail reminding about support services.',
    timestamp: '2026-08-26T10:00:00Z'
  }
];
