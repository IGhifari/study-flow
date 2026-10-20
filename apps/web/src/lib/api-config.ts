/**
 * Konfigurasi Base URL API Backend untuk Aplikasi Web (Next.js SSR / BFF / Middleware)
 *
 * Mengatur resolusi URL API backend dengan prioritas:
 * 1. INTERNAL_API_URL (URL internal jaringan, mis. http://api:4000 atau VPC private DNS)
 * 2. NEXT_PUBLIC_API_URL (URL publik API untuk akses browser / single-host deployment)
 * 3. http://localhost:4000 (HANYA pada mode development atau test)
 *
 * Pada mode production (NODE_ENV === 'production'):
 * - Mencegah fallback diam-diam ke localhost:4000 jika variabel tidak disetel.
 * - Memvalidasi format URL (harus merupakan valid URL dengan protokol http: atau https:).
 * - Menghindari pencetakan nilai secret, kredensial, atau token pada pesan error/log.
 */

export class ApiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiConfigurationError';
  }
}

export interface ApiConfigOptions {
  env?: NodeJS.ProcessEnv;
}

/**
 * Mengambil dan memvalidasi base URL API internal backend.
 *
 * @param options Opsi opsional untuk menginjeksi environment (berguna untuk testing terisolasi)
 * @returns Base URL yang dinormalisasi tanpa trailing slash (mis. 'https://api.studyflow.id')
 * @throws {ApiConfigurationError} Jika pada mode production URL tidak disetel atau formatnya tidak valid
 */
export function getInternalApiUrl(options?: ApiConfigOptions): string {
  const env = options?.env ?? process.env;
  const isProduction = env.NODE_ENV === 'production';

  const rawCandidate = env.INTERNAL_API_URL?.trim() || env.NEXT_PUBLIC_API_URL?.trim();

  if (!rawCandidate) {
    if (!isProduction) {
      return 'http://localhost:4000';
    }
    throw new ApiConfigurationError(
      'Konfigurasi URL API backend tidak ditemukan. Harap tentukan variabel environment INTERNAL_API_URL atau NEXT_PUBLIC_API_URL pada mode produksi.'
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawCandidate);
  } catch {
    throw new ApiConfigurationError(
      'Format URL API backend tidak valid. Nilai harus merupakan URL valid dengan protokol http atau https.'
    );
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new ApiConfigurationError(
      'Protokol URL API backend tidak valid. Hanya protokol http atau https yang didukung.'
    );
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new ApiConfigurationError(
      'URL API backend tidak boleh mengandung kredensial autentikasi (username atau password).'
    );
  }

  // Normalisasi: buang trailing slash agar penggabungan path URL tidak menghasilkan double-slash
  return rawCandidate.replace(/\/+$/, '');
}
