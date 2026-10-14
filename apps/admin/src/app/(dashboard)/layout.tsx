'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { AdminHeader } from '@/components/admin-header';
import { useAdminAuth } from '@/components/admin-auth-context';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAdminAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center p-8 bg-background">
        <div className="flex flex-col items-center gap-4 max-w-sm w-full">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AdminHeader />
        <main className="flex-1 bg-background">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
