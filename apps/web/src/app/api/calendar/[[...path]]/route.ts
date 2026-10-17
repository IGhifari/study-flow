import { createBffProxyHandler } from '@/lib/bff-proxy';

const handleProxy = createBffProxyHandler('/api/calendar');

export const GET = handleProxy;
