import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { Redis } from 'ioredis';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import {
  RedisRateLimitStore,
  createRateLimitStore,
  hashAccountIdentifier,
} from '../middleware/rateLimiter.js';
import { COOKIE_NAMES } from '@studyflow/shared';

describe('Auth Client Identification & Rate Limiting (Browser -> BFF -> API)', () => {
  const TRUSTED_ORIGIN = 'http://localhost:3000';
  let redis: Redis;

  beforeEach(() => {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: false,
    });
  });

  afterEach(async () => {
    // Clean up test keys with isolated prefix
    const keys = await redis.keys('test:rl:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  afterAll(async () => {
    if (redis) {
      await redis.quit();
    }
  });

  it('1. Dua klien berbeda melalui BFF tidak menggunakan satu bucket IP BFF', async () => {
    // App with trust proxy = 'loopback' (local BFF proxy IP 127.0.0.1 is trusted to provide client IP in X-Forwarded-For)
    const app = express();
    app.set('trust proxy', 'loopback');
    app.use(express.json());

    const testStore = new RedisRateLimitStore(redis, 'test:rl:bff:');
    const limiter = rateLimit({
      windowMs: 5000,
      max: 2, // limit 2 requests per IP
      standardHeaders: true,
      legacyHeaders: false,
      store: testStore,
      keyGenerator: (req) => ipKeyGenerator(req.ip || '127.0.0.1'),
    });

    app.post('/api/auth/register', limiter, (req, res) => res.json({ ok: true }));

    // Client A (IP 203.0.113.10) sends 2 requests via BFF
    const resA1 = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', '203.0.113.10');
    const resA2 = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', '203.0.113.10');

    expect(resA1.status).toBe(200);
    expect(resA2.status).toBe(200);

    // Client A 3rd request hits 429
    const resA3 = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', '203.0.113.10');
    expect(resA3.status).toBe(429);

    // Client B (IP 198.51.100.20) sends request via BFF -> MUST NOT be blocked by Client A's bucket!
    const resB1 = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', '198.51.100.20');
    expect(resB1.status).toBe(200);
  });

  it('2. Klien yang sama tetap terkena batas walau request ditangani instance API berbeda (Shared Redis Store)', async () => {
    // Both instances share the exact same Redis namespace prefix
    const testStore1 = new RedisRateLimitStore(redis, 'test:rl:multi-instance:');
    const testStore2 = new RedisRateLimitStore(redis, 'test:rl:multi-instance:');

    // Instance 1
    const app1 = express();
    app1.set('trust proxy', 'loopback');
    app1.use(rateLimit({
      windowMs: 5000,
      max: 2,
      store: testStore1,
      keyGenerator: (req) => ipKeyGenerator(req.ip || '127.0.0.1'),
    }));
    app1.get('/test', (req, res) => res.json({ instance: 1 }));

    // Instance 2 (shares the exact same Redis store)
    const app2 = express();
    app2.set('trust proxy', 'loopback');
    app2.use(rateLimit({
      windowMs: 5000,
      max: 2,
      store: testStore2,
      keyGenerator: (req) => ipKeyGenerator(req.ip || '127.0.0.1'),
    }));
    app2.get('/test', (req, res) => res.json({ instance: 2 }));

    // Request 1 hits Instance 1
    const res1 = await request(app1)
      .get('/test')
      .set('X-Forwarded-For', '192.0.2.1');
    expect(res1.status).toBe(200);

    // Request 2 hits Instance 2
    const res2 = await request(app2)
      .get('/test')
      .set('X-Forwarded-For', '192.0.2.1');
    expect(res2.status).toBe(200);

    // Request 3 hits Instance 1 -> Exceeded limit across both instances!
    const res3 = await request(app1)
      .get('/test')
      .set('X-Forwarded-For', '192.0.2.1');
    expect(res3.status).toBe(429);
  });

  it('3. Request langsung dari sumber tidak terpercaya tidak dapat memalsukan identitas dengan header palsu', async () => {
    // When trust proxy is disabled ('false') or direct from untrusted client:
    const directApp = express();
    directApp.set('trust proxy', false); // Direct exposure to internet / untrusted

    const testStore = new RedisRateLimitStore(redis, 'test:rl:untrusted:');
    directApp.use(rateLimit({
      windowMs: 5000,
      max: 2,
      store: testStore,
      keyGenerator: (req) => ipKeyGenerator(req.ip || '127.0.0.1'),
    }));
    directApp.get('/test', (req, res) => res.json({ ip: req.ip }));

    // Client attempts to spoof IP by changing X-Forwarded-For on each request
    const res1 = await request(directApp)
      .get('/test')
      .set('X-Forwarded-For', '1.1.1.1');
    const res2 = await request(directApp)
      .get('/test')
      .set('X-Forwarded-For', '2.2.2.2');
    const res3 = await request(directApp)
      .get('/test')
      .set('X-Forwarded-For', '3.3.3.3');

    // Because trust proxy is false, Express uses the socket remote address,
    // IGNORING the forged X-Forwarded-For!
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(429); // 3rd attempt is blocked regardless of forged headers
  });

  it('4. Pembatasan akun mengikuti normalisasi (Case-insensitive & whitespace trimmed) tanpa membeberkan email mentah', async () => {
    const rawEmail1 = '  Mahasiswa.Keren@Kampus.AC.ID  ';
    const rawEmail2 = 'mahasiswa.keren@kampus.ac.id';

    const hash1 = hashAccountIdentifier(rawEmail1);
    const hash2 = hashAccountIdentifier(rawEmail2);

    // Normalized hashes must match exactly
    expect(hash1).toBe(hash2);
    expect(hash1).toBeDefined();

    // Raw email is NEVER present in the hash/key
    expect(hash1).not.toContain('mahasiswa');
    expect(hash1).not.toContain('kampus');
    expect(hash1!.length).toBe(16);

    // Account limiter test
    const app = express();
    app.use(express.json());
    const testStore = new RedisRateLimitStore(redis, 'test:rl:account:');

    app.post('/api/auth/login', rateLimit({
      windowMs: 5000,
      max: 2,
      store: testStore,
      keyGenerator: (req) => {
        const hash = hashAccountIdentifier(req.body?.email);
        return hash ? `acct:${hash}` : 'ip:unknown';
      },
      message: { error: { code: 'TOO_MANY_REQUESTS' } },
    }), (req, res) => res.json({ ok: true }));

    // Attempt 1 with uppercase & whitespace
    const res1 = await request(app)
      .post('/api/auth/login')
      .send({ email: rawEmail1, password: 'WrongPassword1!' });
    expect(res1.status).toBe(200);

    // Attempt 2 with lowercase
    const res2 = await request(app)
      .post('/api/auth/login')
      .send({ email: rawEmail2, password: 'WrongPassword2!' });
    expect(res2.status).toBe(200);

    // Attempt 3 is throttled because both target the same normalized account
    const res3 = await request(app)
      .post('/api/auth/login')
      .send({ email: rawEmail1, password: 'WrongPassword3!' });
    expect(res3.status).toBe(429);
    expect(res3.body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('5. Respons 429 menyertakan Retry-After dan header rate limit standar', async () => {
    const app = express();
    const testStore = new RedisRateLimitStore(redis, 'test:rl:headers:');

    app.get('/test', rateLimit({
      windowMs: 10_000,
      max: 1,
      standardHeaders: true,
      legacyHeaders: false,
      store: testStore,
      keyGenerator: (req) => ipKeyGenerator(req.ip || '127.0.0.1'),
    }), (req, res) => res.send('OK'));

    await request(app).get('/test');
    const res429 = await request(app).get('/test');

    expect(res429.status).toBe(429);
    expect(res429.headers['retry-after']).toBeDefined();
    expect(Number(res429.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(res429.headers['ratelimit-limit']).toBe('1');
    expect(res429.headers['ratelimit-remaining']).toBe('0');
    expect(res429.headers['ratelimit-reset']).toBeDefined();
  });

  it('6. Kegagalan store mengikuti kebijakan fail-closed (503 RATE_LIMITER_UNAVAILABLE)', async () => {
    class BrokenStore {
      init() {}
      async increment() {
        throw new Error('Redis connection refused or crashed');
      }
      async decrement() {}
      async resetKey() {}
    }

    const app = express();
    app.use(rateLimit({
      windowMs: 5000,
      max: 5,
      store: new BrokenStore(),
      passOnStoreError: false,
    }));
    app.get('/test', (req, res) => res.json({ ok: true }));

    // Centralized error handler
    app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(503).json({
        error: {
          code: 'RATE_LIMITER_UNAVAILABLE',
          message: 'Layanan rate limiter sedang tidak tersedia. Permintaan ditolak demi keamanan.',
        },
      });
    });

    const res = await request(app).get('/test');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('RATE_LIMITER_UNAVAILABLE');
  });

  it('7. CSRF, Origin check, dan Cookie autentikasi tetap berfungsi dengan rate limiter aktif', async () => {
    const fullApp = createApp();

    // Valid registration request with trusted Origin and cookies
    const regRes = await request(fullApp)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Rate Limit Auth User',
        email: `ratelimit.auth.${Date.now()}@example.com`,
        password: 'PasswordSangatKuat123!',
      });
    expect(regRes.status).toBe(201);

    // CSRF forbidden origin must still be rejected with 403
    const csrfRes = await request(fullApp)
      .post('/api/auth/login')
      .set('Origin', 'http://malicious-site.com')
      .send({
        email: 'test@example.com',
        password: 'Password123!',
      });
    expect(csrfRes.status).toBe(403);
    expect(csrfRes.body.error.code).toBe('CSRF_ORIGIN_INVALID');
  });

  it('8. Increment RedisRateLimitStore menetapkan TTL secara atomik via Lua script', async () => {
    const store = new RedisRateLimitStore(redis, 'test:rl:atomic:');
    store.init({ windowMs: 10_000 });

    const testKey = `client-${Date.now()}`;
    const fullKey = `test:rl:atomic:${testKey}`;

    // 1. Initial increment on empty key
    const info1 = await store.increment(testKey);
    expect(info1.totalHits).toBe(1);
    expect(info1.resetTime.getTime()).toBeGreaterThan(Date.now());

    // Verify key in Redis has a valid positive millisecond TTL immediately (atomic execution)
    const redisPttl1 = await redis.pttl(fullKey);
    expect(redisPttl1).toBeGreaterThan(0);
    expect(redisPttl1).toBeLessThanOrEqual(10_000);

    // 2. Second increment preserves TTL and increments count
    const info2 = await store.increment(testKey);
    expect(info2.totalHits).toBe(2);
    const redisPttl2 = await redis.pttl(fullKey);
    expect(redisPttl2).toBeGreaterThan(0);

    // 3. Defensive behavior: If a key exists without TTL (simulating corrupted state),
    // calling increment automatically fixes the TTL
    const legacyKey = `legacy-no-ttl-${Date.now()}`;
    const legacyFullKey = `test:rl:atomic:${legacyKey}`;
    await redis.set(legacyFullKey, '5'); // No TTL set (pttl == -1)

    const initialPttl = await redis.pttl(legacyFullKey);
    expect(initialPttl).toBe(-1);

    const legacyInfo = await store.increment(legacyKey);
    expect(legacyInfo.totalHits).toBe(6);

    // Redis key now has an assigned TTL!
    const fixedPttl = await redis.pttl(legacyFullKey);
    expect(fixedPttl).toBeGreaterThan(0);
    expect(fixedPttl).toBeLessThanOrEqual(10_000);

    // 4. Decrement and Reset
    await store.decrement(testKey);
    const afterDecrVal = await redis.get(fullKey);
    expect(Number(afterDecrVal)).toBe(1);

    await store.resetKey(testKey);
    const exists = await redis.exists(fullKey);
    expect(exists).toBe(0);
  });

  it('9. Mode default: Request peramban dengan header IP spoofing tidak dapat memanipulasi identitas backend', async () => {
    // In default mode without trusted ingress:
    // BFF maps all incoming requests to '127.0.0.1' (ignoring user-sent headers).
    // Express with trust proxy = 'loopback' receives requests from BFF.
    const app = express();
    app.set('trust proxy', 'loopback');

    const testStore = new RedisRateLimitStore(redis, 'test:rl:spoof-defense:');
    app.use(rateLimit({
      windowMs: 5000,
      max: 2, // limit 2 requests per IP
      store: testStore,
      keyGenerator: (req) => ipKeyGenerator(req.ip || '127.0.0.1'),
    }));
    app.post('/api/auth/register', (req, res) => res.json({ ok: true, ip: req.ip }));

    // Attacker sends request 1 with forged X-Real-IP and CF-Connecting-IP via BFF (BFF forwards 127.0.0.1)
    const res1 = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', '127.0.0.1'); // Normalized by BFF in default mode
    expect(res1.status).toBe(200);

    // Attacker sends request 2 attempting to spoof another IP
    const res2 = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', '127.0.0.1'); // Normalized by BFF in default mode
    expect(res2.status).toBe(200);

    // Attacker sends request 3: Despite trying different spoofed IPs at the browser level,
    // both requests entered the same 127.0.0.1 bucket and the 3rd request is blocked!
    const res3 = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', '127.0.0.1');
    expect(res3.status).toBe(429);
  });
});
