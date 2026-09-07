import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Package, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DashboardCard from '@/components/donation/DashboardCard';
import DonationCard from '@/components/donation/DonationCard';
import { LoadingSpinner, ErrorState } from '@/components/common/LoadingSpinner';
import { adminService } from '@/services/services';
import type { Donation } from '@/types';
import type { PlatformStats } from '@/services/services';

export default function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([adminService.getStats(), adminService.getDonations({ limit: 3 })])
      .then(([platformStats, d]) => {
        setStats(platformStats);
        setDonations(d);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const recentDonations = donations.slice(0, 3);

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingSpinner label="Loading dashboard..." />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <ErrorState message="Failed to load dashboard data. Please try again." onRetry={() => window.location.reload()} />
      </DashboardLayout>
    );
  }

  if (!stats) {
    return (
      <DashboardLayout>
        <ErrorState message="No stats available." onRetry={() => window.location.reload()} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Platform overview and management.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <DashboardCard icon={<Users className="w-6 h-6" />} label="Total Users" value={stats.totalUsers} color="primary" />
        <DashboardCard icon={<Package className="w-6 h-6" />} label="Total Donations" value={stats.totalDonations} color="blue" />
        <DashboardCard icon={<Clock className="w-6 h-6" />} label="Active Donations" value={stats.availableDonations + stats.pendingDonations + stats.acceptedDonations} color="amber" />
        <DashboardCard icon={<CheckCircle2 className="w-6 h-6" />} label="Completed" value={stats.completedDonations} color="gray" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="space-y-3">
            <Link to="/admin/users" className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Manage Users</p>
                  <p className="text-sm text-gray-500">View, disable, and manage accounts</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </Link>
            <Link to="/admin/donations" className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Manage Donations</p>
                  <p className="text-sm text-gray-500">View and remove inappropriate posts</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </Link>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Donations</h2>
            <Link to="/admin/donations" className="text-sm font-medium text-primary-600 hover:text-primary-700">
              View All
            </Link>
          </div>
          <div className="space-y-4">
            {recentDonations.map((d) => (
              <DonationCard key={d.id} donation={d} linkTo={`/admin/donations`} actionLabel="View" />
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
