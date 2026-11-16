import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Leaf, Eye, EyeOff, MapPin, Navigation } from 'lucide-react';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Button from '@/components/common/Button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { FOOD_CATEGORIES, type GeoPoint, type UserRole } from '@/types';
import { ApiError, normalizeApiErrorMessage } from '@/services/api';

export default function RegisterPage() {
  const { register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>(searchParams.get('role') === 'ngo' ? 'ngo' : 'donor');
  const [phone, setPhone] = useState('');
  const [orgName, setOrgName] = useState('');
  const [location, setLocation] = useState('');
  const [geoLocation, setGeoLocation] = useState<GeoPoint | null>(null);
  const [manualLongitude, setManualLongitude] = useState('');
  const [manualLatitude, setManualLatitude] = useState('');
  const [acceptedCategories, setAcceptedCategories] = useState<string[]>([]);
  const [categoryChoice, setCategoryChoice] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [customCategoryError, setCustomCategoryError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();
    const trimmedOrgName = orgName.trim();
    const trimmedLocation = location.trim();

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (role === 'donor' && (trimmedName.length < 2 || trimmedName.length > 100)) {
      setError('Name must be 2-100 characters.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!/[A-Za-z]/.test(password)) {
      setError('Password must include at least one letter.');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError('Password must include at least one number.');
      return;
    }
    if (role === 'ngo' && !orgName.trim()) {
      setError('Organization name is required for NGO accounts.');
      return;
    }
    if (role === 'ngo' && (trimmedOrgName.length < 2 || trimmedOrgName.length > 150)) {
      setError('Organization name must be 2-150 characters.');
      return;
    }
    if (role === 'ngo' && !trimmedPhone) {
      setError('Phone is required for NGO accounts.');
      return;
    }
    if (role === 'ngo' && !trimmedLocation) {
      setError('Location is required for NGO accounts.');
      return;
    }
    if (role === 'ngo' && acceptedCategories.length === 0) {
      setError('Select at least one accepted food category.');
      return;
    }
    if (trimmedPhone.length > 30) {
      setError('Phone must be 30 characters or less.');
      return;
    }

    let registrationGeoLocation = geoLocation;
    if (role === 'ngo' && (manualLongitude.trim() || manualLatitude.trim())) {
      if (!manualLongitude.trim() || !manualLatitude.trim()) {
        setError('Enter both longitude and latitude for the base location.');
        return;
      }

      const longitude = Number(manualLongitude);
      const latitude = Number(manualLatitude);
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        setError('Longitude must be between -180 and 180.');
        return;
      }
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        setError('Latitude must be between -90 and 90.');
        return;
      }
      registrationGeoLocation = { type: 'Point', coordinates: [longitude, latitude] };
    }

    if (role === 'ngo' && !registrationGeoLocation) {
      setError('Use My Location or enter longitude and latitude so donors can discover your NGO.');
      return;
    }

    setLoading(true);
    try {
      const user = await register({
        name: role === 'donor' ? trimmedName : undefined,
        email: normalizedEmail,
        password,
        role,
        phone: trimmedPhone || undefined,
        organizationName: role === 'ngo' ? trimmedOrgName : undefined,
        location: role === 'ngo' ? trimmedLocation : undefined,
        geoLocation: role === 'ngo' ? registrationGeoLocation : undefined,
        acceptedCategories: role === 'ngo' ? acceptedCategories : undefined,
      });
      toast(`Account created! Welcome, ${user.name.split(' ')[0]}.`, 'success');
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) {
        setError(err.details[0].message);
      } else {
        setError(normalizeApiErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const longitude = Number(coords.longitude.toFixed(6));
        const latitude = Number(coords.latitude.toFixed(6));
        setGeoLocation({ type: 'Point', coordinates: [longitude, latitude] });
        setManualLongitude(String(longitude));
        setManualLatitude(String(latitude));
        setLocating(false);
      },
      (geoError) => {
        setLocating(false);
        setLocationError(geoError.code === geoError.PERMISSION_DENIED
          ? 'Location permission denied. Allow location access to register an NGO.'
          : 'Unable to get your location. Please try again.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const addCategory = (category: string) => {
    const trimmedCategory = category.trim();
    if (!trimmedCategory || acceptedCategories.includes(trimmedCategory)) return;
    setAcceptedCategories((current) => [...current, trimmedCategory]);
    setCategoryChoice('');
  };

  const addCustomCategory = () => {
    if (!customCategory.trim()) {
      setCustomCategoryError('Enter a custom category.');
      return;
    }

    addCategory(customCategory);
    setCustomCategory('');
    setCustomCategoryError('');
  };

  const handleRoleChange = (nextRole: UserRole) => {
    setRole(nextRole);
    setSearchParams({ role: nextRole }, { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <div className="w-11 h-11 rounded-xl bg-primary-600 flex items-center justify-center">
                <Leaf className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">FreshTrack</span>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
            <p className="text-gray-500 mt-1">Join FreshTrack and start making a difference</p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
            <Link to={`/login?role=${role}`} className="rounded-lg px-3 py-2 text-center text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors bg-white shadow-sm text-primary-700 ring-1 ring-primary-200">
              Log In
            </Link>
            <Link to="/register" className="rounded-lg px-3 py-2 text-center text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
              Create Account
            </Link>
          </div>

          <div className="card p-6 sm:p-8">
            {error && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {role === 'donor' && (
                <Input
                  label="Full Name"
                  placeholder="raj Carter"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              )}

              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <Input
                  label="Confirm Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <Select
                label="Role"
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
              >
                <option value="donor">Donor — I have surplus food to donate</option>
                <option value="ngo">NGO — I collect and distribute food</option>
              </Select>

              {role === 'ngo' && (
                <div className="space-y-4 animate-fade-in">
                  <Input
                    label="Organization Name"
                    placeholder="Hope Community Kitchen"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                  />
                  <Input
                    label="Contact Number"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                  <Input
                    label="Location"
                    placeholder="Muradpur, Chittagong"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    required
                  />
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <label className="label flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary-600" /> Base Location</label>
                    <p className="mb-2 text-xs text-gray-500">Required for NGO discovery. Use browser location or enter coordinates manually.</p>
                    {geoLocation ? (
                      <p className="mb-2 text-xs font-medium text-primary-700">Base location captured.</p>
                    ) : (
                      <p className="mb-2 text-xs text-gray-500">No base location captured yet.</p>
                    )}
                    <Button type="button" variant="secondary" size="sm" onClick={handleGetLocation} disabled={locating}>
                      <Navigation className="h-3.5 w-3.5" /> {locating ? 'Detecting Location...' : 'Use My Location'}
                    </Button>
                    {locationError && <p className="mt-2 text-xs text-red-600">{locationError}</p>}
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Input
                        label="Longitude"
                        type="number"
                        min={-180}
                        max={180}
                        step="any"
                        placeholder="-73.9857"
                        value={manualLongitude}
                        onChange={(e) => setManualLongitude(e.target.value)}
                      />
                      <Input
                        label="Latitude"
                        type="number"
                        min={-90}
                        max={90}
                        step="any"
                        placeholder="40.7484"
                        value={manualLatitude}
                        onChange={(e) => setManualLatitude(e.target.value)}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Enter decimal degrees in longitude, latitude order.</p>
                  </div>
                  <div>
                    <label className="label">Accepted Food Categories</label>
                    <div className="mb-2 flex flex-wrap gap-2">
                      {acceptedCategories.map((category) => (
                        <button key={category} type="button" onClick={() => setAcceptedCategories((current) => current.filter((item) => item !== category))} className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
                          {category} <span aria-hidden="true">×</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                      <select className="input text-sm sm:flex-1" value={categoryChoice} onChange={(e) => {
                        const nextValue = e.target.value;
                        setCategoryChoice(nextValue);
                        if (nextValue && nextValue !== 'Other') addCategory(nextValue);
                      }}>
                        <option value="">Add category</option>
                        {FOOD_CATEGORIES.filter((category) => !acceptedCategories.includes(category)).map((category) => <option key={category} value={category}>{category}</option>)}
                      </select>
                      {categoryChoice === 'Other' && (
                        <div className="flex w-full gap-2 sm:flex-[1.5]">
                          <Input className="min-w-0 flex-1 text-sm" placeholder="Custom category" value={customCategory} error={customCategoryError} onChange={(e) => {
                            setCustomCategory(e.target.value);
                            if (e.target.value.trim()) setCustomCategoryError('');
                          }} />
                          <Button type="button" size="sm" onClick={addCustomCategory}>Add</Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {role === 'donor' && (
                <Input
                  label="Phone (optional)"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Already have an account?{' '}
                <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                  Login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
