import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { prisma } from '@studyflow/database';
import serverlessApp, { app as namedApp, createApp } from '../index.js';
import vercelHandler, { app as vercelNamedApp } from '../../api/index.js';
import * as appModule from '../app.js';
import { dispatchOutboxEvents, flushOutboxForRequest } from '../services/outbox.service.js';
import { setStorageAdapterForTesting, type StorageAdapter } from '../services/storage.service.js';

describe('Serverless Express Entry Point & Outbox Flush Verification', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setStorageAdapterForTesting(null);
  });

  it('exports valid Express application from src/index.ts and api/index.ts without starting listener', async () => {
    expect(typeof serverlessApp).toBe('function');
    expect(serverlessApp).toBe(namedApp);
    expect(vercelHandler).toBe(serverlessApp);
    expect(vercelNamedApp).toBe(serverlessApp);
    expect(typeof createApp).toBe('function');

    const res = await request(vercelHandler).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('studyflow-api');
    expect(res.headers['x-request-id']).toBeDefined();

    // Ensure src/app.ts remains strictly the factory module without a default export
    expect(typeof appModule.createApp).toBe('function');
    expect('default' in appModule).toBe(false);

    // Ensure vercel.json disables the automatic Express framework preset (which would scan src/app.ts)
    // and routes all requests to /api (api/index.ts)
    const vercelConfigPath = path.resolve(process.cwd(), 'vercel.json');
    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf-8'));
    expect(vercelConfig.framework).toBeNull();
    expect(vercelConfig.functions?.['api/index.ts']).toBeDefined();
    expect(vercelConfig.rewrites).toEqual([{ source: '/(.*)', destination: '/api' }]);
  });

  it('preserves CORS, security headers, and rate-limit headers on serverless entry point', async () => {
    const res = await request(vercelHandler)
      .get('/health')
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('flushOutboxForRequest prioritizes targeted aggregateId and marks event PUBLISHED', async () => {
    const removedKeys: string[] = [];
    const mockAdapter: StorageAdapter = {
      async createSignedUploadUrl() {
        return { data: null, error: null };
      },
      async createSignedUrl() {
        return { data: null, error: null };
      },
      async download() {
        return { data: null, error: null };
      },
      async remove(paths: string[]) {
        removedKeys.push(...paths);
        return { data: [], error: null };
      },
      async info() {
        return { data: null, error: null };
      },
      async upload() {
        return { data: null, error: null };
      },
    };
    setStorageAdapterForTesting(mockAdapter);

    const findManySpy = vi.spyOn(prisma.outboxEvent, 'findMany').mockResolvedValueOnce([
      {
        id: 'evt_target_1',
        aggregateId: 'mat_target_1',
        eventType: 'DOCUMENT_CLEANUP_REQUESTED',
        payload: { storageKey: 'materials/u1/target.pdf', userId: 'u1' },
        attempts: 0,
        status: 'PENDING',
        lastError: null,
        createdAt: new Date(),
        publishedAt: null,
      } as any,
    ]);

    const updateManySpy = vi
      .spyOn(prisma.outboxEvent, 'updateMany')
      .mockResolvedValueOnce({ count: 1 });

    const res = await flushOutboxForRequest({ aggregateId: 'mat_target_1', timeoutMs: 1000 });

    expect(res.dispatched).toBe(1);
    expect(res.failed).toBe(0);
    expect(removedKeys).toEqual(['materials/u1/target.pdf']);
    expect(findManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PENDING',
          aggregateId: 'mat_target_1',
        }),
      })
    );
    expect(updateManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evt_target_1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'PUBLISHED' }),
      })
    );
  });

  it('flushOutboxForRequest bounds latency with timeoutMs when downstream queue/DB is slow', async () => {
    vi.spyOn(prisma.outboxEvent, 'findMany').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([]), 2000);
        }) as any
    );

    const start = Date.now();
    const res = await flushOutboxForRequest({ aggregateId: 'mat_slow_1', timeoutMs: 80 });
    const elapsed = Date.now() - start;

    expect(res.timedOut).toBe(true);
    expect(elapsed).toBeLessThan(500);
  });

  it('dispatchOutboxEvents remains backward-compatible when called without arguments', async () => {
    const findManySpy = vi.spyOn(prisma.outboxEvent, 'findMany').mockResolvedValueOnce([]);
    const res = await dispatchOutboxEvents();
    expect(res).toEqual({ dispatched: 0, failed: 0 });
    expect(findManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      })
    );
  });
});
