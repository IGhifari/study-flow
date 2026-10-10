import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateE2EConfig,
  getDatabaseName,
  isTestDatabaseUrl,
  parseRedisUrl,
} from '../apps/web/e2e/support/test-env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const playwrightConfigPath = path.resolve(repoRoot, 'apps/web/playwright.config.ts');

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

console.log('=== Verifikasi Terarah: Penutupan Celah Isolasi E2E ===\n');

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Bagian 1: Pengujian Unit Aturan Validasi Test Environment
// ---------------------------------------------------------------------------
console.log('1. Pengujian Unit Aturan Validasi:');

// Uji 1.1: Hanya DATABASE_URL dan REDIS_URL development tersedia -> Harus Menolak
try {
  validateE2EConfig({
    DATABASE_URL: 'postgresql://studyflow_user:dev_secret_password_123@localhost:5433/studyflow_dev?schema=public',
    REDIS_URL: 'redis://localhost:6379',
  });
  assert(false, 'Harus melempar error ketika hanya konfigurasi development tersedia');
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  assert(
    msg.includes('DATABASE_URL_TEST tidak diset'),
    'Menolak ketika DATABASE_URL_TEST tidak diset (tidak ada fallback ke DATABASE_URL)'
  );
  assert(
    !msg.includes('dev_secret_password_123'),
    'Pesan penolakan tidak membocorkan kredensial database dev'
  );
}

// Uji 1.2: DATABASE_URL_TEST tidak berakhiran "_test" -> Harus Menolak
try {
  validateE2EConfig({
    DATABASE_URL_TEST: 'postgresql://secret_user:unsafe_secret_pass_456@localhost:5433/studyflow_dev?schema=public',
    REDIS_URL_TEST: 'redis://localhost:6379/15',
  });
  assert(false, 'Harus melempar error jika DATABASE_URL_TEST menunjuk studyflow_dev');
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  assert(
    msg.includes('Target database test tidak aman'),
    'Menolak target database yang tidak berakhiran "_test"'
  );
  assert(
    !msg.includes('unsafe_secret_pass_456') && !msg.includes('secret_user'),
    'Pesan penolakan database tidak aman tidak mencetak kredensial ke log'
  );
}

// Uji 1.3: DATABASE_URL_TEST valid tetapi REDIS_URL_TEST tidak diset -> Harus Menolak
try {
  validateE2EConfig({
    DATABASE_URL_TEST: 'postgresql://studyflow_user:test_secret@localhost:5433/studyflow_test?schema=public',
    REDIS_URL: 'redis://localhost:6379',
  });
  assert(false, 'Harus melempar error jika REDIS_URL_TEST tidak diset');
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  assert(
    msg.includes('REDIS_URL_TEST tidak diset'),
    'Menolak ketika REDIS_URL_TEST tidak diset (tidak ada fallback ke REDIS_URL)'
  );
}

// Uji 1.4: REDIS_URL_TEST sama persis dengan REDIS_URL development -> Harus Menolak
try {
  validateE2EConfig({
    DATABASE_URL_TEST: 'postgresql://studyflow_user:test_secret@localhost:5433/studyflow_test?schema=public',
    DATABASE_URL: 'postgresql://studyflow_user:dev_secret@localhost:5433/studyflow_dev?schema=public',
    REDIS_URL: 'redis://:super_redis_auth@localhost:6379',
    REDIS_URL_TEST: 'redis://:super_redis_auth@localhost:6379',
  });
  assert(false, 'Harus melempar error jika REDIS_URL_TEST sama persis dengan dev Redis');
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  assert(
    msg.includes('sama persis dengan REDIS_URL development'),
    'Menolak ketika REDIS_URL_TEST menunjuk instance dan DB yang sama dengan dev Redis'
  );
  assert(
    !msg.includes('super_redis_auth'),
    'Pesan penolakan Redis tidak membocorkan auth kredensial'
  );
}

// Uji 1.5: REDIS_URL_TEST menggunakan database default 0 pada localhost -> Harus Menolak
try {
  validateE2EConfig({
    DATABASE_URL_TEST: 'postgresql://studyflow_user:test_secret@localhost:5433/studyflow_test?schema=public',
    REDIS_URL_TEST: 'redis://localhost:6379/0',
  });
  assert(false, 'Harus melempar error jika REDIS_URL_TEST menggunakan database default 0');
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  assert(
    msg.includes('tidak boleh menggunakan database default (0)'),
    'Menolak target REDIS_URL_TEST yang menggunakan database default 0'
  );
}

