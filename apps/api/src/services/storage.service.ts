import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { StorageClient } from '@supabase/storage-js';
import { FILE_UPLOAD_LIMITS } from '@studyflow/shared';
import { env } from '../config/env.js';

export interface StorageAdapter {
  createSignedUploadUrl(
    path: string
  ): Promise<{ data: { url: string; signedUrl: string; token: string } | null; error: Error | null }>;
  createSignedUrl(
    path: string,
    expiresIn: number
  ): Promise<{ data: { signedUrl: string } | null; error: Error | null }>;
  download(path: string): Promise<{ data: Blob | Buffer | null; error: Error | null }>;
  remove(paths: string[]): Promise<{ data: any; error: Error | null }>;
  info(path: string): Promise<{ data: any; error: Error | null }>;
  upload(
    path: string,
    fileBody: Buffer | Uint8Array,
    options?: { contentType?: string; upsert?: boolean }
  ): Promise<{ data: any; error: Error | null }>;
}

export class StorageUnavailableError extends Error {
  code = 'STORAGE_UNAVAILABLE';
  statusCode = 503;

  constructor(message = 'Layanan penyimpanan file belum dikonfigurasi atau sedang tidak tersedia') {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

/**
 * Adapter when storage is disabled or credentials are not configured.
 * Guarantees graceful degradation without crashing the server or leaking unhandled errors.
 */
export class StorageUnavailableAdapter implements StorageAdapter {
  private errorMessage: string;

  constructor(message?: string) {
    this.errorMessage =
      message || 'Layanan penyimpanan cloud belum dikonfigurasi. Silakan hubungi administrator.';
  }

  async createSignedUploadUrl(): Promise<{ data: null; error: Error }> {
    return { data: null, error: new StorageUnavailableError(this.errorMessage) };
  }

  async createSignedUrl(): Promise<{ data: null; error: Error }> {
    return { data: null, error: new StorageUnavailableError(this.errorMessage) };
  }

  async download(): Promise<{ data: null; error: Error }> {
    return { data: null, error: new StorageUnavailableError(this.errorMessage) };
  }

  async remove(): Promise<{ data: null; error: Error }> {
    return { data: null, error: new StorageUnavailableError(this.errorMessage) };
  }

  async info(): Promise<{ data: null; error: Error }> {
    return { data: null, error: new StorageUnavailableError(this.errorMessage) };
  }

  async upload(): Promise<{ data: null; error: Error }> {
    return { data: null, error: new StorageUnavailableError(this.errorMessage) };
  }
}

/**
 * Token signing & verification for LocalStorageAdapter.
 */
function getStorageSecret(): string {
  return env.COOKIE_SECRET || env.JWT_ACCESS_SECRET || 'studyflow_local_storage_secret_key_123456';
}

export type LocalStorageTokenPurpose = 'upload' | 'download';

export function generateLocalStorageToken(
  filePath: string,
  expiresInSeconds = 7200,
  purpose?: LocalStorageTokenPurpose
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  if (purpose) {
    const payload = `${purpose}:${filePath}:${expiresAt}`;
    const hmac = crypto
      .createHmac('sha256', getStorageSecret())
      .update(payload)
      .digest('hex');
    return `${expiresAt}.${purpose}.${hmac}`;
  }
  const payload = `${filePath}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', getStorageSecret()).update(payload).digest('hex');
  return `${expiresAt}.${hmac}`;
}

export function verifyLocalStorageToken(
  filePath: string,
  token: string,
  requiredPurpose?: LocalStorageTokenPurpose
): boolean {
  if (!token || !token.includes('.')) return false;
  const parts = token.split('.');
  if (parts.length !== 2 && parts.length !== 3) return false;
  const expiresAtStr = parts[0]!;
  const tokenPurpose = parts.length === 3 ? parts[1]! : undefined;
  const hmac = parts.length === 3 ? parts[2]! : parts[1]!;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return false;
  }
  if (tokenPurpose !== undefined) {
    if (tokenPurpose !== 'upload' && tokenPurpose !== 'download') return false;
    if (requiredPurpose && tokenPurpose !== requiredPurpose) return false;
  }
  const expectedPayload = tokenPurpose
    ? `${tokenPurpose}:${filePath}:${expiresAt}`
    : `${filePath}:${expiresAt}`;
  const expectedHmac = crypto
    .createHmac('sha256', getStorageSecret())
    .update(expectedPayload)
    .digest('hex');
  if (Buffer.byteLength(hmac) !== Buffer.byteLength(expectedHmac)) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac));
}

function resolveLocalStorageDir(): string {
  if (env.LOCAL_STORAGE_DIR) {
    return path.resolve(env.LOCAL_STORAGE_DIR);
  }
  let curr = process.cwd();
  for (let i = 0; i < 4; i++) {
    const pkgPath = path.join(curr, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.workspaces) {
          return path.resolve(curr, '.storage/materials');
        }
      } catch {}
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return path.resolve(process.cwd(), '.storage/materials');
}

/**
 * Shared filesystem storage adapter for local multi-process development (API + Worker).
 */
export class LocalStorageAdapter implements StorageAdapter {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || resolveLocalStorageDir();
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private resolvePath(storageKey: string): string {
    if (!storageKey || typeof storageKey !== 'string' || storageKey.includes('\0') || !storageKey.trim()) {
      throw new Error('Invalid storage key: path traversal detected');
    }
    const normalizedKey = storageKey.replace(/\\/g, '/');
    const sanitizedKey = normalizedKey.replace(/^\/+/, '');
    if (!sanitizedKey || !sanitizedKey.trim()) {
      throw new Error('Invalid storage key: path traversal detected');
    }
    const base = path.resolve(this.baseDir);
    const resolved = path.resolve(base, sanitizedKey);
    if (!resolved.startsWith(base + path.sep)) {
      throw new Error('Invalid storage key: path traversal detected');
    }
    return resolved;
  }

  async createSignedUploadUrl(
    storageKey: string
  ): Promise<{ data: { url: string; signedUrl: string; token: string } | null; error: Error | null }> {
    try {
      this.resolvePath(storageKey);
      const token = generateLocalStorageToken(storageKey, 7200, 'upload'); // 2 hours
      const encodedKey = encodeURIComponent(storageKey);
      const url = `${env.API_BASE_URL}/api/storage/local/upload/${encodedKey}?token=${token}`;
      return {
        data: {
          url,
          signedUrl: url,
          token,
        },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async createSignedUrl(
    storageKey: string,
    expiresIn = 300
  ): Promise<{ data: { signedUrl: string } | null; error: Error | null }> {
    try {
      this.resolvePath(storageKey);
      const token = generateLocalStorageToken(storageKey, expiresIn, 'download');
      const encodedKey = encodeURIComponent(storageKey);
      const signedUrl = `${env.API_BASE_URL}/api/storage/local/download/${encodedKey}?token=${token}`;
      return {
        data: { signedUrl },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async download(storageKey: string): Promise<{ data: Buffer | null; error: Error | null }> {
    try {
      const fullPath = this.resolvePath(storageKey);
      if (!fs.existsSync(fullPath)) {
        return { data: null, error: new Error('File not found in local storage') };
      }

      // 1. Audit file size via stat before reading entire file into RAM
      const stat = await fs.promises.stat(fullPath);
      if (stat.size > FILE_UPLOAD_LIMITS.maxSizeBytes) {
        return {
          data: null,
          error: new Error(
            `Ukuran file (${stat.size} bytes) melebihi batas maksimal 20 MiB (${FILE_UPLOAD_LIMITS.maxSizeBytes} bytes)`
          ),
        };
      }

      // 2. Read file contents
      const data = await fs.promises.readFile(fullPath);

      // 3. Mitigate race conditions if file size changed between stat and readFile
      if (data.length > FILE_UPLOAD_LIMITS.maxSizeBytes) {
        return {
          data: null,
          error: new Error(
            `Ukuran file (${data.length} bytes) melebihi batas maksimal 20 MiB (${FILE_UPLOAD_LIMITS.maxSizeBytes} bytes)`
          ),
        };
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async remove(paths: string[]): Promise<{ data: any; error: Error | null }> {
    let count = 0;
    try {
      for (const p of paths) {
        const fullPath = this.resolvePath(p);
        if (fs.existsSync(fullPath)) {
          await fs.promises.unlink(fullPath);
          count++;
        }
      }
      return { data: { count }, error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async info(storageKey: string): Promise<{ data: any; error: Error | null }> {
    try {
      const fullPath = this.resolvePath(storageKey);
      if (!fs.existsSync(fullPath)) {
        return { data: null, error: new Error('File not found') };
      }
      const stat = await fs.promises.stat(fullPath);
      return {
        data: {
          size: stat.size,
          mimetype: 'application/pdf',
        },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async upload(
    storageKey: string,
    fileBody: Buffer | Uint8Array,
    _options?: { contentType?: string; upsert?: boolean }
  ): Promise<{ data: any; error: Error | null }> {
    try {
      const fullPath = this.resolvePath(storageKey);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      const buffer = Buffer.isBuffer(fileBody) ? fileBody : Buffer.from(fileBody);
      if (buffer.length > FILE_UPLOAD_LIMITS.maxSizeBytes) {
        return {
          data: null,
          error: new Error(
            `Ukuran file (${buffer.length} bytes) melebihi batas maksimal 20 MiB (${FILE_UPLOAD_LIMITS.maxSizeBytes} bytes)`
          ),
        };
      }
      await fs.promises.writeFile(fullPath, buffer);
      return { data: { key: storageKey }, error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}

/**
 * In-memory Mock Storage Adapter for hermetic unit tests.
 */
export class MockStorageAdapter implements StorageAdapter {
  private files: Map<string, { buffer: Buffer; contentType: string }> = new Map();

  async createSignedUploadUrl(
    storageKey: string
  ): Promise<{ data: { url: string; signedUrl: string; token: string } | null; error: Error | null }> {
    const token = `mock-upload-token-${Date.now()}`;
    const signedUrl = `http://localhost:4000/api/mock-storage/upload/${encodeURIComponent(storageKey)}?token=${token}`;
    return {
      data: {
        url: signedUrl,
        signedUrl,
        token,
      },
      error: null,
    };
  }

  async createSignedUrl(
    storageKey: string,
    _expiresIn: number
  ): Promise<{ data: { signedUrl: string } | null; error: Error | null }> {
    const signedUrl = `http://localhost:4000/api/mock-storage/download/${encodeURIComponent(storageKey)}?token=mock-read-token`;
    return {
      data: { signedUrl },
      error: null,
    };
  }

  async download(storageKey: string): Promise<{ data: Buffer | null; error: Error | null }> {
    const file = this.files.get(storageKey);
    if (!file) {
      return { data: null, error: new Error('File not found in mock storage') };
    }
    return { data: file.buffer, error: null };
  }

  async remove(paths: string[]): Promise<{ data: any; error: Error | null }> {
    for (const p of paths) {
      this.files.delete(p);
    }
    return { data: { count: paths.length }, error: null };
  }

  async info(storageKey: string): Promise<{ data: any; error: Error | null }> {
    const file = this.files.get(storageKey);
    if (!file) {
      return { data: null, error: new Error('File not found') };
    }
    return {
      data: {
        size: file.buffer.length,
        mimetype: file.contentType,
      },
      error: null,
    };
  }

  async upload(
    storageKey: string,
    fileBody: Buffer | Uint8Array,
    options?: { contentType?: string; upsert?: boolean }
  ): Promise<{ data: any; error: Error | null }> {
    const buffer = Buffer.isBuffer(fileBody) ? fileBody : Buffer.from(fileBody);
    this.files.set(storageKey, {
      buffer,
      contentType: options?.contentType || 'application/pdf',
    });
    return { data: { key: storageKey }, error: null };
  }

  putMockFile(storageKey: string, buffer: Buffer, contentType = 'application/pdf') {
    this.files.set(storageKey, { buffer, contentType });
  }

  hasMockFile(storageKey: string): boolean {
    return this.files.has(storageKey);
  }

  clear() {
    this.files.clear();
  }
}

/**
 * Supabase Storage Adapter interacting with the Supabase Storage API using @supabase/storage-js.
 */
export class SupabaseStorageAdapter implements StorageAdapter {
  private client: StorageClient;
  private bucket: string;

