import { Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { DonorPortalLayout } from './layouts/DonorPortalLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import DonorLoginPage from './pages/DonorLoginPage';
import HospitalLoginPage from './pages/HospitalLoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import DonorRegisterPage from './pages/DonorRegisterPage';
import HospitalRegisterPage from './pages/HospitalRegisterPage';
import RequestPage from './pages/RequestPage';
import HowToDonatePage from './pages/HowToDonatePage';
import ContactPage from './pages/ContactPage';
import DashboardPage from './pages/DashboardPage';
import EmergencyRequestsPage from './pages/EmergencyRequestsPage';
import InventoryPage from './pages/InventoryPage';
import AppointmentsPage from './pages/AppointmentsPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';
import AdminManagementPage from './pages/AdminManagementPage';
import ReportsPage from './pages/ReportsPage';
import DonorDashboardPage from './pages/DonorDashboardPage';
import EligibilityPage from './pages/EligibilityPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import AvailabilityStatusPage from './pages/AvailabilityStatusPage';
import NearbyCentersPage from './pages/NearbyCentersPage';
import RewardsPage from './pages/RewardsPage';
import HealthEligibilityFormPage from './pages/HealthEligibilityFormPage';
import SupportHelpPage from './pages/SupportHelpPage';

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/donor-login" element={<DonorLoginPage />} />
        <Route path="/donor-register" element={<DonorRegisterPage />} />
        <Route path="/hospital-login" element={<HospitalLoginPage />} />
        <Route path="/hospital-register" element={<HospitalRegisterPage />} />
        <Route path="/admin-login" element={<AdminLoginPage />} />
        <Route path="/request" element={<RequestPage />} />
        <Route path="/how-to-donate" element={<HowToDonatePage />} />
        <Route path="/contact" element={<ContactPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/emergency-requests" element={<EmergencyRequestsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Route>

        <Route element={<ProtectedRoute roles={['DONOR']} />}>
          <Route path="/donor" element={<DonorPortalLayout />}>
            <Route path="dashboard" element={<DonorDashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="eligibility" element={<EligibilityPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="appointments" element={<AppointmentsPage />} />
            <Route path="emergency-requests" element={<EmergencyRequestsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="availability" element={<AvailabilityStatusPage />} />
            <Route path="nearby-centers" element={<NearbyCentersPage />} />
            <Route path="rewards" element={<RewardsPage />} />
            <Route path="health-form" element={<HealthEligibilityFormPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="support" element={<SupportHelpPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route path="/admin/management" element={<AdminManagementPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
