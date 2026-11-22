import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ProfilePage from './profiles/ProfilePage';
import ConsultantDashboard from './consultant/ConsultantDashboard';
import PatientLayout from './components/dashboard/PatientLayout';
import DashboardPage from './pages/patient/DashboardPage';
import { ConsultantPage, NewSessionPage } from './pages/patient/PatientPages';

export default function App() {
  return <BrowserRouter><AuthProvider>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/patient/login" element={<Navigate to="/login?role=patient" replace />} />
      <Route path="/supervisor/login" element={<Navigate to="/login?role=supervisor" replace />} />
      <Route path="/patient/profile" element={<ProfilePage role="patient" />} />
      <Route path="/supervisor/profile" element={<ProfilePage role="consultant" />} />
      <Route path="/patient" element={<PatientLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="dashboard" element={<Navigate to="/patient" replace />} />
        <Route path="consultant" element={<ConsultantPage />} />
        <Route path="session/new" element={<NewSessionPage />} />
        <Route path="*" element={<Navigate to="/patient" replace />} />
      </Route>
      <Route path="/supervisor/*" element={<ConsultantDashboard />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  </AuthProvider></BrowserRouter>;
}
