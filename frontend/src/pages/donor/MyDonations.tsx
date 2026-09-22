import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Plus, ArrowRight } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DonationCard from '@/components/donation/DonationCard';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/common/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';
import { donationService, offerService } from '@/services/services';
import type { Donation, DonationOffer } from '@/types';

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
  const [offers, setOffers] = useState<DonationOffer[]>([]);
  const [tab, setTab] = useState<'donations' | 'offers'>('donations');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!user) return;
    Promise.all([
      donationService.getByDonor(user.id),
      offerService.getMine(),
    ])
      .then(([donationData, offerData]) => {
        setDonations(donationData);
        setOffers(offerData);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [user]);

  const filteredDonations = filter === 'all' ? donations : donations.filter((d) => d.status === filter);
  const filteredOffers = offers.filter((offer) => filter === 'all' || offer.status === filter);

  const renderOfferAction = (offer: DonationOffer) => {
    if (offer.status === 'pending') {
      return (
        <div className="flex flex-col gap-2 text-left">
          <span className="text-xs font-medium text-amber-700">Pending</span>
          <Link to={`/offers/${offer.id}`} className="text-xs font-medium text-primary-700 hover:text-primary-800">View offer</Link>
        </div>
      );
    }

    if (offer.status === 'accepted') {
      return (
        <div className="flex flex-col gap-2 text-left">
          <span className="text-xs font-medium text-blue-700">Accepted</span>
          <Link to={`/offers/${offer.id}`} className="text-xs font-medium text-primary-700 hover:text-primary-800">View offer</Link>
        </div>
      );
    }

    if (offer.status === 'rejected') {
      return <span className="text-xs font-medium text-red-700">Rejected</span>;
    }

    if (offer.status === 'completed') {
      return <span className="text-xs font-medium text-gray-700">Completed</span>;
    }

    return <Link to={`/offers/${offer.id}`} className="text-xs font-medium text-primary-700 hover:text-primary-800">View offer</Link>;
  };

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

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        <button onClick={() => setTab('donations')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${tab === 'donations' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>Donations</button>
        <button onClick={() => setTab('offers')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${tab === 'offers' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>Offers Sent</button>
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
      ) : tab === 'donations' && filteredDonations.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No donations found"
          message={filter === 'all' ? "You haven't posted any donations yet." : `No ${filter} donations at the moment.`}
          action={filter === 'all' ? <Link to="/create-donation" className="btn-primary"><Plus className="w-5 h-5" /> Donate Food</Link> : undefined}
        />
      ) : tab === 'offers' && filteredOffers.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No offers sent"
          message={filter === 'all' ? "You haven't sent any Direct Offers to NGOs yet." : `No ${filter} Direct Offers at the moment.`}
          action={<Link to="/find-ngos" className="btn-primary">Browse NGOs</Link>}
        />
      ) : tab === 'donations' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDonations.map((d) => (
            <div key={d.id} className="relative">
              <DonationCard donation={d} linkTo={`/donations/${d.id}`} />
              {d.targetNgoId && <div className="absolute left-3 top-3 rounded-full bg-primary-600 px-2 py-1 text-xs font-semibold text-white">Direct Offer</div>}
              {d.targetNgoName && <p className="mt-1 text-xs text-primary-700">Offered to: {d.targetNgoName}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOffers.map((offer) => (
            <div key={offer.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Direct Offer</p>
                  <h3 className="mt-1 text-lg font-semibold text-gray-900">{offer.foodName}</h3>
                </div>
                <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-700">{offer.status}</span>
              </div>

              <div className="mt-4 space-y-2 text-sm text-gray-600">
                <p>To: {offer.ngoName || 'NGO'}</p>
                <p>{offer.category} · {offer.quantity}</p>
                <p>{new Date(offer.availableUntil).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <Link to={`/offers/${offer.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-800">
                  View offer <ArrowRight className="h-4 w-4" />
                </Link>
                {renderOfferAction(offer)}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
