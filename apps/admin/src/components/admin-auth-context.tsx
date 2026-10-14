'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { UserProfile } from '@studyflow/shared';
import { fetchAdminMe, logoutAdminApi } from '@/lib/admin-api';

interface AdminAuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AdminAuthContext = React.createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

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
    loadUser();
  }, [loadUser]);

  const logout = async () => {
    try {
      await logoutAdminApi();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      router.push('/login');
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
