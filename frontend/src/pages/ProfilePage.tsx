import { useState } from 'react';
import { User as UserIcon, Mail, Phone, Building2, Edit, Save, X } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Button from '@/components/common/Button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { userService } from '@/services/services';
import type { UserRole } from '@/types';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    organizationName: user?.organizationName || '',
  });

  if (!user) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      const updated = await userService.update(user.id, {
        name: form.name,
        phone: form.phone,
        organizationName: form.organizationName || undefined,
      });
      updateUser(updated);
      toast('Profile updated successfully!', 'success');
      setEditing(false);
    } catch {
      toast('Failed to update profile. Please try again.', 'error');
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
    });
    setEditing(false);
  };

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
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{user.name}</h2>
                <p className="text-primary-100 capitalize">{user.role}{user.organizationName && ` · ${user.organizationName}`}</p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-6">
            {editing ? (
              <div className="space-y-4">
                <Input
                  label="Full Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
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
                <div className="flex gap-3 pt-2">
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
                <InfoRow icon={UserIcon} label="Name" value={user.name} />
                <InfoRow icon={Mail} label="Email" value={user.email} />
                <InfoRow icon={Phone} label="Phone" value={user.phone || 'N/A'} />
                <InfoRow icon={Building2} label="Role" value={user.role} />
                {user.organizationName && (
                  <InfoRow icon={Building2} label="Organization" value={user.organizationName} />
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
        <p className="text-sm font-medium text-gray-900 capitalize">{value}</p>
      </div>
    </div>
  );
}
