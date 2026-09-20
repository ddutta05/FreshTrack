import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, UserRole } from '@/types';
import { authService } from '@/services/services';
import { setUnauthorizedHandler } from '@/services/api';
import { disconnectSocket } from '@/services/socket';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, role: UserRole, rememberMe?: boolean) => Promise<User>;
  register: (payload: {
    name?: string;
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

function clearChatStorage() {
  Object.keys(sessionStorage)
    .filter((key) => key.startsWith('freshtrack_ai_chat_'))
    .forEach((key) => sessionStorage.removeItem(key));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      authService.logout();
      clearChatStorage();
      disconnectSocket();
      setUser(null);

      const path = window.location.pathname;
      if (path !== '/login' && path !== '/register') {
        window.location.href = '/login';
      }
    });

    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('freshtrack_token') || sessionStorage.getItem('freshtrack_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await authService.me();
        setUser(currentUser);
        const storage = localStorage.getItem('freshtrack_token') ? localStorage : sessionStorage;
        storage.setItem('freshtrack_user', JSON.stringify(currentUser));
      } catch {
        authService.logout();
        disconnectSocket();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string, role: UserRole, rememberMe = false) => {
    const user = await authService.login(email, password, role, rememberMe);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (payload: Parameters<AuthContextValue['register']>[0]) => {
    const user = await authService.register(payload);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(() => {
    clearChatStorage();
    authService.logout();
    disconnectSocket();
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    const storage = localStorage.getItem('freshtrack_token') ? localStorage : sessionStorage;
    storage.setItem('freshtrack_user', JSON.stringify(updatedUser));
  }, []);

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
