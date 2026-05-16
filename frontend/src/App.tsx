import { Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { DonorPortalLayout } from './layouts/DonorPortalLayout';
import { HospitalPortalLayout } from './layouts/HospitalPortalLayout';
import { AdminPortalLayout } from './layouts/AdminPortalLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import LoginPage from './pages/LoginPage';
import DonorRegisterPage from './pages/DonorRegisterPage';
import HospitalRegisterPage from './pages/HospitalRegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
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
import DonorCardPage from './pages/DonorCardPage';
import EligibilityPage from './pages/EligibilityPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import AvailabilityStatusPage from './pages/AvailabilityStatusPage';
import NearbyCentersPage from './pages/NearbyCentersPage';
import RewardsPage from './pages/RewardsPage';
import HealthEligibilityFormPage from './pages/HealthEligibilityFormPage';
import SupportHelpPage from './pages/SupportHelpPage';
import HospitalDashboardPage from './pages/HospitalDashboardPage';
import HospitalInventoryPage from './pages/HospitalInventoryPage';
import HospitalRequestBloodPage from './pages/HospitalRequestBloodPage';
import HospitalActiveRequestsPage from './pages/HospitalActiveRequestsPage';
import HospitalDonorSearchPage from './pages/HospitalDonorSearchPage';
import HospitalAppointmentsPage from './pages/HospitalAppointmentsPage';
import HospitalNotificationsPage from './pages/HospitalNotificationsPage';
import HospitalReportsPage from './pages/HospitalReportsPage';
import HospitalEmergencyRequestsPage from './pages/HospitalEmergencyRequestsPage';
import HospitalStaffManagementPage from './pages/HospitalStaffManagementPage';
import HospitalProfilePage from './pages/HospitalProfilePage';
import HospitalSettingsPage from './pages/HospitalSettingsPage';
import HospitalSupportPage from './pages/HospitalSupportPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import PublicEligibilityPage from './pages/PublicEligibilityPage';
import PublicEmergencyRequestsPage from './pages/PublicEmergencyRequestsPage';
import FAQPage from './pages/FAQPage';
import WebsiteManagementPage from './pages/WebsiteManagementPage';
import { ADMIN_PORTAL_ROLES, HOSPITAL_PORTAL_ROLES } from './types/auth';
import { AppErrorBoundary } from './components/AppErrorBoundary';

function App() {
  return (
    <AppErrorBoundary>
      <Routes>
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route path="/admin-login" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/donor-login" element={<Navigate to="/login" replace />} />
        <Route path="/hospital-login" element={<Navigate to="/login" replace />} />
        <Route path="/register" element={<Navigate to="/donor-register" replace />} />

        <Route element={<ProtectedRoute roles={ADMIN_PORTAL_ROLES} />}>
          <Route path="/admin" element={<AdminPortalLayout />}>
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="website-management" element={<WebsiteManagementPage />} />
            <Route path="management" element={<AdminManagementPage />} />
          </Route>
        </Route>

        <Route element={<MainLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/donor-register" element={<DonorRegisterPage />} />
          <Route path="/hospital-register" element={<HospitalRegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/request" element={<RequestPage />} />
          <Route path="/how-it-works" element={<HowToDonatePage />} />
          <Route path="/how-to-donate" element={<Navigate to="/how-it-works" replace />} />
          <Route path="/blood-eligibility" element={<PublicEligibilityPage />} />
          <Route path="/emergency-requests" element={<PublicEmergencyRequestsPage />} />
          <Route path="/nearby-centers" element={<NearbyCentersPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/dashboard/donor" element={<Navigate to="/donor/dashboard" replace />} />
          <Route path="/dashboard/hospital" element={<Navigate to="/hospital/dashboard" replace />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
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
              <Route path="card" element={<DonorCardPage />} />
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

          <Route element={<ProtectedRoute roles={HOSPITAL_PORTAL_ROLES} />}>
            <Route path="/hospital" element={<HospitalPortalLayout />}>
              <Route path="dashboard" element={<HospitalDashboardPage />} />
              <Route path="inventory" element={<HospitalInventoryPage />} />
              <Route path="request-blood" element={<HospitalRequestBloodPage />} />
              <Route path="active-requests" element={<HospitalActiveRequestsPage />} />
              <Route path="donor-search" element={<HospitalDonorSearchPage />} />
              <Route path="appointments" element={<HospitalAppointmentsPage />} />
              <Route path="notifications" element={<HospitalNotificationsPage />} />
              <Route path="reports" element={<HospitalReportsPage />} />
              <Route path="emergency-requests" element={<HospitalEmergencyRequestsPage />} />
              <Route path="staff" element={<HospitalStaffManagementPage />} />
              <Route path="profile" element={<HospitalProfilePage />} />
              <Route path="settings" element={<HospitalSettingsPage />} />
              <Route path="support" element={<HospitalSupportPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AppErrorBoundary>
  );
}

export default App;