// Uji 1.6: Konfigurasi test valid -> Diterima
try {
  const config = validateE2EConfig({
    DATABASE_URL: 'postgresql://studyflow_user:dev_pass@localhost:5433/studyflow_dev?schema=public',
    DATABASE_URL_TEST: 'postgresql://studyflow_user:test_pass@localhost:5433/studyflow_test?schema=public',
    REDIS_URL: 'redis://localhost:6379',
    REDIS_URL_TEST: 'redis://localhost:6379/15',
  });
  assert(
    config.databaseUrl.includes('studyflow_test'),
    'Konfigurasi test valid diterima dengan databaseUrl yang benar'
  );
  assert(
    config.redisUrl === 'redis://localhost:6379/15',
    'Konfigurasi test valid diterima dengan redisUrl terisolasi (DB 15)'
  );
} catch (err: unknown) {
  assert(false, `Gagal memvalidasi konfigurasi test yang valid: ${err}`);
}

// ---------------------------------------------------------------------------
// Bagian 2: Pengujian Integrasi Subproses Playwright CLI
// ---------------------------------------------------------------------------
console.log('\n2. Pengujian Integrasi Evaluasi Playwright Config:');

// Uji 2.1: Subproses Playwright dengan HANYA DATABASE_URL & REDIS_URL development
// Membuktikan setup E2E menolak sebelum migrasi, seed, atau server dimulai
const rejectRun = spawnSync(npxCmd, ['playwright', 'test', '--config=apps/web/playwright.config.ts', '--list'], {
  cwd: repoRoot,
  shell: isWindows,
  env: {
    ...process.env,
    DATABASE_URL_TEST: '',
    REDIS_URL_TEST: '',
    DATABASE_URL: 'postgresql://studyflow_user:forbidden_dev_pw@localhost:5433/studyflow_dev?schema=public',
    REDIS_URL: 'redis://localhost:6379',
  },
  encoding: 'utf-8',
});

const rejectOutput = (rejectRun.stdout || '') + (rejectRun.stderr || '');
assert(
  rejectRun.status !== 0,
  `Playwright menolak konfigurasi dev murni dengan exit code non-zero (exit code: ${rejectRun.status})`
);
assert(
  rejectOutput.includes('[E2E ISOLATION GUARD] DATABASE_URL_TEST tidak diset'),
  'Playwright mencetak pesan penolakan [E2E ISOLATION GUARD] DATABASE_URL_TEST tidak diset'
);
assert(
  !rejectOutput.includes('forbidden_dev_pw'),
  'Output Playwright tidak membocorkan password database development'
);

// Uji 2.2: Subproses Playwright dengan Konfigurasi Test Valid
// Membuktikan setup E2E diterima ketika konfigurasi test aman dan valid
const acceptRun = spawnSync(npxCmd, ['playwright', 'test', '--config=apps/web/playwright.config.ts', '--list'], {
  cwd: repoRoot,
  shell: isWindows,
  env: {
    ...process.env,
    DATABASE_URL_TEST: 'postgresql://studyflow_user:studyflow_dev_password@localhost:5433/studyflow_test?schema=public',
    REDIS_URL_TEST: 'redis://localhost:6379/15',
    DATABASE_URL: 'postgresql://studyflow_user:studyflow_dev_password@localhost:5433/studyflow_dev?schema=public',
    REDIS_URL: 'redis://localhost:6379',
  },
  encoding: 'utf-8',
});

const acceptOutput = (acceptRun.stdout || '') + (acceptRun.stderr || '');
assert(
  acceptRun.status === 0,
  `Playwright menerima konfigurasi test valid dengan exit code 0 (exit code: ${acceptRun.status})`
);
assert(
  acceptOutput.includes('StudyFlow End-to-End Suite') || acceptOutput.includes('Note Editor Unsaved Changes'),
  'Playwright berhasil memuat spesifikasi E2E tanpa error isolasi'
);

console.log(`\nHasil Pengujian Konfigurasi Isolasi E2E: ${passed} PASS, ${failed} FAIL\n`);
if (failed > 0) {
  process.exit(1);
}
