import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, HandHeart, MapPin, Phone } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/common/Button';
import { LoadingSpinner, ErrorState } from '@/components/common/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';
import { userService } from '@/services/services';
import { type NgoProfile } from '@/types';

export default function NgoProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ngo, setNgo] = useState<NgoProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    userService.getNgoProfile(id).then(setNgo).catch(() => setError(true)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <DashboardLayout><LoadingSpinner label="Loading NGO profile..." /></DashboardLayout>;
  if (error || !ngo) return <DashboardLayout><ErrorState message="NGO profile not found." onRetry={() => navigate(-1)} /></DashboardLayout>;

  return <DashboardLayout>
    <Link to="/find-ngos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" /> Back to NGOs</Link>
    <div className="card mx-auto max-w-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-primary-500 to-primary-700 px-6 py-8 text-white">
        <h1 className="text-2xl font-bold">{ngo.organizationName || ngo.name}</h1>
        <p className="mt-1 capitalize text-primary-100">NGO</p>
      </div>
      <div className="space-y-5 p-6">
        <Info label="Location" value={ngo.location || 'Not specified'} icon={<MapPin className="h-4 w-4" />} />
        {ngo.phone && <Info label="Contact" value={ngo.phone} icon={<Phone className="h-4 w-4" />} />}
        <Info label="Accepted food" value={ngo.acceptedCategories.join(', ') || 'Not specified'} />
        <Info label="Status" value={ngo.isAcceptingDonations ? 'Currently accepting donations' : 'Currently paused'} />
        <Info label="Operating radius" value={ngo.operatingRadiusKm !== undefined ? `${ngo.operatingRadiusKm} km` : 'No limit'} />
        {ngo.currentNeedDescription && <Info label="Current need" value={ngo.currentNeedDescription} />}
        {ngo.offeredDonations && ngo.offeredDonations.length > 0 && <div className="border-t border-gray-100 pt-4"><h2 className="font-semibold text-gray-900">Offered Donations</h2><div className="mt-3 space-y-3">{ngo.offeredDonations.map((donation) => <Link key={donation.id} to={`/donations/${donation.id}`} className="block rounded-lg border border-gray-200 p-3 hover:border-primary-300"><p className="font-medium text-gray-900">{donation.foodName}</p><p className="text-xs text-gray-600">{donation.category} · {donation.quantity} · {donation.location}</p><p className="mt-1 text-xs text-gray-500">Available until {new Date(donation.availableUntil).toLocaleDateString()} · {donation.status}</p></Link>)}</div></div>}
        {user?.role === 'donor' && ngo.isAcceptingDonations && <Button onClick={() => navigate(`/create-donation?ngoId=${ngo.id}&ngoName=${encodeURIComponent(ngo.organizationName || ngo.name)}`)}><HandHeart className="h-4 w-4" /> Offer Donation</Button>}
      </div>
    </div>
  </DashboardLayout>;
}

function Info({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return <div className="flex gap-3 border-b border-gray-100 pb-3"><div className="mt-0.5 text-gray-400">{icon}</div><div><p className="text-xs text-gray-500">{label}</p><p className="text-sm font-medium text-gray-900">{value}</p></div></div>;
}
