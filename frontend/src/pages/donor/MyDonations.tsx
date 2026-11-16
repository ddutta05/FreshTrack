import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Package, Plus } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/common/StatusBadge';
import DonationCard from '@/components/donation/DonationCard';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/common/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';
import { donationService, offerService, requestService } from '@/services/services';
import type { Donation, DonationOffer, DonationRequest, DonationStatus, RequestStatus } from '@/types';

type DonationFilter = 'all' | 'requests-pending' | Exclude<DonationStatus, 'pending'>;

const DONATION_FILTERS: { value: DonationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'requests-pending', label: 'Request Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'completed', label: 'Completed' },
  { value: 'expired', label: 'Expired' },
];

const OFFER_FILTERS: { value: 'all' | RequestStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'completed', label: 'Completed' },
];

const PAGE_SIZE = 12;

function getRequestSummary(donation: Donation, requests: DonationRequest[]): string {
  const completedRequest = requests.find((request) => request.status === 'completed');
  if (donation.status === 'completed') {
    return `Completed${completedRequest?.ngoName ? ` · Received by ${completedRequest.ngoName}` : ''}`;
  }

  const acceptedRequest = requests.find((request) => request.status === 'accepted');
  if (donation.status === 'accepted') {
    return `Accepted${acceptedRequest?.ngoName ? ` · With ${acceptedRequest.ngoName}` : ''}`;
  }

  if (requests.length === 0) {
    return donation.status === 'expired' ? 'Expired · No incoming requests' : 'No incoming requests yet';
  }

  const attemptsByNgo = new Map<string, DonationRequest[]>();
  for (const request of requests) {
    const attempts = attemptsByNgo.get(request.ngoId) ?? [];
    attempts.push(request);
    attemptsByNgo.set(request.ngoId, attempts);
  }
  const previousAttempts = [...attemptsByNgo.values()].reduce(
    (total, attempts) => total + Math.max(attempts.length - 1, 0),
    0,
  );
  const pendingCount = requests.filter((request) => request.status === 'pending').length;
  const previousSummary = previousAttempts > 0
    ? ` · ${previousAttempts} previous ${previousAttempts === 1 ? 'attempt' : 'attempts'}`
    : '';

  if (donation.status === 'expired') {
    return `Expired · ${requests.length} ${requests.length === 1 ? 'request attempt' : 'request attempts'}`;
  }
  if (pendingCount > 0) {
    return `${pendingCount} pending ${pendingCount === 1 ? 'request' : 'requests'}${previousSummary}`;
  }

  return `No pending requests · ${requests.length} ${requests.length === 1 ? 'request attempt' : 'request attempts'}`;
}

