import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Clock, CheckCircle2, AlertCircle, Plus, Heart } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DashboardCard from '@/components/donation/DashboardCard';
import DonationCard from '@/components/donation/DonationCard';

import { LoadingSpinner, EmptyState, ErrorState } from '@/components/common/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';
import { donationService } from '@/services/services';
import type { Donation } from '@/types';

export default function DonorDashboard() {
  const { user } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    donationService
      .getByDonor(user.id)
      .then((data) => setDonations(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [user]);

  const total = donations.length;
  const active = donations.filter((d) => d.status === 'available' || d.status === 'pending' || d.status === 'accepted').length;
  const completed = donations.filter((d) => d.status === 'completed').length;
  const pendingRequests = donations.filter((d) => d.status === 'pending').length;
  const recent = donations.slice(0, 3);

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.name.split(' ')[0]}!
          </h1>
          <p className="text-gray-500 mt-1">Here's an overview of your food donations.</p>
        </div>
        <Link to="/create-donation" className="btn-primary">
          <Plus className="w-5 h-5" /> Donate Food
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <DashboardCard icon={<Package className="w-6 h-6" />} label="Total Donations" value={total} color="primary" />
        <DashboardCard icon={<Clock className="w-6 h-6" />} label="Active Donations" value={active} color="blue" />
        <DashboardCard icon={<CheckCircle2 className="w-6 h-6" />} label="Completed" value={completed} color="gray" />
        <DashboardCard icon={<AlertCircle className="w-6 h-6" />} label="Pending Requests" value={pendingRequests} color="amber" />
      </div>

      {/* Recent Donations */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Recent Donations</h2>
        <Link to="/my-donations" className="text-sm font-medium text-primary-600 hover:text-primary-700">
          View All
        </Link>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading donations..." />
      ) : error ? (
        <ErrorState message="Failed to load your donations. Please try again." onRetry={() => window.location.reload()} />
      ) : recent.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No donations yet"
          message="Start by posting your first surplus food donation."
          action={<Link to="/create-donation" className="btn-primary"><Plus className="w-5 h-5" /> Donate Food</Link>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {recent.map((d) => (
            <DonationCard key={d.id} donation={d} linkTo={`/donations/${d.id}`} />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
