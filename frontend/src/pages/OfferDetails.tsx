import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Calendar, Package, Tag, FileText, User, Check, CheckCircle2, X } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/common/StatusBadge';
import Button from '@/components/common/Button';
import { LoadingSpinner, ErrorState } from '@/components/common/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { offerService } from '@/services/services';
import type { DonationOffer } from '@/types';
import { getDonationImageUrl } from '@/utils/image';
import { getCompletionDetails, getCompletionMessage } from '@/utils/workflow';

export default function OfferDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [offer, setOffer] = useState<DonationOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!id) return;
    offerService
      .getById(id)
      .then((data) => setOffer(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDecision = async (action: 'accept' | 'reject') => {
    if (!id) return;
    setActionLoading(true);
    try {
      await (action === 'accept' ? offerService.accept(id) : offerService.reject(id));
      const refreshed = await offerService.getById(id);
      setOffer(refreshed);
      toast(action === 'accept' ? 'Offer accepted.' : 'Offer rejected.', 'success');
    } catch {
      toast('Unable to update this offer.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await offerService.complete(id);
      const refreshed = await offerService.getById(id);
      setOffer(refreshed);
      toast(refreshed.status === 'completed' ? 'Completed' : 'Your completion confirmed. Waiting for the other party.', 'success');
    } catch {
      toast('Unable to complete this offer.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <DashboardLayout><LoadingSpinner label="Loading offer..." /></DashboardLayout>;
  }

  if (error || !offer) {
    return <DashboardLayout><ErrorState message="Offer not found or failed to load." onRetry={() => navigate(-1)} /></DashboardLayout>;
  }

  const imageUrl = getDonationImageUrl(offer.image);
  const isNGO = user?.role === 'ngo';
  const isDonor = user?.role === 'donor';
  const isViewerDonor = Boolean(user && offer.donorId === user.id);
  const isViewerNgo = Boolean(user && offer.ngoId === user.id);
  const viewerRole = isViewerDonor ? 'donor' : isViewerNgo ? 'ngo' : undefined;
  const completionDetails = getCompletionDetails({
    viewerRole,
    viewerId: user?.id,
    donorId: offer.donorId,
    ngoId: offer.ngoId,
    donorCompletedAt: offer.donorCompletedAt,
    ngoCompletedAt: offer.ngoCompletedAt,
  });
  const completionState = completionDetails.state;
  const completionMessage = getCompletionMessage({ completionState, viewerRole });
  const isAccepted = offer.status === 'accepted';
  const showContactBlock = isAccepted && Boolean(offer.contact);

  return (
    <DashboardLayout>
      <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card overflow-hidden">
            <div className="w-full h-72 bg-gray-100">
              {imageUrl && !imageFailed ? (
                <img src={imageUrl} onError={() => setImageFailed(true)} alt={offer.foodName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No image</div>
              )}
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4 gap-3">
                <div>
                  <div className="mb-2 inline-flex rounded-full bg-primary-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-700">Direct Offer</div>
                  <h1 className="text-2xl font-bold text-gray-900">{offer.foodName}</h1>
                </div>
                <StatusBadge status={offer.status} type="request" />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <InfoRow icon={Tag} label="Category" value={offer.category} />
                <InfoRow icon={Package} label="Quantity" value={offer.quantityValue !== undefined && offer.quantityUnit ? `${offer.quantity} (${offer.quantityValue} ${offer.quantityUnit})` : offer.quantity} />
                <InfoRow icon={MapPin} label="Location" value={offer.location} />
                <InfoRow icon={Clock} label="Available Until" value={new Date(offer.availableUntil).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} />
                <InfoRow icon={Calendar} label="Posted Date" value={new Date(offer.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} />
                <InfoRow icon={User} label={isNGO ? 'Offered By' : 'Offered To'} value={isNGO ? (offer.donorName || 'Donor') : (offer.targetNgoName || offer.ngoName || 'NGO')} />
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4" /> Description</h3>
                <p className="text-gray-600 leading-relaxed">{offer.description}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {offer.status === 'pending' && isViewerDonor && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Pending</h3>
              <p className="text-sm text-gray-600">Waiting for the NGO to review and respond to this offer.</p>
            </div>
          )}

          {offer.status === 'pending' && user?.role === 'ngo' && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Direct Offer Status</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="success" onClick={() => handleDecision('accept')} disabled={actionLoading}><Check className="w-4 h-4" /> Accept</Button>
                <Button size="sm" variant="danger" onClick={() => handleDecision('reject')} disabled={actionLoading}><X className="w-4 h-4" /> Reject</Button>
              </div>
            </div>
          )}

          {showContactBlock && (
            <div className="card p-5 bg-primary-50/30 border-primary-100">
              <h3 className="font-semibold text-gray-900 mb-3">Contact & Handoff</h3>
              <div className="space-y-2 text-sm text-gray-700">
                {isViewerDonor && offer.contact?.ngo && (
                  <>
                    <p><span className="font-medium text-gray-900">NGO:</span> {offer.contact.ngo.name || 'NGO'}</p>
                    <p>Phone: {offer.contact.ngo.phone || 'Not provided'}</p>
                    <p>Email: {offer.contact.ngo.email || 'Not provided'}</p>
                    {offer.contact.ngo.location && <p>Location: {offer.contact.ngo.location}</p>}
                  </>
                )}
                {isViewerNgo && offer.contact?.donor && (
                  <>
                    <p><span className="font-medium text-gray-900">Donor:</span> {offer.contact.donor.name || 'Donor'}</p>
                    <p>Phone: {offer.contact.donor.phone || 'Not provided'}</p>
                    <p>Email: {offer.contact.donor.email || 'Not provided'}</p>
                  </>
                )}
                {offer.location && <p>Pickup / Hand-off Location: {offer.location}</p>}
              </div>
              <p className="mt-4 text-sm text-gray-600">Contact the other party to arrange pickup or drop-off. After the food is handed over, both sides should confirm completion.</p>
            </div>
          )}

          {isAccepted && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Accepted</h3>
              {completionState === 'both' ? (
                <p className="text-sm text-gray-600">Completed</p>
              ) : (
                <>
                  {(completionState === 'viewer' || completionState === 'other') && (
                    <p className="text-sm text-gray-600 mb-3">{completionMessage}</p>
                  )}
                  {(completionState === 'none' || completionState === 'other') && (
                    <Button variant="success" className="w-full" onClick={handleComplete} disabled={actionLoading}><CheckCircle2 className="w-4 h-4" /> Mark as Completed</Button>
                  )}
                </>
              )}
            </div>
          )}

          {offer.status === 'rejected' && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Rejected</h3>
              <p className="text-sm text-gray-600">This offer was rejected.</p>
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
