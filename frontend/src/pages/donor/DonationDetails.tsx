import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Calendar, Package, Tag, FileText, User, Check, X, CheckCircle2 } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/common/StatusBadge';
import Button from '@/components/common/Button';
import { LoadingSpinner, ErrorState } from '@/components/common/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { donationService, requestService } from '@/services/services';
import type { Donation, DonationRequest } from '@/types';
import { getDonationImageUrl } from '@/utils/image';
import { getCompletionMessage, getCompletionState } from '@/utils/workflow';

export default function DonationDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [donation, setDonation] = useState<Donation | null>(null);
  const [requests, setRequests] = useState<DonationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([donationService.getById(id), requestService.getByDonation(id)])
      .then(([d, r]) => {
        setDonation(d);
        setRequests(r);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAccept = async (requestId: string) => {
    setActionLoading(true);
    try {
      await requestService.accept(requestId);
      const updated = await requestService.getByDonation(id!);
      setRequests(updated);
      const updatedDonation = await donationService.getById(id!);
      setDonation(updatedDonation);
      toast('Request accepted! The NGO will be notified.', 'success');
    } catch {
      toast('Failed to accept request. Please try again.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (requestId: string) => {
    setActionLoading(true);
    try {
      await requestService.reject(requestId);
      const updated = await requestService.getByDonation(id!);
      setRequests(updated);
      const updatedDonation = await donationService.getById(id!);
      setDonation(updatedDonation);
      toast('Request rejected.', 'info');
    } catch {
      toast('Failed to reject request. Please try again.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    const acceptedRequest = requests.find((r) => r.status === 'accepted');
    if (!acceptedRequest) return;
    setActionLoading(true);
    try {
      await requestService.complete(acceptedRequest.id);
      const updatedDonation = await donationService.getById(id!);
      setDonation(updatedDonation);
      const updatedRequests = await requestService.getByDonation(id!);
      setRequests(updatedRequests);
      const updatedRequest = updatedRequests.find((request) => request.id === acceptedRequest.id);
      toast(updatedRequest?.status === 'completed' ? 'Completed' : 'Your completion confirmed. Waiting for the other party.', 'success');
    } catch {
      toast('Failed to complete donation. Please try again.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingSpinner label="Loading donation..." />
      </DashboardLayout>
    );
  }

  if (error || !donation) {
    return (
      <DashboardLayout>
        <ErrorState message="Donation not found or failed to load." onRetry={() => navigate(-1)} />
      </DashboardLayout>
    );
  }

  const acceptedRequest = requests.find((r) => r.status === 'accepted');
  const imageUrl = getDonationImageUrl(donation.image);
  const completionState = acceptedRequest
    ? getCompletionState({
        viewerRole: 'donor',
        viewerId: user?.id,
        donorId: donation.donorId,
        ngoId: acceptedRequest.ngoId,
        donorCompletedAt: acceptedRequest.donorCompletedAt,
        ngoCompletedAt: acceptedRequest.ngoCompletedAt,
      })
    : 'none';
  const completionMessage = acceptedRequest
    ? getCompletionMessage({ completionState, viewerRole: 'donor' })
    : '';

  return (
    <DashboardLayout>
      <Link to="/my-donations" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to My Donations
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Image + Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card overflow-hidden">
            <div className="w-full h-72 bg-gray-100">
              {imageUrl && !imageFailed ? (
                <img
                  src={imageUrl}
                  onError={() => setImageFailed(true)}
                  alt={donation.foodName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No image</div>
              )}
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h1 className="text-2xl font-bold text-gray-900">{donation.foodName}</h1>
                <StatusBadge status={donation.status} />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <InfoRow icon={Tag} label="Category" value={donation.category} />
                <InfoRow
                  icon={Package}
                  label="Quantity"
                  value={
                    donation.quantityValue !== undefined && donation.quantityUnit
                      ? `${donation.quantity} (${donation.quantityValue} ${donation.quantityUnit})`
                      : donation.quantity
                  }
                />
                <InfoRow icon={MapPin} label="Location" value={donation.location} />
                <InfoRow icon={Clock} label="Available Until" value={new Date(donation.availableUntil).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} />
                <InfoRow icon={Calendar} label="Posted Date" value={new Date(donation.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} />
                <InfoRow icon={User} label="Donor" value={donation.donorName} />
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Description
                </h3>
                <p className="text-gray-600 leading-relaxed">{donation.description}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Request panel */}
        <div className="space-y-6">
          {acceptedRequest && donation.status === 'accepted' && (
            <div className="card p-5 bg-primary-50/40 border-primary-100">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary-600" /> Accepted Request
              </h3>
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-500">NGO:</span> <span className="font-medium text-gray-900">{acceptedRequest.ngoName}</span></p>
                {acceptedRequest.ngo?.location && <p><span className="text-gray-500">Location:</span> <span className="text-gray-700">{acceptedRequest.ngo.location}</span></p>}
                {acceptedRequest.ngo?.acceptedCategories?.length ? <p><span className="text-gray-500">Accepts:</span> <span className="text-gray-700">{acceptedRequest.ngo.acceptedCategories.join(', ')}</span></p> : null}
                <p><span className="text-gray-500">Message:</span> <span className="text-gray-700">{acceptedRequest.message}</span></p>
                <p><span className="text-gray-500">Requested:</span> <span className="text-gray-700">{new Date(acceptedRequest.createdAt).toLocaleDateString()}</span></p>
                {acceptedRequest.contact && <div className="mt-4 border-t border-primary-100 pt-3 text-sm"><p className="font-semibold text-gray-900">Contact & Handoff</p><p className="mt-1 text-gray-600">{acceptedRequest.contact.ngo?.name} {acceptedRequest.contact.ngo?.phone || acceptedRequest.contact.ngo?.email ? `· ${acceptedRequest.contact.ngo.phone || acceptedRequest.contact.ngo.email}` : ''}</p><p className="mt-1 text-gray-600">{acceptedRequest.contact.handoffMessage}</p></div>}
              </div>
              {(completionState === 'viewer' || completionState === 'other' || completionState === 'both') && (
                <p className="mt-4 text-sm text-gray-600">{completionMessage}</p>
              )}
              {(completionState === 'none' || completionState === 'other') && (
                <Button variant="success" className="w-full mt-4" onClick={handleComplete} disabled={actionLoading}>{actionLoading ? 'Processing...' : 'Mark as Completed'}</Button>
              )}
            </div>
          )}

          {requests.length > 0 ? (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4">
                Donation Requests ({requests.length})
              </h3>
              <div className="space-y-4">
                {requests.map((req) => (
                  <div key={req.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-gray-900">{req.ngoName}</p>
                      <StatusBadge status={req.status} type="request" />
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{req.message}</p>
                    {req.ngo?.location && <p className="text-xs text-gray-500 mb-1">Location: {req.ngo.location}</p>}
                    {req.ngo?.acceptedCategories?.length ? <p className="text-xs text-gray-500 mb-3">Accepts: {req.ngo.acceptedCategories.join(', ')}</p> : null}
                    <p className="text-xs text-gray-400 mb-3">
                      {new Date(req.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {req.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="success" onClick={() => handleAccept(req.id)} disabled={actionLoading}>
                          <Check className="w-4 h-4" /> Accept
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleReject(req.id)} disabled={actionLoading}>
                          <X className="w-4 h-4" /> Reject
                        </Button>
                      </div>
                    )}
                    {req.status !== 'rejected' && <Link to={`/ngos/${req.ngoId}`} className="mt-2 inline-flex text-sm font-medium text-primary-700 hover:text-primary-800">View NGO Profile</Link>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card p-6 text-center">
              <p className="text-sm text-gray-500">No requests for this donation yet.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}
