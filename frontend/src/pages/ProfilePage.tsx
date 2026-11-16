import { useEffect, useState } from 'react';
import {
  User as UserIcon,
  Mail,
  Phone,
  Building2,
  Edit,
  Save,
  X,
  MapPin,
  Navigation,
  Tag,
  FileText,
  Radio,
  Trash2
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Input from '@/components/common/Input';
import Textarea from '@/components/common/Textarea';
import Button from '@/components/common/Button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { userService, type UpdateProfilePayload } from '@/services/services';
import { normalizeApiErrorMessage } from '@/services/api';
import { LoadingSpinner, ErrorState } from '@/components/common/LoadingSpinner';
import { FOOD_CATEGORIES, type GeoPoint } from '@/types';

const CATEGORY_PRESETS = [...FOOD_CATEGORIES, 'Any'] as const;

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    organizationName: user?.organizationName || '',
    location: user?.location || '',
    geoLocation: (user?.geoLocation ?? undefined) as GeoPoint | null | undefined,
    acceptedCategories: user?.acceptedCategories || ([] as string[]),
    operatingRadiusKm: user?.operatingRadiusKm !== undefined ? String(user?.operatingRadiusKm) : '',
    isAcceptingDonations: user?.isAcceptingDonations ?? true,
    currentNeedDescription: user?.currentNeedDescription || '',
  });
  const [categoryChoice, setCategoryChoice] = useState('');
  const [customCategory, setCustomCategory] = useState('');

  useEffect(() => {
    if (!user?.id) return;

    userService
      .getMe()
      .then((freshUser) => {
        updateUser(freshUser);
        setForm({
          name: freshUser.name,
          email: freshUser.email,
          phone: freshUser.phone || '',
          organizationName: freshUser.organizationName || '',
          location: freshUser.location || '',
          geoLocation: freshUser.geoLocation ?? undefined,
          acceptedCategories: freshUser.acceptedCategories || [],
          operatingRadiusKm: freshUser.operatingRadiusKm !== undefined ? String(freshUser.operatingRadiusKm) : '',
          isAcceptingDonations: freshUser.isAcceptingDonations ?? true,
          currentNeedDescription: freshUser.currentNeedDescription || '',
        });
      })
      .catch(() => setPageError(true))
      .finally(() => setPageLoading(false));
  }, [user?.id, updateUser]);

  if (!user) return null;

  if (pageLoading) {
    return (
      <DashboardLayout>
        <LoadingSpinner label="Loading profile..." />
      </DashboardLayout>
    );
  }

  if (pageError) {
    return (
      <DashboardLayout>
        <ErrorState message="Failed to load profile." onRetry={() => window.location.reload()} />
      </DashboardLayout>
    );
  }

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
        setForm((prev) => ({
          ...prev,
          geoLocation: {
            type: 'Point',
            coordinates: [Number(longitude.toFixed(6)), Number(latitude.toFixed(6))],
          },
        }));
        toast('Location captured! Click "Save Changes" to apply.', 'success');
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

  const handleSave = async () => {
    if (user.role === 'ngo') {
      if (form.operatingRadiusKm && (Number.isNaN(Number(form.operatingRadiusKm)) || Number(form.operatingRadiusKm) < 0)) {
        toast('Operating radius must be a valid non-negative number.', 'error');
        return;
      }
      if (form.currentNeedDescription && form.currentNeedDescription.length > 500) {
        toast('Current need description cannot exceed 500 characters.', 'error');
        return;
      }
    }

    setLoading(true);
    try {
      const payload: UpdateProfilePayload = {
        name: user.role === 'donor' ? form.name : user.name,
        phone: form.phone,
        geoLocation: form.geoLocation,
        location: user.role === 'ngo' ? form.location.trim() : undefined,
      };

      if (user.role === 'ngo') {
        payload.organizationName = form.organizationName || undefined;
        payload.acceptedCategories = form.acceptedCategories;
        payload.operatingRadiusKm = form.operatingRadiusKm === '' ? null : Number(form.operatingRadiusKm);
        payload.isAcceptingDonations = form.isAcceptingDonations;
        payload.currentNeedDescription = form.currentNeedDescription.trim();
      }

      const updated = await userService.updateMe(payload);
      updateUser(updated);
      toast('Profile updated successfully!', 'success');
      setEditing(false);
    } catch (err) {
      toast(normalizeApiErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      organizationName: user.organizationName || '',
      location: user.location || '',
      geoLocation: user.geoLocation,
      acceptedCategories: user.acceptedCategories || [],
      operatingRadiusKm: user.operatingRadiusKm !== undefined ? String(user.operatingRadiusKm) : '',
      isAcceptingDonations: user.isAcceptingDonations ?? true,
      currentNeedDescription: user.currentNeedDescription || '',
    });
    setLocationError('');
    setEditing(false);
  };

  const addCategory = (value: string) => {
    const category = value.trim();
    if (!category) return;
    setForm((prev) => prev.acceptedCategories.includes(category)
      ? prev
      : { ...prev, acceptedCategories: [...prev.acceptedCategories, category] });
    setCategoryChoice('');
  };

  const addCustomCategory = () => {
    addCategory(customCategory);
    setCustomCategory('');
  };

  const hasGeoLocation = user.geoLocation?.coordinates && user.geoLocation.coordinates.length === 2;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Profile</h1>
        <p className="text-gray-500 mb-6">View and manage your account information.</p>

        <div className="card overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-500 to-primary-700 px-6 py-8">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <span className="text-2xl font-bold text-white">
                  {(user.role === 'ngo' ? (user.organizationName || 'N') : user.name).charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{user.role === 'ngo' ? (user.organizationName || 'NGO') : user.name}</h2>
                <p className="text-primary-100 capitalize">{user.role}{user.organizationName && ` · ${user.organizationName}`}</p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-6">
            {editing ? (
              <div className="space-y-5">
                {user.role === 'donor' && (
                  <Input
                    label="Full Name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                )}
                <Input
                  label="Email"
                  value={form.email}
                  disabled
                  hint="Email cannot be changed"
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                {user.role === 'ngo' && (
                  <Input
                    label="Organization Name"
                    value={form.organizationName}
                    onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                  />
                )}
                {user.role === 'ngo' && (
                  <Input
                    label="Location"
                    placeholder="Area or city"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                )}

                {/* Location Section */}
                <div className="border-t border-gray-100 pt-4">
                  <label className="label mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-primary-600" /> Base Location / Coordinates
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Required for distance-based recommendations.
                  </p>

                  {form.geoLocation?.coordinates && form.geoLocation.coordinates.length === 2 ? (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between mb-3">
                      <div className="text-sm">
                        <span className="text-gray-500">Coordinates:</span>{' '}
                        <span className="font-mono font-medium text-gray-900">
                          {form.geoLocation.coordinates[1].toFixed(5)}, {form.geoLocation.coordinates[0].toFixed(5)}
                        </span>
                        <span className="text-xs text-gray-400 block mt-0.5">
                          (Lat: {form.geoLocation.coordinates[1]}, Lng: {form.geoLocation.coordinates[0]})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, geoLocation: null })}
                        className="text-xs text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Clear
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 border border-dashed border-gray-200 rounded-lg text-sm text-gray-500 mb-3">
                      No coordinates set. Click the button below to use your browser location.
                    </div>
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

                  {locationError && (
                    <p className="mt-2 text-xs text-red-600">{locationError}</p>
                  )}
                </div>

                {/* NGO-specific edit section */}
                {user.role === 'ngo' && (
                  <div className="border-t border-gray-100 pt-4 space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900">NGO Settings & Needs</h3>

                    <div>
                      <label className="label mb-2 flex items-center gap-1.5">
                        <Tag className="w-4 h-4 text-primary-600" /> Accepted Food Categories
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {form.acceptedCategories.length > 0 ? (
                          form.acceptedCategories.map((category) => (
                            <button key={category} type="button" onClick={() => setForm({ ...form, acceptedCategories: form.acceptedCategories.filter((item) => item !== category) })} className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-red-50 hover:text-red-700">
                              {category} <span aria-hidden="true">×</span>
                            </button>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500">No categories added yet.</span>
                        )}
                      </div>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
                        <select className="input text-sm sm:flex-1" value={categoryChoice} onChange={(e) => {
                          const nextValue = e.target.value;
                          setCategoryChoice(nextValue);
                          if (nextValue === 'Other') return;
                          if (nextValue) addCategory(nextValue);
                        }}>
                          <option value="">Add category</option>
                          {CATEGORY_PRESETS.filter((category) => !form.acceptedCategories.includes(category)).map((category) => <option key={category} value={category}>{category}</option>)}
                        </select>
                        {categoryChoice === 'Other' && (
                          <div className="flex w-full gap-2 sm:flex-[1.5]">
                            <Input className="min-w-0 flex-1 text-sm" placeholder="Custom category" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} />
                            <Button type="button" size="sm" onClick={() => {
                              if (!customCategory.trim()) {
                                toast('Custom category is required', 'error');
                                return;
                              }
                              addCustomCategory();
                              setCategoryChoice('');
                            }}>Add</Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <Input
                      label="Operating Radius (km)"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="No limit"
                      value={form.operatingRadiusKm}
                      onChange={(e) => setForm({ ...form, operatingRadiusKm: e.target.value })}
                    />

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="isAcceptingDonations"
                        checked={form.isAcceptingDonations}
                        onChange={(e) => setForm({ ...form, isAcceptingDonations: e.target.checked })}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <label htmlFor="isAcceptingDonations" className="text-sm font-medium text-gray-700 cursor-pointer">
                        Currently accepting donations
                      </label>
                    </div>

                    <Textarea
                      label="Current Needs / Urgent Request Notes"
                      placeholder="Current needs"
                      value={form.currentNeedDescription}
                      maxLength={500}
                      onChange={(e) => setForm({ ...form, currentNeedDescription: e.target.value })}
                      hint={`${form.currentNeedDescription.length}/500 characters`}
                    />
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-gray-100">
                  <Button onClick={handleSave} disabled={loading}>
                    <Save className="w-4 h-4" /> {loading ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button variant="secondary" onClick={handleCancel}>
                    <X className="w-4 h-4" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {user.role === 'donor' && <InfoRow icon={UserIcon} label="Name" value={user.name} />}
                <InfoRow icon={Mail} label="Email" value={user.email} />
                <InfoRow icon={Phone} label="Phone" value={user.phone || 'N/A'} />
                <InfoRow icon={Building2} label="Role" value={user.role} />
                {user.organizationName && (
                  <InfoRow icon={Building2} label="Organization" value={user.organizationName} />
                )}

                <InfoRow
                  icon={MapPin}
                  label="Saved Location Coordinates"
                  value={
                    hasGeoLocation
                      ? `Lat: ${user.geoLocation!.coordinates[1].toFixed(4)}, Lng: ${user.geoLocation!.coordinates[0].toFixed(4)}`
                      : 'Not set'
                  }
                />
                {user.role === 'ngo' && <InfoRow icon={MapPin} label="Location" value={user.location || 'Not specified'} />}

                {user.role === 'ngo' && (
                  <div className="border-t border-gray-100 pt-3 space-y-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">NGO Profile & Preferences</h3>

                    <InfoRow
                      icon={Radio}
                      label="Accepting Donations"
                      value={user.isAcceptingDonations !== false ? 'Yes (Accepting)' : 'No (Paused)'}
                    />

                    <InfoRow
                      icon={Navigation}
                      label="Operating Radius"
                      value={user.operatingRadiusKm !== undefined ? `${user.operatingRadiusKm} km` : 'No limit'}
                    />

                    <div className="py-2 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Tag className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Accepted Food Categories</p>
                          {user.acceptedCategories && user.acceptedCategories.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {user.acceptedCategories.map((c) => (
                                <span key={c} className="badge bg-primary-50 text-primary-700 text-xs px-2 py-0.5 rounded-full font-medium">
                                  {c}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm font-medium text-gray-900">None specified</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="py-2 border-b border-gray-100">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <FileText className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Current Needs</p>
                          <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">
                            {user.currentNeedDescription || 'None specified'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <Button onClick={() => setEditing(true)}>
                    <Edit className="w-4 h-4" /> Edit Profile
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof UserIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-gray-500" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}
