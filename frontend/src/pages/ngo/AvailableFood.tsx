import { useEffect, useState } from 'react';
import { ShoppingBag, Filter } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DonationCard from '@/components/donation/DonationCard';
import Select from '@/components/common/Select';
import Input from '@/components/common/Input';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/common/LoadingSpinner';
import { donationService } from '@/services/services';
import { FOOD_CATEGORIES } from '@/types';
import type { Donation } from '@/types';

export default function AvailableFood() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  useEffect(() => {
    donationService
      .getAll()
      .then((data) => setDonations(data.filter((d) => d.status === 'available' || d.status === 'pending')))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = donations.filter((d) => {
    if (categoryFilter && d.category !== categoryFilter) return false;
    if (locationFilter && !d.location.toLowerCase().includes(locationFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Available Food</h1>
        <p className="text-gray-500 mt-1">Browse surplus food donations available for request.</p>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
          <Filter className="w-4 h-4" /> Filters
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Select
            label="Food Category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {FOOD_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </Select>
          <Input
            label="Location"
            placeholder="Search by location..."
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading available food..." />
      ) : error ? (
        <ErrorState message="Failed to load donations. Please try again." onRetry={() => window.location.reload()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No donations available right now"
          message="Try adjusting your filters or check back later for new donations."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((d) => (
            <DonationCard key={d.id} donation={d} linkTo={`/food/${d.id}`} showDonor actionLabel="View Details" />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
