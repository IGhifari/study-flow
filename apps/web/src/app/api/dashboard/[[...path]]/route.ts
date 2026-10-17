import { createBffProxyHandler } from '@/lib/bff-proxy';

const handleProxy = createBffProxyHandler('/api/dashboard');

export const GET = handleProxy;
