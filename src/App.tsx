/**
 * STILL-care Main Application & Route Configuration
 *
 * Configures React Router with the approved route structure,
 * dual Patient and Supervisor layouts, and Hackathon Judge perspective switch.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { JudgeDemoBar } from './components/demo/JudgeDemoBar';

// Layouts
import PatientLayout from './layouts/PatientLayout';
import SupervisorLayout from './layouts/SupervisorLayout';

// Auth
import LoginPage from './pages/auth/LoginPage';

// Patient Pages
import PatientDashboardPage from './pages/patient/DashboardPage';
import NewCheckInPage from './pages/patient/NewCheckInPage';
import ConversationPage from './pages/patient/ConversationPage';
import HistoryPage from './pages/patient/HistoryPage';
import ReportsPage from './pages/patient/ReportsPage';
import SupervisorConnectionPage from './pages/patient/SupervisorConnectionPage';
import PatientMessagesPage from './pages/patient/MessagesPage';
import PatientProfilePage from './pages/patient/ProfilePage';

// Supervisor Pages
import SupervisorVerificationPage from './pages/supervisor/VerificationPage';
import SupervisorDashboardPage from './pages/supervisor/DashboardPage';
import PatientListPage from './pages/supervisor/PatientListPage';
import PatientDetailPage from './pages/supervisor/PatientDetailPage';
import SessionSummariesPage from './pages/supervisor/SessionSummariesPage';
import SupervisorTrendsPage from './pages/supervisor/TrendsPage';
import SupervisorAlertsPage from './pages/supervisor/AlertsPage';
import SupervisorRecommendationsPage from './pages/supervisor/RecommendationsPage';
import SupervisorMessagesPage from './pages/supervisor/MessagesPage';
import SupervisorProfilePage from './pages/supervisor/ProfilePage';

export default function App() {
  return (
    <BrowserRouter>
      {/* Floating Demo Perspective Switcher for Hackathon Judges */}
      <JudgeDemoBar />

      <Routes>
        {/* Default Landing: Redirect to Patient Dashboard */}
        <Route path="/" element={<Navigate to="/patient/dashboard" replace />} />

        {/* Unified Authentication Portal */}
        <Route path="/login" element={<LoginPage />} />

        {/* Patient Experience Routes */}
        <Route path="/patient" element={<PatientLayout />}>
          <Route index element={<Navigate to="/patient/dashboard" replace />} />
          <Route path="login" element={<Navigate to="/login?role=student" replace />} />
          <Route path="dashboard" element={<PatientDashboardPage />} />
          <Route path="checkin/new" element={<NewCheckInPage />} />
          <Route path="checkin/conversation" element={<ConversationPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="supervisor" element={<SupervisorConnectionPage />} />
          <Route path="messages" element={<PatientMessagesPage />} />
          <Route path="profile" element={<PatientProfilePage />} />
        </Route>

        {/* Supervisor Experience Routes */}
        <Route path="/supervisor" element={<SupervisorLayout />}>
          <Route index element={<Navigate to="/supervisor/dashboard" replace />} />
          <Route path="dashboard" element={<SupervisorDashboardPage />} />
          <Route path="login" element={<Navigate to="/login?role=counselor" replace />} />
          <Route path="verification" element={<SupervisorVerificationPage />} />
          <Route path="patients" element={<PatientListPage />} />
          <Route path="patients/:id" element={<PatientDetailPage />} />
          <Route path="patient/:id" element={<PatientDetailPage />} />
          <Route path="patients/:id/summaries" element={<SessionSummariesPage />} />
          <Route path="patient/:id/summaries" element={<SessionSummariesPage />} />
          <Route path="patients/:id/trends" element={<SupervisorTrendsPage />} />
          <Route path="patient/:id/trends" element={<SupervisorTrendsPage />} />
          <Route path="alerts" element={<SupervisorAlertsPage />} />
          <Route path="recommendations" element={<SupervisorRecommendationsPage />} />
          <Route path="messages" element={<SupervisorMessagesPage />} />
          <Route path="patient/:id/messages" element={<SupervisorMessagesPage />} />
          <Route path="patients/:id/messages" element={<SupervisorMessagesPage />} />
          <Route path="profile" element={<SupervisorProfilePage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/patient/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
