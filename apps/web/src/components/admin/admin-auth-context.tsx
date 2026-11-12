'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { UserProfile } from '@studyflow/shared';
import { fetchAdminMe, logoutAdminApi } from '@/lib/admin-api';
import { apiLogout } from '@/lib/auth-client';

interface AdminAuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AdminAuthContext = React.createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({
  initialUser = null,
  children,
}: {
  initialUser?: UserProfile | null;
  children: React.ReactNode;
}) {
  const [user, setUser] = React.useState<UserProfile | null>(initialUser);
  const [isLoading, setIsLoading] = React.useState<boolean>(!initialUser);
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (initialUser) {
      setUser(initialUser);
      setIsLoading(false);
    }
  }, [initialUser]);

  const loadUser = React.useCallback(async () => {
    try {
      const data = await fetchAdminMe();
      if (data.user.role !== 'ADMIN') {
        setUser(null);
        if (pathname !== '/login') {
          router.push('/login?error=unauthorized');
        }
        return;
      }
      setUser(data.user);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('studyflow:profile-updated', { detail: data.user }));
      }
    } catch {
      setUser(null);
      if (pathname !== '/login') {
        router.push('/login');
      }
    } finally {
      setIsLoading(false);
    }
  }, [pathname, router]);

  React.useEffect(() => {
    if (!initialUser) {
      loadUser();
    }
  }, [initialUser, loadUser]);

  const logout = async () => {
    try {
      await Promise.allSettled([apiLogout(), logoutAdminApi()]);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        isLoading,
        logout,
        refreshUser: loadUser,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = React.useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
