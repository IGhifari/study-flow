import { createBffProxyHandler } from '@/lib/bff-proxy';

const handleProxy = createBffProxyHandler('/api/search');

export const GET = handleProxy;
