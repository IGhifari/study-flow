import * as React from 'react';
import { redirect } from 'next/navigation';
import { getServerSessionUser } from '@/lib/auth-server';
import { DashboardContent } from './dashboard-content';
import AdminDashboardView from '@/components/admin/views/admin-dashboard-view';

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const user = await getServerSessionUser();

  if (!user) {
    redirect('/login');
  }

  if (user.role === 'ADMIN') {
    return <AdminDashboardView />;
  }

  return <DashboardContent user={user} />;
}
