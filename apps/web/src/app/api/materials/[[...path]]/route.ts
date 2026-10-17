import { createBffProxyHandler } from '@/lib/bff-proxy';

const handleProxy = createBffProxyHandler('/api/materials');

export const GET = handleProxy;
export const POST = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
