import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Calendar, Package, Tag, FileText, User, ShoppingBag, Send, CheckCircle2 } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/common/StatusBadge';
import Button from '@/components/common/Button';
import Modal from '@/components/common/Modal';
import Textarea from '@/components/common/Textarea';
import { LoadingSpinner, ErrorState } from '@/components/common/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { donationService, requestService } from '@/services/services';
import { normalizeApiErrorMessage } from '@/services/api';
import type { Donation, DonationRequest } from '@/types';
import { getDonationImageUrl } from '@/utils/image';
import { getCompletionDetails, getCompletionMessage } from '@/utils/workflow';

export default function FoodDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [donation, setDonation] = useState<Donation | null>(null);
  const [ngoRequests, setNgoRequests] = useState<DonationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('We would like to collect this donation for distribution.');
  const [submitting, setSubmitting] = useState(false);
  const [myRequest, setMyRequest] = useState<DonationRequest | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [modalImageFailed, setModalImageFailed] = useState(false);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        const [donationData, ngoRequestData] = await Promise.all([
          donationService.getById(id),
          user ? requestService.getByNGO(user.id) : Promise.resolve([]),
        ]);
        setDonation(donationData);
        setNgoRequests(ngoRequestData);
        setMyRequest(ngoRequestData.find((request) => request.donationId === id && request.ngoId === user?.id) || null);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id, user]);

  const handleRequest = async () => {
    if (!user || !donation) return;
    setSubmitting(true);
    try {
      await requestService.create({
        donationId: donation.id,
        message,
      });
      toast('Request sent successfully!', 'success');
      setShowModal(false);
      const refreshed = await requestService.getByNGO(user.id);
      setNgoRequests(refreshed);
      setMyRequest(refreshed.find((request) => request.donationId === donation.id && request.ngoId === user.id) || null);
      navigate((location.state as { returnTo?: string } | null)?.returnTo || '/my-requests?tab=requests');
    } catch (err) {
      toast(normalizeApiErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!user || !myRequest) return;
    setSubmitting(true);
    try {
      await requestService.complete(myRequest.id);
      const refreshed = await requestService.getByNGO(user.id);
      setNgoRequests(refreshed);
      const updatedRequest = refreshed.find((request) => request.id === myRequest.id) || null;
      setMyRequest(updatedRequest);
      if (updatedRequest?.status === 'completed') {
        toast('Completed', 'success');
      } else if (updatedRequest?.status === 'accepted') {
        toast('Your completion was recorded. Waiting for the donor to confirm completion.', 'info');
      } else {
        toast('Your completion confirmation was recorded. Refresh to check the request status.', 'info');
      }
    } catch (err) {
      toast(normalizeApiErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingSpinner label="Loading food details..." />
      </DashboardLayout>
    );
  }

  if (error || !donation) {
    return (
      <DashboardLayout>
        <ErrorState message="This donation is no longer available." onRetry={() => navigate(-1)} />
      </DashboardLayout>
    );
  }

  const isRequestable =
    ['available', 'pending'].includes(donation.status) &&
    new Date(donation.availableUntil).getTime() > Date.now();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo || '/available-food';
  const imageUrl = getDonationImageUrl(donation.image);
  const currentRequest = user?.role === 'ngo'
    ? ngoRequests.find((request) => request.donationId === donation.id && request.ngoId === user.id) ?? null
    : null;
  const requestStatus = currentRequest?.status;
  const hasPendingRequest = requestStatus === 'pending';
  const hasAcceptedRequest = ['accepted', 'completed'].includes(requestStatus ?? '');
  const hasRejectedRequest = requestStatus === 'rejected';
  const completionDetails = currentRequest && user?.role === 'ngo'
    ? getCompletionDetails({
        viewerRole: 'ngo',
        viewerId: user.id,
        donorId: currentRequest.donorId,
        ngoId: currentRequest.ngoId,
        donorCompletedAt: currentRequest.donorCompletedAt,
        ngoCompletedAt: currentRequest.ngoCompletedAt,
      })
    : null;
  const completionMessage = completionDetails ? getCompletionMessage({ completionState: completionDetails.state, viewerRole: 'ngo' }) : '';

  return (
    <DashboardLayout>
      <button type="button" onClick={() => navigate(returnTo)} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="grid lg:grid-cols-3 gap-6">
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
                <InfoRow icon={Package} label="Quantity" value={donation.quantity} />
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

        <div>
          <div className="card p-5 sticky top-20">
            {hasAcceptedRequest && currentRequest ? (
              <div className="space-y-4 text-sm text-gray-700">
                <h3 className="font-semibold text-gray-900">Accepted Request</h3>
                <p><span className="text-gray-500">Donor:</span> <span className="font-medium text-gray-900">{currentRequest.donorName || 'Donor'}</span></p>
                <p><span className="text-gray-500">Message:</span> <span className="text-gray-700">{currentRequest.message}</span></p>
                <p><span className="text-gray-500">Requested:</span> <span className="text-gray-700">{new Date(currentRequest.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span></p>

                {currentRequest.contact && (
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <p className="font-semibold text-gray-900">Contact & Handoff</p>
                    <p className="mt-1 text-gray-700">{currentRequest.contact.donor?.name || 'Donor'} {currentRequest.contact.donor?.phone || currentRequest.contact.donor?.email ? `· ${currentRequest.contact.donor.phone || currentRequest.contact.donor.email}` : ''}</p>
                    {currentRequest.contact.donor?.phone && <p className="text-gray-700">Phone: {currentRequest.contact.donor.phone}</p>}
                    {currentRequest.contact.donor?.email && <p className="text-gray-700">Email: {currentRequest.contact.donor.email}</p>}
                    {currentRequest.contact.handoffMessage && <p className="mt-2 text-gray-600">{currentRequest.contact.handoffMessage}</p>}
                  </div>
                )}

                {completionDetails && completionDetails.state !== 'both' && (
                  <p className="mt-3 text-sm text-gray-600">{completionMessage}</p>
                )}
                {completionDetails && (completionDetails.state === 'none' || completionDetails.state === 'other') && (
                  <Button variant="success" className="w-full mt-2" onClick={handleComplete} disabled={submitting}>
                    {submitting ? 'Processing...' : 'Mark as Completed'}
                  </Button>
                )}
                <Link to="/my-requests?tab=requests" state={{ returnTo: '/my-requests?tab=requests' }} className="btn-secondary w-full mt-2">View My Requests</Link>
              </div>
            ) : hasPendingRequest ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7 text-primary-600" />
                </div>
                <p className="font-medium text-gray-900 mb-1">Pending</p>
                <p className="text-sm text-gray-500">Request Sent</p>
                <p className="text-sm text-gray-500 mt-2">You&apos;ve already requested this donation.</p>
                <Link to="/my-requests?tab=requests" state={{ returnTo: '/my-requests?tab=requests' }} className="btn-secondary w-full mt-4">View My Requests</Link>
              </div>
            ) : hasRejectedRequest && !isRequestable ? (
              <div className="text-center py-6">
                <p className="font-medium text-gray-900 mb-2">Rejected</p>
                <p className="text-sm text-gray-500">This donation is no longer available for new requests.</p>
                <Link to="/my-requests?tab=requests" state={{ returnTo: '/my-requests?tab=requests' }} className="btn-secondary w-full mt-4">View My Requests</Link>
              </div>
            ) : isRequestable ? (
              <>
                {hasRejectedRequest && (
                  <p className="mb-4 text-sm text-gray-500">Your previous request was rejected. You may submit another request while this donation is available.</p>
                )}
                <h3 className="font-semibold text-gray-900 mb-4">Request This Donation</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Click below to request this donation. You can add a message to the donor.
                </p>
                <Button className="w-full" onClick={() => setShowModal(true)}>
                  <ShoppingBag className="w-5 h-5" /> Request Donation
                </Button>
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-gray-500">
                  This donation is no longer available for requests.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Request Donation"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleRequest} disabled={submitting}>
              {submitting ? 'Sending...' : <><Send className="w-4 h-4" /> Send Request</>}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
              {imageUrl && !modalImageFailed ? (
                <img
                  src={imageUrl}
                  onError={() => setModalImageFailed(true)}
                  alt={donation.foodName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No image</div>
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900">{donation.foodName}</p>
              <p className="text-sm text-gray-500">{donation.quantity} · {donation.location}</p>
            </div>
          </div>
          <Textarea
            label="Message to Donor (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a message explaining how you'll use this donation..."
          />
        </div>
      </Modal>
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
