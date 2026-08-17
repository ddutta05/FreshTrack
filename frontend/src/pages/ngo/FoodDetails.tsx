import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
import type { Donation } from '@/types';

export default function FoodDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [donation, setDonation] = useState<Donation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('We would like to collect this donation for distribution.');
  const [submitting, setSubmitting] = useState(false);
  const [alreadyRequested, setAlreadyRequested] = useState(false);

  useEffect(() => {
    if (!id) return;
    donationService
      .getById(id)
      .then((d) => setDonation(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));

    if (user) {
      requestService.getByNGO(user.id).then((reqs) => {
        setAlreadyRequested(reqs.some((r) => r.donationId === id));
      });
    }
  }, [id, user]);

  const handleRequest = async () => {
    if (!user || !donation) return;
    setSubmitting(true);
    try {
      await requestService.create({
        donationId: donation.id,
        ngoId: user.id,
        ngoName: user.organizationName || user.name,
        message,
      });
      toast('Request sent successfully!', 'success');
      setShowModal(false);
      setAlreadyRequested(true);
      navigate('/my-requests');
    } catch {
      toast('Failed to send request. Please try again.', 'error');
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
        <ErrorState message="Food listing not found or failed to load." onRetry={() => navigate(-1)} />
      </DashboardLayout>
    );
  }

  const isAvailable = donation.status === 'available';

  return (
    <DashboardLayout>
      <Link to="/available-food" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Available Food
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Image + Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card overflow-hidden">
            <div className="w-full h-72 bg-gray-100">
              <img src={donation.image} alt={donation.foodName} className="w-full h-full object-cover" />
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

        {/* Right: Action panel */}
        <div>
          <div className="card p-5 sticky top-20">
            <h3 className="font-semibold text-gray-900 mb-4">Request This Donation</h3>
            {alreadyRequested ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7 text-primary-600" />
                </div>
                <p className="font-medium text-gray-900 mb-1">Request Sent</p>
                <p className="text-sm text-gray-500">You've already requested this donation. Check your requests for updates.</p>
                <Link to="/my-requests" className="btn-secondary w-full mt-4">
                  View My Requests
                </Link>
              </div>
            ) : isAvailable ? (
              <>
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

      {/* Request Modal */}
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
              <img src={donation.image} alt={donation.foodName} className="w-full h-full object-cover" />
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
