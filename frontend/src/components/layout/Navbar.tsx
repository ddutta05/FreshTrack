import { Link, useNavigate } from 'react-router-dom';
import { Leaf, Home, Info, LogIn, UserPlus, LogOut, LayoutDashboard, Heart, Package, Users, ShoppingBag, ClipboardList, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import NotificationDropdown from './NotificationDropdown';

const roleNavItems = {
  donor: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/my-donations', label: 'My Donations', icon: Package },
    { to: '/profile', label: 'Profile', icon: Users },
  ],
  ngo: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/available-food', label: 'Available Food', icon: ShoppingBag },
    { to: '/my-requests', label: 'My Requests', icon: ClipboardList },
    { to: '/profile', label: 'Profile', icon: Users },
  ],
  admin: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/donations', label: 'Donations', icon: Package },
  ],
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = user ? roleNavItems[user.role] : [];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">FreshTrack</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {!user ? (
              <>
                <Link to="/" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-primary-700 hover:bg-primary-50 transition-colors">
                  <Home className="w-4 h-4" /> Home
                </Link>
                <Link to="/about" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-primary-700 hover:bg-primary-50 transition-colors">
                  <Info className="w-4 h-4" /> About
                </Link>
                <Link to="/login" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-primary-700 hover:bg-primary-50 transition-colors">
                  <LogIn className="w-4 h-4" /> Login
                </Link>
                <Link to="/register" className="btn-primary ml-2">
                  <UserPlus className="w-4 h-4" /> Register
                </Link>
              </>
            ) : (
              <>
                {navItems.map((item) => (
                  <Link key={item.to} to={item.to} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-primary-700 hover:bg-primary-50 transition-colors">
                    <item.icon className="w-4 h-4" /> {item.label}
                  </Link>
                ))}
                {user && user.role !== 'admin' && <NotificationDropdown />}
                <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors ml-1">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden py-3 border-t border-gray-100 animate-slide-down">
            {!user ? (
              <div className="flex flex-col gap-1">
                <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-primary-50">
                  <Home className="w-4 h-4" /> Home
                </Link>
                <Link to="/about" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-primary-50">
                  <Info className="w-4 h-4" /> About
                </Link>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-primary-50">
                  <LogIn className="w-4 h-4" /> Login
                </Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-primary-700 hover:bg-primary-50">
                  <UserPlus className="w-4 h-4" /> Register
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-primary-50">
                    <item.icon className="w-4 h-4" /> {item.label}
                  </Link>
                ))}
                <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 text-left">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
