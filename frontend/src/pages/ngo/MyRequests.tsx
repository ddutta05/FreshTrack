import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardList, CheckCircle2, Check, X } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/common/StatusBadge';
import Button from '@/components/common/Button';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/common/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { offerService, requestService } from '@/services/services';
import type { DonationOffer, DonationRequest } from '@/types';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'completed', label: 'Completed' },
];

export default function MyRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState<DonationRequest[]>([]);
  const [offers, setOffers] = useState<DonationOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState<'requests' | 'offers'>(searchParams.get('tab') === 'offers' ? 'offers' : 'requests');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      requestService.getByNGO(user.id),
      offerService.getReceived(),
    ])
      .then(([requestData, offerData]) => {
        setRequests(requestData);
        setOffers(offerData);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [user]);

  const filteredRequests = filter === 'all' ? requests : requests.filter((r) => r.status === filter);
  const filteredOffers = filter === 'all' ? offers : offers.filter((offer) => offer.status === filter);

  const selectTab = (nextTab: 'requests' | 'offers') => {
    setTab(nextTab);
    if (nextTab === 'offers') setSearchParams({ tab: 'offers' });
    else setSearchParams({});
  };

  const renderRequestAction = (request: DonationRequest) => {
    if (request.status === 'pending') {
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-amber-700">Requested</span>
          {request.donationId && <Link to={`/food/${request.donationId}`} className="text-xs font-medium text-primary-700 hover:text-primary-800">View Donation</Link>}
        </div>
      );
    }

    if (request.status === 'accepted') {
      return (
        <div className="flex flex-col gap-2 text-left">
          <span className="text-xs font-medium text-blue-700">Accepted</span>
          <Button size="sm" variant="success" onClick={() => handleComplete(request.id)} disabled={actionLoading}><CheckCircle2 className="w-4 h-4" /> Mark Completed</Button>
        </div>
      );
    }

    if (request.status === 'rejected') {
      return <span className="text-xs font-medium text-red-700">Rejected</span>;
    }

    if (request.status === 'completed') {
      return <span className="text-xs font-medium text-gray-700">Completed</span>;
    }

    return <Link to={`/food/${request.donationId}`} className="text-xs font-medium text-primary-700 hover:text-primary-800">View Donation</Link>;
  };

  const renderOfferAction = (offer: DonationOffer) => {
    if (offer.status === 'pending') {
      return (
        <div className="flex gap-2">
          <Button size="sm" variant="success" onClick={() => handleOfferDecision(offer.id, 'accept')} disabled={actionLoading}><Check className="w-4 h-4" /> Accept</Button>
          <Button size="sm" variant="danger" onClick={() => handleOfferDecision(offer.id, 'reject')} disabled={actionLoading}><X className="w-4 h-4" /> Reject</Button>
        </div>
      );
    }

    if (offer.status === 'accepted') {
      return (
        <div className="flex flex-col gap-2 text-left">
          <span className="text-xs font-medium text-blue-700">Accepted</span>
          <Button size="sm" variant="success" onClick={() => handleOfferComplete(offer.id)} disabled={actionLoading}><CheckCircle2 className="w-4 h-4" /> Mark Completed</Button>
        </div>
      );
    }

    if (offer.status === 'rejected') {
      return <span className="text-xs font-medium text-red-700">Rejected</span>;
    }

    if (offer.status === 'completed') {
      return <span className="text-xs font-medium text-gray-700">Completed</span>;
    }

    return <Link to={`/offers/${offer.id}`} className="text-xs font-medium text-primary-700 hover:text-primary-800">View Offer</Link>;
  };

  const handleComplete = async (requestId: string) => {
    setActionLoading(true);
    try {
      await requestService.complete(requestId);
      if (user) {
        const updated = await requestService.getByNGO(user.id);
        setRequests(updated);
      }
      toast('Your completion was confirmed.', 'success');
    } catch {
      toast('Failed to complete pickup. Please try again.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecision = async (requestId: string, action: 'accept' | 'reject') => {
    setActionLoading(true);
    try {
      await (action === 'accept' ? requestService.accept(requestId) : requestService.reject(requestId));
      if (user) setRequests(await requestService.getByNGO(user.id));
      toast(action === 'accept' ? 'Offer accepted.' : 'Offer rejected.', 'success');
    } catch {
      toast('Unable to update this request.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOfferDecision = async (offerId: string, action: 'accept' | 'reject') => {
    setActionLoading(true);
    try {
      await (action === 'accept' ? offerService.accept(offerId) : offerService.reject(offerId));
      if (user) setOffers(await offerService.getReceived());
      toast(action === 'accept' ? 'Offer accepted.' : 'Offer rejected.', 'success');
    } catch {
      toast('Unable to update this offer.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOfferComplete = async (offerId: string) => {
    setActionLoading(true);
    try {
      await offerService.complete(offerId);
      if (user) setOffers(await offerService.getReceived());
      toast('Your completion was confirmed.', 'success');
    } catch {
      toast('Failed to complete pickup. Please try again.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Requests</h1>
        <p className="text-gray-500 mt-1">Track all the food donations you've requested.</p>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        <button onClick={() => selectTab('requests')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${tab === 'requests' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>Requests</button>
        <button onClick={() => selectTab('offers')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${tab === 'offers' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>Offers Received</button>
      </div>
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
        <LoadingSpinner label="Loading requests..." />
      ) : error ? (
        <ErrorState message="Failed to load your requests. Please try again." onRetry={() => window.location.reload()} />
      ) : tab === 'requests' && filteredRequests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No requests found"
          message={filter === 'all' ? "You haven't requested any donations yet." : `No ${filter} requests at the moment.`}
          action={<Link to="/available-food" className="btn-primary">Browse Available Food</Link>}
        />
      ) : tab === 'offers' && filteredOffers.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No offers received"
          message={filter === 'all' ? "You haven't received any Direct Offers yet." : `No ${filter} Direct Offers at the moment.`}
          action={<Link to="/available-food" className="btn-primary">Browse Available Food</Link>}
        />
      ) : tab === 'requests' ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Food</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Donor</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Request Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRequests.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link to={`/food/${r.donationId}`} className="font-medium text-gray-900 hover:text-primary-600">{r.donation?.foodName || 'Unknown'}</Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{r.donation?.donorName || 'Unknown'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden sm:table-cell">{r.donation?.quantity || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden md:table-cell">{r.donation?.location || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden lg:table-cell">{new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                    <td className="px-6 py-4"><StatusBadge status={r.status} type="request" /></td>
                    <td className="px-6 py-4 text-right">
                      {renderRequestAction(r)}
                      {r.contact && ['accepted', 'completed'].includes(r.status) && (
                        <p className="mt-2 text-xs text-gray-600">Contact & Handoff: {r.contact.donor?.name} {r.contact.donor?.phone || r.contact.donor?.email ? `· ${r.contact.donor.phone || r.contact.donor.email}` : ''}. {r.contact.handoffMessage}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Food</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Donor</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Request Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOffers.map((offer) => (
                  <tr key={offer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4"><Link to={`/offers/${offer.id}`} className="font-medium text-gray-900 hover:text-primary-600">{offer.foodName}</Link></td>
                    <td className="px-6 py-4 text-sm text-gray-600">{offer.donorName || 'Unknown'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden sm:table-cell">{offer.quantity || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden md:table-cell">{offer.location || 'Direct Offer'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden lg:table-cell">{new Date(offer.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                    <td className="px-6 py-4"><StatusBadge status={offer.status} type="request" /></td>
                    <td className="px-6 py-4 text-right">
                      {renderOfferAction(offer)}
                      {offer.contact && ['accepted', 'completed'].includes(offer.status) && (
                        <p className="mt-2 text-xs text-gray-600">Contact & Handoff: {offer.contact.donor?.name} {offer.contact.donor?.phone || offer.contact.donor?.email ? `· ${offer.contact.donor.phone || offer.contact.donor.email}` : ''}. {offer.contact.handoffMessage}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
