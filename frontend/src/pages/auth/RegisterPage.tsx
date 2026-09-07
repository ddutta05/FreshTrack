import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Leaf, Eye, EyeOff } from 'lucide-react';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Button from '@/components/common/Button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { UserRole } from '@/types';
import { ApiError } from '@/services/api';

export default function RegisterPage() {
  const { register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('donor');
  const [phone, setPhone] = useState('');
  const [orgName, setOrgName] = useState('');
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
    if (trimmedPhone.length > 30) {
      setError('Phone must be 30 characters or less.');
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
      });
      toast(`Account created! Welcome, ${user.name.split(' ')[0]}.`, 'success');
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) {
        setError(err.details[0].message);
      } else {
        setError(err instanceof Error ? err.message : 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
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
                onChange={(e) => setRole(e.target.value as UserRole)}
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
                  />
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
