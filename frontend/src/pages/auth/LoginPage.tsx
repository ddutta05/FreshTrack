import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Leaf, Eye, EyeOff, UserCircle } from 'lucide-react';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Button from '@/components/common/Button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { normalizeApiErrorMessage } from '@/services/api';
import type { UserRole } from '@/types';

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
 const [searchParams] = useSearchParams();

const [role, setRole] = useState<UserRole>(
  searchParams.get('role') === 'ngo' ? 'ngo' : 'donor'
);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password, role, rememberMe);
      toast(`Welcome back, ${user.name.split(' ')[0]}!`, 'success');
      navigate('/dashboard');
    } catch (err) {
      setError(normalizeApiErrorMessage(err));
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
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-gray-500 mt-1">Sign in to your account to continue</p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
            <Link to="/login" className="rounded-lg px-3 py-2 text-center text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
              Log In
            </Link>
            <Link to={`/register?role=${role}`} className="rounded-lg px-3 py-2 text-center text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors bg-white shadow-sm text-primary-700 ring-1 ring-primary-200">
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
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

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
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <Select
                label="Role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                <option value="donor">Donor</option>
                <option value="ngo">NGO</option>
                <option value="admin">Admin</option>
              </Select>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-gray-600">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                  Remember me
                </label>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Login'}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Don't have an account?{' '}
                <Link to={`/register?role=${role}`}>
                  Create Account
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-4 card p-4 bg-primary-50/50 border-primary-100">
            <p className="text-xs text-gray-600 flex items-start gap-2">
              <UserCircle className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
              <span>
                Use your registered account credentials to sign in.
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
