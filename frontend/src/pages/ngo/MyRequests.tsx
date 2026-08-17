import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, CheckCircle2 } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/common/StatusBadge';
import Button from '@/components/common/Button';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/common/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { requestService } from '@/services/services';
import type { DonationRequest } from '@/types';

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
  const [requests, setRequests] = useState<DonationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    requestService
      .getByNGO(user.id)
      .then((data) => setRequests(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter);

  const handleComplete = async (requestId: string) => {
    setActionLoading(true);
    try {
      await requestService.complete(requestId);
      if (user) {
        const updated = await requestService.getByNGO(user.id);
        setRequests(updated);
      }
      toast('Pickup marked as complete!', 'success');
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
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No requests found"
          message={filter === 'all' ? "You haven't requested any donations yet." : `No ${filter} requests at the moment.`}
          action={<Link to="/available-food" className="btn-primary">Browse Available Food</Link>}
        />
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
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link to={`/food/${r.donationId}`} className="font-medium text-gray-900 hover:text-primary-600">
                        {r.donation?.foodName || 'Unknown'}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{r.donation?.donorName || 'Unknown'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden sm:table-cell">{r.donation?.quantity || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden md:table-cell">{r.donation?.location || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden lg:table-cell">
                      {new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={r.status} type="request" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      {r.status === 'accepted' && (
                        <Button size="sm" variant="success" onClick={() => handleComplete(r.id)} disabled={actionLoading}>
                          <CheckCircle2 className="w-4 h-4" /> Mark Pickup Complete
                        </Button>
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
