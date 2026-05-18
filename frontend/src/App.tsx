import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { DonorPortalLayout } from './layouts/DonorPortalLayout';
import { HospitalPortalLayout } from './layouts/HospitalPortalLayout';
import { AdminPortalLayout } from './layouts/AdminPortalLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ADMIN_PORTAL_ROLES, HOSPITAL_PORTAL_ROLES } from './types/auth';
import { AppErrorBoundary } from './components/AppErrorBoundary';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DonorRegisterPage = lazy(() => import('./pages/DonorRegisterPage'));
const HospitalRegisterPage = lazy(() => import('./pages/HospitalRegisterPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const RequestPage = lazy(() => import('./pages/RequestPage'));
const HowToDonatePage = lazy(() => import('./pages/HowToDonatePage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const EmergencyRequestsPage = lazy(() => import('./pages/EmergencyRequestsPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AdminManagementPage = lazy(() => import('./pages/AdminManagementPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const DonorDashboardPage = lazy(() => import('./pages/DonorDashboardPage'));
const DonorCardPage = lazy(() => import('./pages/DonorCardPage'));
const EligibilityPage = lazy(() => import('./pages/EligibilityPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AvailabilityStatusPage = lazy(() => import('./pages/AvailabilityStatusPage'));
const NearbyCentersPage = lazy(() => import('./pages/NearbyCentersPage'));
const RewardsPage = lazy(() => import('./pages/RewardsPage'));
const HealthEligibilityFormPage = lazy(() => import('./pages/HealthEligibilityFormPage'));
const SupportHelpPage = lazy(() => import('./pages/SupportHelpPage'));
const HospitalDashboardPage = lazy(() => import('./pages/HospitalDashboardPage'));
const HospitalInventoryPage = lazy(() => import('./pages/HospitalInventoryPage'));
const HospitalRequestBloodPage = lazy(() => import('./pages/HospitalRequestBloodPage'));
const HospitalActiveRequestsPage = lazy(() => import('./pages/HospitalActiveRequestsPage'));
const HospitalDonorSearchPage = lazy(() => import('./pages/HospitalDonorSearchPage'));
const HospitalAppointmentsPage = lazy(() => import('./pages/HospitalAppointmentsPage'));
const HospitalNotificationsPage = lazy(() => import('./pages/HospitalNotificationsPage'));
const HospitalReportsPage = lazy(() => import('./pages/HospitalReportsPage'));
const HospitalEmergencyRequestsPage = lazy(() => import('./pages/HospitalEmergencyRequestsPage'));
const HospitalStaffManagementPage = lazy(() => import('./pages/HospitalStaffManagementPage'));
const HospitalProfilePage = lazy(() => import('./pages/HospitalProfilePage'));
const HospitalSettingsPage = lazy(() => import('./pages/HospitalSettingsPage'));
const HospitalSupportPage = lazy(() => import('./pages/HospitalSupportPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const PublicEligibilityPage = lazy(() => import('./pages/PublicEligibilityPage'));
const PublicEmergencyRequestsPage = lazy(() => import('./pages/PublicEmergencyRequestsPage'));
const FAQPage = lazy(() => import('./pages/FAQPage'));
const WebsiteManagementPage = lazy(() => import('./pages/WebsiteManagementPage'));
const LiveMapPage = lazy(() => import('./pages/LiveMapPage'));
const DonorLiveLocationPage = lazy(() => import('./pages/DonorLiveLocationPage'));
const DonorClinicalReviewQueuePage = lazy(() => import('./pages/DonorClinicalReviewQueuePage'));

function RouteLoading() {
  return (
    <div className="min-h-[55vh] w-full px-6 py-12">
      <div className="mx-auto flex max-w-md items-center gap-4 rounded-3xl border border-red-100 bg-white p-6 shadow-lg shadow-red-950/5">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-100 border-t-red-600" />
        <div>
          <p className="font-semibold text-slate-900">Loading secure workspace</p>
          <p className="text-sm text-slate-500">Preparing the page safely...</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <Suspense fallback={<RouteLoading />}>
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
            <Route path="live-map" element={<LiveMapPage />} />
            <Route path="donor-clinical-reviews" element={<DonorClinicalReviewQueuePage />} />
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
            <Route path="live-location" element={<DonorLiveLocationPage />} />
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
            <Route path="donor-reviews" element={<DonorClinicalReviewQueuePage />} />
            <Route path="live-map" element={<LiveMapPage />} />
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
      </Suspense>
    </AppErrorBoundary>
  );
}

export default App;
