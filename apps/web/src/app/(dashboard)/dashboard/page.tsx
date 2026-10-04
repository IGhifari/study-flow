import * as React from 'react';
import { redirect } from 'next/navigation';
import { getServerSessionUser } from '@/lib/auth-server';
import { DashboardContent } from './dashboard-content';

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const user = await getServerSessionUser();

  if (!user) {
    redirect('/login');
  }

  return <DashboardContent user={user} />;
}
