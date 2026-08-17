import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Plus } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DonationCard from '@/components/donation/DonationCard';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/common/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';
import { donationService } from '@/services/services';
import type { Donation } from '@/types';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'pending', label: 'Request Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'completed', label: 'Completed' },
  { value: 'expired', label: 'Expired' },
];

export default function MyDonations() {
  const { user } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!user) return;
    donationService
      .getByDonor(user.id)
      .then((data) => setDonations(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = filter === 'all' ? donations : donations.filter((d) => d.status === filter);

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Donations</h1>
          <p className="text-gray-500 mt-1">Manage all the food you've donated.</p>
        </div>
        <Link to="/create-donation" className="btn-primary">
          <Plus className="w-5 h-5" /> Donate Food
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filter === f.value ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner label="Loading donations..." />
      ) : error ? (
        <ErrorState message="Failed to load your donations. Please try again." onRetry={() => window.location.reload()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No donations found"
          message={filter === 'all' ? "You haven't posted any donations yet." : `No ${filter} donations at the moment.`}
          action={filter === 'all' ? <Link to="/create-donation" className="btn-primary"><Plus className="w-5 h-5" /> Donate Food</Link> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((d) => (
            <DonationCard key={d.id} donation={d} linkTo={`/donations/${d.id}`} />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
