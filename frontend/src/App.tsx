import { Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import DonorLoginPage from './pages/DonorLoginPage';
import HospitalLoginPage from './pages/HospitalLoginPage';
import DashboardPage from './pages/DashboardPage';
import EmergencyRequestsPage from './pages/EmergencyRequestsPage';
import InventoryPage from './pages/InventoryPage';
import AppointmentsPage from './pages/AppointmentsPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';
import AdminManagementPage from './pages/AdminManagementPage';
import ReportsPage from './pages/ReportsPage';

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/donor-login" element={<DonorLoginPage />} />
        <Route path="/hospital-login" element={<HospitalLoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/emergency-requests" element={<EmergencyRequestsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/reports" element={<ReportsPage />} />
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