  constructor(supabaseUrl: string, serviceKey: string, bucket: string) {
    const cleanUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
    this.client = new StorageClient(`${cleanUrl}/storage/v1`, {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    });
    this.bucket = bucket;
  }

  async createSignedUploadUrl(
    storageKey: string
  ): Promise<{ data: { url: string; signedUrl: string; token: string } | null; error: Error | null }> {
    try {
      const res = await this.client.from(this.bucket).createSignedUploadUrl(storageKey);
      if (res.error) {
        return { data: null, error: new Error(res.error.message) };
      }
      return {
        data: {
          url: res.data.signedUrl,
          signedUrl: res.data.signedUrl,
          token: res.data.token,
        },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async createSignedUrl(
    storageKey: string,
    expiresIn: number
  ): Promise<{ data: { signedUrl: string } | null; error: Error | null }> {
    try {
      const res = await this.client.from(this.bucket).createSignedUrl(storageKey, expiresIn);
      if (res.error) {
        return { data: null, error: new Error(res.error.message) };
      }
      return {
        data: { signedUrl: res.data.signedUrl },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async download(storageKey: string): Promise<{ data: Blob | Buffer | null; error: Error | null }> {
    try {
      const res = await this.client.from(this.bucket).download(storageKey);
      if (res.error) {
        return { data: null, error: new Error(res.error.message) };
      }
      return { data: res.data, error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async remove(paths: string[]): Promise<{ data: any; error: Error | null }> {
    try {
      const res = await this.client.from(this.bucket).remove(paths);
      if (res.error) {
        return { data: null, error: new Error(res.error.message) };
      }
      return { data: res.data, error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async info(storageKey: string): Promise<{ data: any; error: Error | null }> {
    try {
      const dirname = storageKey.includes('/') ? storageKey.substring(0, storageKey.lastIndexOf('/')) : '';
      const filename = storageKey.includes('/') ? storageKey.substring(storageKey.lastIndexOf('/') + 1) : storageKey;
      const res = await this.client.from(this.bucket).list(dirname, {
        search: filename,
        limit: 1,
      });
      if (res.error) {
        return { data: null, error: new Error(res.error.message) };
      }
      const match = res.data?.find((f) => f.name === filename);
      if (!match) {
        return { data: null, error: new Error('Object not found in storage') };
      }
      return {
        data: {
          size: match.metadata?.size,
          mimetype: match.metadata?.mimetype,
        },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async upload(
    storageKey: string,
    fileBody: Buffer | Uint8Array,
    options?: { contentType?: string; upsert?: boolean }
  ): Promise<{ data: any; error: Error | null }> {
    try {
      const res = await this.client.from(this.bucket).upload(storageKey, fileBody, {
        contentType: options?.contentType || 'application/pdf',
        upsert: options?.upsert ?? true,
      });
      if (res.error) {
        return { data: null, error: new Error(res.error.message) };
      }
      return { data: res.data, error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}

// Global storage adapter instance
let globalStorageAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (globalStorageAdapter) {
    return globalStorageAdapter;
  }

  const driver = env.STORAGE_DRIVER;

  if (driver === 'none') {
    globalStorageAdapter = new StorageUnavailableAdapter();
  } else if (driver === 'supabase') {
    const isConfigured = Boolean(
      env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_STORAGE_BUCKET
    );
    if (!isConfigured) {
      if (env.NODE_ENV === 'production') {
        console.error(
          '[STORAGE] STORAGE_DRIVER=supabase dikonfigurasi tetapi SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY kosong.'
        );
      }
      globalStorageAdapter = new StorageUnavailableAdapter(
        'Layanan Supabase Storage belum dikonfigurasi (SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diatur).'
      );
    } else {
      globalStorageAdapter = new SupabaseStorageAdapter(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY,
        env.SUPABASE_STORAGE_BUCKET
      );
    }
  } else if (driver === 'local') {
    globalStorageAdapter = new LocalStorageAdapter();
  } else if (driver === 'memory') {
    if (env.NODE_ENV === 'production') {
      console.warn(
        '[STORAGE] Peringatan: Driver storage memory (mock) aktif di production. Data tidak akan bertahan antar restart.'
      );
    }
    globalStorageAdapter = new MockStorageAdapter();
  } else {
    globalStorageAdapter = new StorageUnavailableAdapter();
  }

  return globalStorageAdapter;
}

export function setStorageAdapterForTesting(adapter: StorageAdapter | null) {
  globalStorageAdapter = adapter;
}
