import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import ProtectedRoute from '@/components/common/ProtectedRoute';

import LandingPage from '@/pages/public/LandingPage';
import AboutPage from '@/pages/public/AboutPage';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';

import DonorDashboard from '@/pages/donor/DonorDashboard';
import CreateDonation from '@/pages/donor/CreateDonation';
import MyDonations from '@/pages/donor/MyDonations';
import DonationDetails from '@/pages/donor/DonationDetails';

import NgoDashboard from '@/pages/ngo/NgoDashboard';
import AvailableFood from '@/pages/ngo/AvailableFood';
import FoodDetails from '@/pages/ngo/FoodDetails';
import MyRequests from '@/pages/ngo/MyRequests';

import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminDonations from '@/pages/admin/AdminDonations';

import ProfilePage from '@/pages/ProfilePage';
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
       <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/about" element={<AboutPage />} />

            {/* Auth */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected — role-aware dashboard */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <RoleDashboard />
                </ProtectedRoute>
              }
            />

            {/* Donor routes */}
            <Route
              path="/create-donation"
              element={
                <ProtectedRoute roles={['donor']}>
                  <CreateDonation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-donations"
              element={
                <ProtectedRoute roles={['donor']}>
                  <MyDonations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/donations/:id"
              element={
                <ProtectedRoute roles={['donor', 'admin']}>
                  <DonationDetails />
                </ProtectedRoute>
              }
            />

            {/* NGO routes */}
            <Route
              path="/available-food"
              element={
                <ProtectedRoute roles={['ngo']}>
                  <AvailableFood />
                </ProtectedRoute>
              }
            />
            <Route
              path="/food/:id"
              element={
                <ProtectedRoute roles={['ngo']}>
                  <FoodDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-requests"
              element={
                <ProtectedRoute roles={['ngo']}>
                  <MyRequests />
                </ProtectedRoute>
              }
            />

            {/* Admin routes */}
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute roles={['admin']}>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/donations"
              element={
                <ProtectedRoute roles={['admin']}>
                  <AdminDonations />
                </ProtectedRoute>
              }
            />

            {/* Shared */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function RoleDashboard() {
  const { user } = useAuth();
  if (!user) return null;
  switch (user.role) {
    case 'donor':
      return <DonorDashboard />;
    case 'ngo':
      return <NgoDashboard />;
    case 'admin':
      return <AdminDashboard />;
    default:
      return <Navigate to="/" replace />;
  }
}
