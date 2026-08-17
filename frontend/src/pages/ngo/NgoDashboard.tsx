import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ClipboardList, CheckCircle2, Package, ArrowRight } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DashboardCard from '@/components/donation/DashboardCard';
import DonationCard from '@/components/donation/DonationCard';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/common/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';
import { donationService, requestService } from '@/services/services';
import type { Donation, DonationRequest } from '@/types';

export default function NgoDashboard() {
  const { user } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [myRequests, setMyRequests] = useState<DonationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([donationService.getAll(), requestService.getByNGO(user.id)])
      .then(([d, r]) => {
        setDonations(d);
        setMyRequests(r);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [user]);

  const availableCount = donations.filter((d) => d.status === 'available').length;
  const myRequestsCount = myRequests.filter((r) => r.status === 'pending').length;
  const acceptedCount = myRequests.filter((r) => r.status === 'accepted').length;
  const completedCount = myRequests.filter((r) => r.status === 'completed').length;
  const recentAvailable = donations.filter((d) => d.status === 'available').slice(0, 3);

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.name.split(' ')[0]}!
        </h1>
        <p className="text-gray-500 mt-1">Here's an overview of food available and your requests.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <DashboardCard icon={<ShoppingBag className="w-6 h-6" />} label="Available Donations" value={availableCount} color="primary" />
        <DashboardCard icon={<ClipboardList className="w-6 h-6" />} label="My Requests" value={myRequestsCount} color="amber" />
        <DashboardCard icon={<Package className="w-6 h-6" />} label="Accepted Donations" value={acceptedCount} color="blue" />
        <DashboardCard icon={<CheckCircle2 className="w-6 h-6" />} label="Completed Pickups" value={completedCount} color="gray" />
      </div>

      {/* Recent Available */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Recently Available</h2>
        <Link to="/available-food" className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1">
          View All <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading..." />
      ) : error ? (
        <ErrorState message="Failed to load dashboard data. Please try again." onRetry={() => window.location.reload()} />
      ) : recentAvailable.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No food available right now" message="Check back later for new donations." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {recentAvailable.map((d) => (
            <DonationCard key={d.id} donation={d} linkTo={`/food/${d.id}`} showDonor actionLabel="View Details" />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
