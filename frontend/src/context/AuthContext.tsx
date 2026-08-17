import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, UserRole } from '@/types';
import { authService } from '@/services/services';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<User>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    phone?: string;
    organizationName?: string;
  }) => Promise<User>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = authService.getCurrentUser();
    if (stored) setUser(stored);
    setLoading(false);
  }, []);

  const login = async (email: string, password: string, role: UserRole) => {
    const user = await authService.login(email, password, role);
    setUser(user);
    return user;
  };

  const register = async (payload: Parameters<AuthContextValue['register']>[0]) => {
    const user = await authService.register(payload);
    setUser(user);
    return user;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('freshtrack_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
