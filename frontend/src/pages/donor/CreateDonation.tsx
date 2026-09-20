import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Image as ImageIcon, MapPin, Navigation, Trash2 } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Textarea from '@/components/common/Textarea';
import Button from '@/components/common/Button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { donationService } from '@/services/services';
import { FOOD_CATEGORIES, QUANTITY_UNITS, type GeoPoint, type QuantityUnit } from '@/types';

export default function CreateDonation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetNgoId = searchParams.get('ngoId') || undefined;
  const targetNgoName = searchParams.get('ngoName') || '';

  const [form, setForm] = useState({
    foodName: '',
    category: '',
    quantity: '',
    quantityValue: '',
    quantityUnit: '' as QuantityUnit | '',
    description: '',
    availableUntil: '',
    location: '',
  });
  const [geoLocation, setGeoLocation] = useState<GeoPoint | undefined>(undefined);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [otherSelected, setOtherSelected] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        setGeoLocation({
          type: 'Point',
          coordinates: [Number(longitude.toFixed(6)), Number(latitude.toFixed(6))],
        });
        toast('Location coordinates captured!', 'success');
      },
      (err) => {
        setLocating(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setLocationError('Location permission denied. Please allow location access in your browser.');
            break;
          case err.POSITION_UNAVAILABLE:
            setLocationError('Location information is unavailable.');
            break;
          case err.TIMEOUT:
            setLocationError('The request to get your location timed out.');
            break;
          default:
            setLocationError('An error occurred while retrieving your location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!user) return;

    if (!form.availableUntil) {
      setError('Please provide when this donation is available until.');
      return;
    }

    const resolvedCategory = otherSelected ? customCategory.trim() : form.category.trim();
    if (otherSelected && !resolvedCategory) {
      setError('Custom category is required');
      return;
    }

    // Structured quantity pair validation
    const hasValue = form.quantityValue.trim() !== '';
    const hasUnit = form.quantityUnit !== '';

    if (hasValue && !hasUnit) {
      setError('Please select a unit for the structured quantity value.');
      return;
    }

    if (hasUnit && !hasValue) {
      setError('Please enter a number for the structured quantity value.');
      return;
    }

    if (hasValue && (Number.isNaN(Number(form.quantityValue)) || Number(form.quantityValue) < 0)) {
      setError('Quantity value must be a valid non-negative number.');
      return;
    }

    setLoading(true);
    try {
      await donationService.create({
        foodName: form.foodName,
        category: resolvedCategory || form.category,
        quantity: form.quantity,
        quantityValue: hasValue ? Number(form.quantityValue) : undefined,
        quantityUnit: hasUnit ? form.quantityUnit : undefined,
        description: form.description,
        location: form.location,
        geoLocation: geoLocation || undefined,
        availableUntil: new Date(form.availableUntil).toISOString(),
        imageFile: imageFile || undefined,
        targetNgoId,
      });
      toast(targetNgoId ? 'Direct Offer sent successfully!' : 'Donation posted successfully!', 'success');
      navigate('/my-donations');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post donation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">{targetNgoId ? `Making a Direct Offer to ${targetNgoName}` : 'Donate Food'}</h1>
        <p className="text-gray-500 mb-6">Fill in the same donation details used for every FreshTrack food post.</p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <Input
            label="Food Name"
            placeholder="e.g. Fresh Vegetable Curry"
            value={form.foodName}
            onChange={(e) => handleChange('foodName', e.target.value)}
            required
          />

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Select label="Food Category" value={otherSelected ? 'Other' : form.category} onChange={(e) => { const value = e.target.value; setOtherSelected(value === 'Other'); handleChange('category', value === 'Other' ? '' : value); if (value === 'Other') setCustomCategory(''); }} required>
                <option value="">Select category</option>
                {FOOD_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                {form.category && !FOOD_CATEGORIES.includes(form.category as typeof FOOD_CATEGORIES[number]) && <option value={form.category}>{form.category}</option>}
              </Select>
              {otherSelected && <div className="mt-2 flex gap-2"><Input aria-label="Custom category" placeholder="e.g. Chocolates" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} /><Button type="button" size="sm" onClick={() => { if (customCategory.trim()) { handleChange('category', customCategory.trim()); setCustomCategory(''); setOtherSelected(false); } }}>Add</Button></div>}
            </div>
            <Input
              label="Quantity Display"
              placeholder="e.g. 15 servings, 5 kg"
              value={form.quantity}
              onChange={(e) => handleChange('quantity', e.target.value)}
              hint="Free-text description shown on donation cards."
              required
            />
          </div>

          {/* Structured quantity section */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Structured Quantity (Optional / Recommended)
              </span>
              <span className="text-xs text-gray-400">Used for smart recommendations</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Quantity Value"
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 15"
                value={form.quantityValue}
                onChange={(e) => handleChange('quantityValue', e.target.value)}
              />
              <Select
                label="Quantity Unit"
                value={form.quantityUnit}
                onChange={(e) => handleChange('quantityUnit', e.target.value as QuantityUnit)}
              >
                <option value="">Select unit</option>
                {QUANTITY_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <Textarea
            label="Description"
            placeholder="Describe the food — what it is, how it was prepared, any allergens, etc."
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
            required
          />

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Available Until"
              type="datetime-local"
              value={form.availableUntil}
              onChange={(e) => handleChange('availableUntil', e.target.value)}
              required
            />
            <Input
              label="Pickup Location Address"
              placeholder="e.g. Downtown Community Center, 123 Main St"
              value={form.location}
              onChange={(e) => handleChange('location', e.target.value)}
              required
            />
          </div>

          {/* Pickup Coordinates Section */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
            <label className="label mb-0 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-primary-600" /> Pickup Coordinates (Optional)
            </label>
            <p className="text-xs text-gray-500">
              If omitted, FreshTrack will automatically use your profile's base location.
            </p>

            {geoLocation?.coordinates ? (
              <div className="p-2.5 bg-white border border-gray-200 rounded-lg flex items-center justify-between">
                <div className="text-xs">
                  <span className="text-gray-500 font-medium">Selected Coordinates:</span>{' '}
                  <span className="font-mono font-medium text-gray-900">
                    Lat {geoLocation.coordinates[1]}, Lng {geoLocation.coordinates[0]}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setGeoLocation(undefined)}
                  className="text-xs text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400">No custom coordinates selected for this pickup.</p>
            )}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleGetLocation}
              disabled={locating}
            >
              <Navigation className="w-3.5 h-3.5" /> {locating ? 'Detecting Location...' : 'Use My Location'}
            </Button>

            {locationError && <p className="text-xs text-red-600">{locationError}</p>}
          </div>

          <div>
            <label className="label">Food Image</label>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                {imagePreview ? (
                  <img src={imagePreview} alt="Food preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No image</div>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="input"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setImageFile(file);
                    setImagePreview(file ? URL.createObjectURL(file) : '');
                  }}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5" /> Optional. JPG, PNG, WEBP, and GIF are supported.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Posting...' : 'Post Donation'}
            </Button>
            <Link to="/dashboard" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

