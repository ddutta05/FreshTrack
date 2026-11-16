import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Filter, MapPin, Users } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Input from '@/components/common/Input';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/common/LoadingSpinner';
import { useToast } from '@/context/ToastContext';
import { recommendationService } from '@/services/services';
import { normalizeApiErrorMessage } from '@/services/api';
import { FOOD_CATEGORIES, type NgoBrowseResult } from '@/types';

export default function NgoSearch() {
  const { toast } = useToast();
  const [ngos, setNgos] = useState<NgoBrowseResult[]>([]);
  const [category, setCategory] = useState('');
  const [radius, setRadius] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const parsedRadius = Number(radius);
  const invalidRadius = radius !== '' && (
    !Number.isFinite(parsedRadius) || parsedRadius < 0.1 || parsedRadius > 50
  );

  useEffect(() => {
    let cancelled = false;
    if (invalidRadius) {
      setLoading(false);
      setError(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    setError(false);
    recommendationService.browseNgos({ category: category || undefined, maxDistanceKm: radius ? parsedRadius : undefined })
      .then((data) => { if (!cancelled) setNgos(data); })
      .catch((err) => {
        if (!cancelled) {
          setError(true);
          toast(normalizeApiErrorMessage(err), 'error');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [category, invalidRadius, parsedRadius, radius, toast]);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Find an NGO</h1>
        <p className="mt-1 text-gray-500">Browse organizations that accept surplus food.</p>
      </div>
      <div className="card mb-6 grid gap-4 p-4 sm:grid-cols-2">
        <label className="label">Food category
          <select className="input mt-1" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Any category</option>
            {FOOD_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <Input
          label="Distance (km, optional)"
          type="number"
          min="0.1"
          max="50"
          placeholder="Any distance"
          value={radius}
          error={invalidRadius ? 'Enter a distance between 0.1 and 50 km.' : undefined}
          onChange={(event) => setRadius(event.target.value)}
        />
        <div className="flex items-center gap-2 text-xs text-gray-500 sm:col-span-2"><Filter className="h-4 w-4" />Nearest first when location is saved.</div>
      </div>
      {loading ? <LoadingSpinner label="Loading NGOs..." /> : error ? <ErrorState message="Unable to load NGOs." onRetry={() => window.location.reload()} /> : ngos.length === 0 ? <EmptyState icon={Users} title="No NGOs found" message="Try another category or distance." /> : (
        <div className="grid gap-5 md:grid-cols-2">
          {ngos.map((ngo) => <article key={ngo.ngoId} className="card p-5">
            <h2 className="text-lg font-semibold text-gray-900">{ngo.organizationName || ngo.name}</h2>
            <p className="mt-1 text-sm text-gray-500">{ngo.location || 'Location not specified'}</p>
            {ngo.distanceKm !== undefined && <p className="mt-2 text-sm text-primary-700">{ngo.distanceKm} km away</p>}
            <p className="mt-3 text-sm text-gray-600">Accepts: {ngo.acceptedCategories.join(', ') || 'Not specified'}</p>
            {ngo.currentNeedDescription && <p className="mt-2 text-sm text-gray-600">Need: {ngo.currentNeedDescription}</p>}
            <div className="mt-4 flex items-center gap-3">
              <Link to={`/ngos/${ngo.ngoId}`} className="btn-secondary"><MapPin className="h-4 w-4" /> View NGO</Link>
              <span className="text-xs text-gray-500">{ngo.isAcceptingDonations ? 'Accepting donations' : 'Currently paused'}</span>
            </div>
          </article>)}
        </div>
      )}
    </DashboardLayout>
  );
}
