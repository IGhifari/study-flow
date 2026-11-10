import fs from 'node:fs';
import path from 'node:path';
import { StorageClient } from '@supabase/storage-js';
import { FILE_UPLOAD_LIMITS } from '@studyflow/shared';
import { env } from '../config/env.js';

export interface StorageAdapter {
  download(storageKey: string): Promise<{ data: Blob | Buffer | null; error: Error | null }>;
  remove(paths: string[]): Promise<{ data: any; error: Error | null }>;
  info(storageKey: string): Promise<{ data: any; error: Error | null }>;
}

export class StorageUnavailableAdapter implements StorageAdapter {
  private errorMessage: string;

  constructor(message?: string) {
    this.errorMessage =
      message || 'Layanan penyimpanan file belum dikonfigurasi pada worker.';
  }

  async download(): Promise<{ data: null; error: Error }> {
    return { data: null, error: new Error(`STORAGE_UNAVAILABLE: ${this.errorMessage}`) };
  }

  async remove(): Promise<{ data: null; error: Error }> {
    return { data: null, error: new Error(`STORAGE_UNAVAILABLE: ${this.errorMessage}`) };
  }

  async info(): Promise<{ data: null; error: Error }> {
    return { data: null, error: new Error(`STORAGE_UNAVAILABLE: ${this.errorMessage}`) };
  }
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
 * Shared filesystem storage adapter allowing worker to read files directly from disk
 * in local multi-process development.
 */
export class LocalWorkerStorageAdapter implements StorageAdapter {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || resolveLocalStorageDir();
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

  async download(storageKey: string): Promise<{ data: Buffer | null; error: Error | null }> {
    try {
      const fullPath = this.resolvePath(storageKey);
      if (!fs.existsSync(fullPath)) {
        return { data: null, error: new Error(`File not found in local storage: ${fullPath}`) };
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
        },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}

export class MockWorkerStorageAdapter implements StorageAdapter {
  private files: Map<string, Buffer> = new Map();

  async download(storageKey: string): Promise<{ data: Buffer | null; error: Error | null }> {
    const file = this.files.get(storageKey);
    if (!file) {
      return { data: null, error: new Error('File not found in mock storage') };
    }
    return { data: file, error: null };
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
    return { data: { size: file.length }, error: null };
  }

  putFile(storageKey: string, buffer: Buffer) {
    this.files.set(storageKey, buffer);
  }

  clear() {
    this.files.clear();
  }
}

export class SupabaseWorkerStorageAdapter implements StorageAdapter {
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
        },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}

let workerStorageAdapter: StorageAdapter | null = null;

export function getWorkerStorageAdapter(): StorageAdapter {
  if (workerStorageAdapter) {
    return workerStorageAdapter;
  }

  const driver = env.STORAGE_DRIVER;

  if (driver === 'none') {
    workerStorageAdapter = new StorageUnavailableAdapter();
  } else if (driver === 'supabase') {
    const isConfigured = Boolean(
      env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_STORAGE_BUCKET
    );
    if (!isConfigured) {
      if (env.NODE_ENV === 'production') {
        console.error(
          '[WORKER STORAGE] STORAGE_DRIVER=supabase dikonfigurasi tetapi kredensial Supabase belum lengkap.'
        );
      }
      workerStorageAdapter = new StorageUnavailableAdapter(
        'Kredensial Supabase belum dikonfigurasi pada worker.'
      );
    } else {
      workerStorageAdapter = new SupabaseWorkerStorageAdapter(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY,
        env.SUPABASE_STORAGE_BUCKET
      );
    }
  } else if (driver === 'local') {
    workerStorageAdapter = new LocalWorkerStorageAdapter();
  } else if (driver === 'memory') {
    workerStorageAdapter = new MockWorkerStorageAdapter();
  } else {
    workerStorageAdapter = new StorageUnavailableAdapter();
  }

  return workerStorageAdapter;
}

export function setWorkerStorageAdapterForTesting(adapter: StorageAdapter | null) {
  workerStorageAdapter = adapter;
}