export default function MyDonations() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [offers, setOffers] = useState<DonationOffer[]>([]);
  const [requests, setRequests] = useState<DonationRequest[]>([]);
  const [unlinkedRequestCount, setUnlinkedRequestCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const tab = searchParams.get('tab') === 'offers' ? 'offers' : 'donations';
  const requestedStatus = searchParams.get('status');
  const donationFilter: DonationFilter = searchParams.get('requests') === 'pending'
    ? 'requests-pending'
    : DONATION_FILTERS.some((filter) => (
      filter.value === requestedStatus
      && filter.value !== 'all'
      && filter.value !== 'requests-pending'
    ))
      ? requestedStatus as Exclude<DonationStatus, 'pending'>
      : 'all';
  const offerFilter = OFFER_FILTERS.some((filter) => filter.value === requestedStatus && filter.value !== 'all')
    ? requestedStatus as RequestStatus
    : 'all';
  const requestedPage = Math.max(1, Number(searchParams.get('page')) || 1);

  useEffect(() => {
    if (!searchParams.get('tab')) {
      setSearchParams({ tab: 'donations' }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      donationService.getByDonorAll(user.id),
      offerService.getMineAll(),
      requestService.getAllPages(),
    ])
      .then(([donationData, offerData, requestData]) => {
        const donationIds = new Set(donationData.map((donation) => donation.id));
        const donorRequests = requestData.filter(
          (request) => request.donorId === user.id && request.direction !== 'donor_offer',
        );
        setDonations(donationData);
        setOffers(offerData);
        setRequests(donorRequests.filter((request) => request.donationId && donationIds.has(request.donationId)));
        setUnlinkedRequestCount(donorRequests.filter(
          (request) => !request.donationId || !donationIds.has(request.donationId),
        ).length);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [user]);

  const requestsByDonation = useMemo(() => {
    const grouped = new Map<string, DonationRequest[]>();
    for (const request of requests) {
      if (!request.donationId) continue;
      const donationRequests = grouped.get(request.donationId) ?? [];
      donationRequests.push(request);
      grouped.set(request.donationId, donationRequests);
    }
    return grouped;
  }, [requests]);

  const donationsWithRequests = useMemo(
    () => donations.map((donation) => ({
      donation,
      requests: requestsByDonation.get(donation.id) ?? [],
    })),
    [donations, requestsByDonation],
  );
  const filteredDonations = useMemo(() => donationsWithRequests.filter(({ donation, requests: donationRequests }) => {
    if (donationFilter === 'all') return true;
    if (donationFilter === 'requests-pending') {
      return donationRequests.some((request) => request.status === 'pending');
    }
    return donation.status === donationFilter;
  }), [donationsWithRequests, donationFilter]);
  const filteredOffers = useMemo(
    () => offers.filter((offer) => offerFilter === 'all' || offer.status === offerFilter),
    [offers, offerFilter],
  );

  const currentItems = tab === 'donations' ? filteredDonations : filteredOffers;
  const pageCount = Math.max(1, Math.ceil(currentItems.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, pageCount);
  const pageDonations = tab === 'donations'
    ? filteredDonations.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    : [];
  const pageOffers = tab === 'offers'
    ? filteredOffers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    : [];

  useEffect(() => {
    if (requestedPage > pageCount) {
      updateSearchParams((params) => params.set('page', String(pageCount)));
    }
  }, [pageCount, requestedPage]);

  const updateSearchParams = (update: (params: URLSearchParams) => void) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      update(next);
      return next;
    }, { replace: true });
  };

  const selectTab = (nextTab: 'donations' | 'offers') => {
    setSearchParams(nextTab === 'donations' ? { tab: nextTab } : { tab: nextTab }, { replace: true });
  };

  const selectDonationFilter = (value: DonationFilter) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('tab', 'donations');
      next.delete('status');
      next.delete('page');
      if (value === 'requests-pending') next.set('requests', 'pending');
      else {
        next.delete('requests');
        if (value !== 'all') next.set('status', value);
      }
      return next;
    }, { replace: true });
  };

  const selectOfferFilter = (value: typeof OFFER_FILTERS[number]['value']) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('tab', 'offers');
      next.delete('requests');
      next.delete('page');
      if (value === 'all') next.delete('status');
      else next.set('status', value);
      return next;
    }, { replace: true });
  };

  const selectPage = (page: number) => {
    updateSearchParams((params) => params.set('page', String(page)));
  };

  const returnTo = `${location.pathname}?${searchParams.toString()}`;
  const selectedDonationFilter = donationFilter;
  const selectedOfferFilter = offerFilter;
  const activeFilters = tab === 'donations' ? DONATION_FILTERS : OFFER_FILTERS;

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Donations</h1>
          <p className="text-gray-500 mt-1">Manage your food donations and Direct Offers sent to NGOs.</p>
        </div>
        <Link to="/create-donation" className="btn-primary">
          <Plus className="w-5 h-5" /> Donate Food
        </Link>
      </div>

      <div role="tablist" aria-label="Donation management sections" className="flex gap-2 mb-6 overflow-x-auto pb-1">
        <button type="button" role="tab" aria-selected={tab === 'donations'} onClick={() => selectTab('donations')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${tab === 'donations' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>Donations</button>
        <button type="button" role="tab" aria-selected={tab === 'offers'} onClick={() => selectTab('offers')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${tab === 'offers' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>Offers Sent</button>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {activeFilters.map((filter) => {
          const selected = tab === 'donations'
            ? filter.value === selectedDonationFilter
            : filter.value === selectedOfferFilter;
          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={selected}
              onClick={() => tab === 'donations'
                ? selectDonationFilter(filter.value as DonationFilter)
                : selectOfferFilter(filter.value as typeof OFFER_FILTERS[number]['value'])}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selected ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {unlinkedRequestCount > 0 && (
        <div role="alert" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {unlinkedRequestCount} incoming {unlinkedRequestCount === 1 ? 'request could' : 'requests could'} not be linked to an available donation and {unlinkedRequestCount === 1 ? 'is' : 'are'} not included in donation summaries.
        </div>
      )}

      {loading ? (
        <LoadingSpinner label={tab === 'donations' ? 'Loading donations...' : 'Loading offers...'} />
      ) : error ? (
        <ErrorState message="Failed to load your donations and offers. Please try again." onRetry={() => window.location.reload()} />
      ) : tab === 'donations' && filteredDonations.length === 0 ? (
        <EmptyState
          icon={Package}
          title={selectedDonationFilter === 'all' ? 'No donations found' : selectedDonationFilter === 'requests-pending' ? 'No pending incoming requests' : `No ${selectedDonationFilter} donations`}
          message={selectedDonationFilter === 'all' ? "You haven't posted any donations yet." : 'Try another filter or review all your donations.'}
          action={selectedDonationFilter === 'all' ? <Link to="/create-donation" className="btn-primary"><Plus className="w-5 h-5" /> Donate Food</Link> : undefined}
        />
      ) : tab === 'offers' && filteredOffers.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No Direct Offers sent"
          message={selectedOfferFilter === 'all' ? "You haven't sent any Direct Offers to NGOs yet." : `No ${selectedOfferFilter} Direct Offers at the moment.`}
          action={selectedOfferFilter === 'all' ? <Link to="/find-ngos" className="btn-primary">Browse NGOs</Link> : undefined}
        />
      ) : tab === 'donations' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {pageDonations.map(({ donation, requests: donationRequests }) => {
            const linkTo = `/donations/${donation.id}#incoming-requests`;
            return (
              <DonationCard
                key={donation.id}
                donation={donation}
                linkTo={linkTo}
                actionLabel={donationRequests.length > 0 ? 'Review Requests' : 'View Details'}
                requestSummary={getRequestSummary(donation, donationRequests)}
                returnTo={returnTo}
              />
            );
          })}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Offer</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">NGO</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Category · Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageOffers.map((offer) => (
                  <tr key={offer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{offer.foodName}</span>
                        <span className="text-xs text-gray-500">Direct Offer</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{offer.targetNgoName || offer.ngoName || 'NGO'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden sm:table-cell">{offer.category} · {offer.quantity}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden md:table-cell">{new Date(offer.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td className="px-6 py-4"><StatusBadge status={offer.status} type="request" /></td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/offers/${offer.id}`} state={{ returnTo }} className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">View Details</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && pageCount > 1 && (
        <nav aria-label="List pages" className="mt-6 flex items-center justify-center gap-3">
          <button type="button" className="btn-secondary" onClick={() => selectPage(currentPage - 1)} disabled={currentPage === 1}>Previous</button>
          <span className="text-sm text-gray-600">Page {currentPage} of {pageCount}</span>
          <button type="button" className="btn-secondary" onClick={() => selectPage(currentPage + 1)} disabled={currentPage === pageCount}>Next</button>
        </nav>
      )}
    </DashboardLayout>
  );
}
