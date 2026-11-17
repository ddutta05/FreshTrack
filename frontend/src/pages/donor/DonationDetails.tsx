import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Calendar, Package, Tag, FileText, User, Check, X, CheckCircle2, Edit } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/common/StatusBadge';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Textarea from '@/components/common/Textarea';
import { LoadingSpinner, ErrorState } from '@/components/common/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { donationService, requestService } from '@/services/services';
import { normalizeApiErrorMessage } from '@/services/api';
import { QUANTITY_UNITS, type Donation, type DonationRequest, type QuantityUnit } from '@/types';
import { getDonationImageUrl } from '@/utils/image';
import { getCompletionMessage, getCompletionState } from '@/utils/workflow';

interface NgoRequestGroup {
  ngoId: string;
  ngoName: string;
  attempts: DonationRequest[];
}

export default function DonationDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [donation, setDonation] = useState<Donation | null>(null);
  const [requests, setRequests] = useState<DonationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    foodName: '',
    quantityValue: '',
    quantityUnit: '' as QuantityUnit | '',
    description: '',
    location: '',
    availableUntil: '',
    latitude: '',
    longitude: '',
  });
  const acceptedRequest = requests.find((request) => (
    donation
    && request.direction !== 'donor_offer'
    && request.donationId === donation.id
    && ['accepted', 'completed'].includes(request.status)
  )) ?? null;
  const canManageRequests = Boolean(
    donation
    && user?.role === 'donor'
    && user.id === donation.donorId,
  );

  useEffect(() => {
    if (!id) return;
    Promise.all([donationService.getById(id), requestService.getByDonationAll(id)])
      .then(([d, r]) => {
        setDonation(d);
        setRequests(r);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading && location.hash === '#incoming-requests') {
      document.getElementById('incoming-requests')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading, location.hash]);

  const handleAccept = async (requestId: string) => {
    setActionLoading(true);
    try {
      await requestService.accept(requestId);
      const updated = await requestService.getByDonationAll(id!);
      setRequests(updated);
      const updatedDonation = await donationService.getById(id!);
      setDonation(updatedDonation);
      toast('Request accepted! The NGO will be notified.', 'success');
    } catch (err) {
      toast(normalizeApiErrorMessage(err), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (requestId: string) => {
    setActionLoading(true);
    try {
      await requestService.reject(requestId);
      const updated = await requestService.getByDonationAll(id!);
      setRequests(updated);
      const updatedDonation = await donationService.getById(id!);
      setDonation(updatedDonation);
      toast('Request rejected.', 'info');
    } catch (err) {
      toast(normalizeApiErrorMessage(err), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!acceptedRequest || acceptedRequest.status !== 'accepted') return;
    setActionLoading(true);
    try {
      await requestService.complete(acceptedRequest.id);
      const updatedDonation = await donationService.getById(id!);
      setDonation(updatedDonation);
      const updatedRequests = await requestService.getByDonationAll(id!);
      setRequests(updatedRequests);
      const updatedRequest = updatedRequests.find((request) => request.id === acceptedRequest.id);
      toast(updatedRequest?.status === 'completed' ? 'Completed' : 'Your completion confirmed. Waiting for the other party.', 'success');
    } catch (err) {
      toast(normalizeApiErrorMessage(err), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const startEditing = () => {
    if (!donation) return;
    const date = new Date(donation.availableUntil);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    const quantityUnit = QUANTITY_UNITS.find((unit) => unit === donation.quantityUnit);
    const hasStructuredQuantity = donation.quantityValue !== undefined && quantityUnit !== undefined;
    setEditForm({
      foodName: donation.foodName,
      quantityValue: hasStructuredQuantity ? String(donation.quantityValue) : '',
      quantityUnit: hasStructuredQuantity ? quantityUnit : '',
      description: donation.description,
      location: donation.location,
      availableUntil: date.toISOString().slice(0, 16),
      latitude: donation.geoLocation ? String(donation.geoLocation.coordinates[1]) : '',
      longitude: donation.geoLocation ? String(donation.geoLocation.coordinates[0]) : '',
    });
    setEditing(true);
  };

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!id) return;

    const hasQuantityValue = editForm.quantityValue.trim() !== '';
    const hasQuantityUnit = editForm.quantityUnit !== '';
    if (hasQuantityValue !== hasQuantityUnit) {
      toast('Enter both a quantity value and unit.', 'error');
      return;
    }

    const hasLatitude = editForm.latitude.trim() !== '';
    const hasLongitude = editForm.longitude.trim() !== '';
    if (!hasLatitude || !hasLongitude) {
      toast('Pickup latitude and longitude are required.', 'error');
      return;
    }
    const latitude = Number(editForm.latitude);
    const longitude = Number(editForm.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      toast('Latitude must be between -90 and 90.', 'error');
      return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      toast('Longitude must be between -180 and 180.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const updated = await donationService.update(id, {
        foodName: editForm.foodName,
        quantity: hasQuantityValue
          ? `${Number(editForm.quantityValue)} ${editForm.quantityUnit}`
          : donation?.quantity || '',
        ...(hasQuantityValue ? {
          quantityValue: Number(editForm.quantityValue),
          quantityUnit: editForm.quantityUnit,
        } : {}),
        description: editForm.description,
        location: editForm.location,
        geoLocation: { type: 'Point', coordinates: [longitude, latitude] },
        availableUntil: new Date(editForm.availableUntil).toISOString(),
      });
      setDonation(updated);
      setEditing(false);
      toast('Donation updated.', 'success');
    } catch (err) {
      toast(normalizeApiErrorMessage(err), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const currentDonationId = donation?.id;
  const requestGroups = useMemo(() => {
    const groups = new Map<string, NgoRequestGroup>();
    for (const request of requests) {
      if (!currentDonationId || request.direction === 'donor_offer' || request.donationId !== currentDonationId) continue;
      const ngoId = request.ngoId || `unavailable:${request.id}`;
      const group = groups.get(ngoId) ?? {
        ngoId,
        ngoName: request.ngoName || 'NGO',
        attempts: [],
      };
      group.attempts.push(request);
      groups.set(ngoId, group);
    }
    return [...groups.values()]
      .map((group) => ({
        ...group,
        attempts: group.attempts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      }))
      .sort((a, b) => new Date(b.attempts[0].createdAt).getTime() - new Date(a.attempts[0].createdAt).getTime());
  }, [currentDonationId, requests]);

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

  const canEdit = user?.role === 'donor' && user.id === donation.donorId && ['available', 'pending'].includes(donation.status);
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo || '/my-donations?tab=donations';
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
      <button type="button" onClick={() => navigate(returnTo, { replace: true })} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

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
                <div className="flex items-center gap-3">
                  <StatusBadge status={donation.status} />
                  {canEdit && !editing && <Button size="sm" variant="secondary" onClick={startEditing}><Edit className="w-4 h-4" /> Edit</Button>}
                </div>
              </div>

              {editing ? (
                <form onSubmit={handleUpdate} className="space-y-4">
                  <Input label="Food Name" value={editForm.foodName} onChange={(event) => setEditForm((current) => ({ ...current, foodName: event.target.value }))} required maxLength={150} />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Input label="Quantity Value" type="number" min="0" step="any" value={editForm.quantityValue} onChange={(event) => setEditForm((current) => ({ ...current, quantityValue: event.target.value }))} />
                    <Select label="Quantity Unit" value={editForm.quantityUnit} onChange={(event) => setEditForm((current) => ({ ...current, quantityUnit: event.target.value as QuantityUnit }))}>
                      <option value="">Keep existing quantity</option>
                      {QUANTITY_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                    </Select>
                  </div>
                  <Textarea label="Description" value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} required maxLength={2000} />
                  <Input label="Pickup Location" value={editForm.location} onChange={(event) => setEditForm((current) => ({ ...current, location: event.target.value }))} required maxLength={250} />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Input label="Pickup Latitude" type="number" min={-90} max={90} step="any" value={editForm.latitude} onChange={(event) => setEditForm((current) => ({ ...current, latitude: event.target.value }))} required />
                    <Input label="Pickup Longitude" type="number" min={-180} max={180} step="any" value={editForm.longitude} onChange={(event) => setEditForm((current) => ({ ...current, longitude: event.target.value }))} required />
                  </div>
                  <Input label="Available Until" type="datetime-local" value={editForm.availableUntil} onChange={(event) => setEditForm((current) => ({ ...current, availableUntil: event.target.value }))} required min={new Date().toISOString().slice(0, 16)} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={() => setEditing(false)} disabled={actionLoading}>Cancel</Button>
                    <Button type="submit" disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Save Changes'}</Button>
                  </div>
                </form>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Request panel */}
        <div className="space-y-6">
          {donation.status === 'accepted' && (
            <div role="note" className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              This donation has already been accepted. Its details are locked to protect the agreed handoff.
            </div>
          )}
          {donation.status === 'expired' && (
            <div role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              This donation has expired and cannot be edited or reactivated. Create a new donation to offer it again.
            </div>
          )}
          {donation.status === 'completed' && (
            <div role="note" className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              This donation is complete and its details are locked.
            </div>
          )}
          {acceptedRequest && ['accepted', 'completed'].includes(donation.status) && (
            <div className="card p-5 bg-primary-50/40 border-primary-100">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary-600" /> {donation.status === 'completed' ? 'Completed Request' : 'Accepted Request'}
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

          <section id="incoming-requests" className="card p-5 scroll-mt-24">
            {requestGroups.length > 0 ? (
              <>
                <h3 className="font-semibold text-gray-900 mb-4">
                  Incoming Requests ({requestGroups.reduce((total, group) => total + group.attempts.length, 0)})
                </h3>
                <div className="space-y-4">
                  {requestGroups.map((group) => {
                    const [latest, ...history] = group.attempts;
                    return (
                      <article key={group.ngoId} className="border border-gray-200 rounded-lg p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <h4 className="font-medium text-gray-900">{group.ngoName}</h4>
                          {group.ngoId.startsWith('unavailable:') ? (
                            <span className="text-sm text-gray-500">NGO profile unavailable</span>
                          ) : (
                            <Link to={`/ngos/${group.ngoId}`} className="text-sm font-medium text-primary-700 hover:text-primary-800">View NGO</Link>
                          )}
                        </div>

                        <div className="rounded-lg bg-gray-50 p-4">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <StatusBadge status={latest.status} type="request" />
                          </div>
                          <p className="mb-2 text-sm text-gray-600">{latest.message || 'No message provided.'}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(latest.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {' · '}Request ID: {latest.id}
                          </p>
                          {canManageRequests && latest.status === 'pending' && donation.status !== 'expired' && !['accepted', 'completed'].includes(donation.status) && (
                            <div className="mt-3 flex gap-2">
                              <Button size="sm" variant="success" onClick={() => handleAccept(latest.id)} disabled={actionLoading}>
                                <Check className="w-4 h-4" /> Accept
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => handleReject(latest.id)} disabled={actionLoading}>
                                <X className="w-4 h-4" /> Reject
                              </Button>
                            </div>
                          )}
                        </div>

                        {history.length > 0 && (
                          <details className="mt-3">
                            <summary className="cursor-pointer text-sm font-medium text-gray-700">
                              Previous attempts ({history.length})
                            </summary>
                            <div className="mt-3 space-y-3">
                              {history.map((attempt) => (
                                <div key={attempt.id} className="border-l-2 border-gray-200 pl-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-medium text-gray-800">Previous attempt</p>
                                    <StatusBadge status={attempt.status} type="request" />
                                  </div>
                                  <p className="mt-1 text-sm text-gray-600">{attempt.message || 'No message provided.'}</p>
                                  <p className="mt-1 text-xs text-gray-500">
                                    {new Date(attempt.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    {' · '}Request ID: {attempt.id}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <h3 className="mb-2 font-semibold text-gray-900">Incoming Requests</h3>
                <p className="text-sm text-gray-500">No requests for this donation yet.</p>
              </>
            )}
          </section>
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
