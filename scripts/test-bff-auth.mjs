// Test script for Next.js BFF Auth Flow
import { prisma } from '@studyflow/database';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function runBffTests() {
  console.log('--- Starting Next.js BFF Integration Verification ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  const testEmail = `bff.user.${Date.now()}@studyflow.test`;
  const initialPassword = 'InitialSecurePassword123!';

  try {
    // 1. Test unauthenticated access to /dashboard (Middleware protection)
    try {
      const res = await fetch(`${BASE_URL}/dashboard`, { redirect: 'manual' });
      assert(
        res.status === 307 || res.status === 308 || (res.status >= 300 && res.status < 400),
        `Unauthenticated /dashboard redirects to login (status: ${res.status})`
      );
      assert(
        res.headers.get('location')?.includes('/login'),
        'Redirect target contains /login'
      );
    } catch (err) {
      assert(false, `Middleware redirect test error: ${err instanceof Error ? err.message : err}`);
    }

    // 2. Reject foreign origin on state-changing request (CSRF Protection)
    try {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://attacker-origin.example.com',
        },
        body: JSON.stringify({
          name: 'Attacker User',
          email: 'attacker@example.com',
          password: 'AttackerPassword123!',
        }),
      });
      assert(res.status === 403, `Foreign origin on BFF is rejected with 403 (got ${res.status})`);
      const body = await res.json();
      assert(body.error?.code === 'CSRF_ORIGIN_INVALID', 'Error code is CSRF_ORIGIN_INVALID');
    } catch (err) {
      assert(false, `CSRF origin test error: ${err instanceof Error ? err.message : err}`);
    }

    // 3. Reject null origin on state-changing request
    try {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'null',
        },
        body: JSON.stringify({
          name: 'Null Origin User',
          email: 'nullorigin@example.com',
          password: 'NullOriginPassword123!',
        }),
      });
      assert(res.status === 403, `Null origin on BFF is rejected with 403 (got ${res.status})`);
    } catch (err) {
      assert(false, `Null origin test error: ${err instanceof Error ? err.message : err}`);
    }

    // 4. Register via BFF
    try {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: BASE_URL,
        },
        body: JSON.stringify({
          name: 'Budi Mahasiswa',
          email: testEmail,
          password: initialPassword,
          timezone: 'Asia/Jakarta',
        }),
      });
      const body = await res.json();
      assert(res.status === 201, `Register via BFF returns 201 (got ${res.status})`);
      assert(body.user?.email === testEmail, 'User email matches registered email');
      assert(body.user?.passwordHash === undefined, 'No password hash leaked in response');
    } catch (err) {
      assert(false, `Register test error: ${err instanceof Error ? err.message : err}`);
    }

    // 5. Login via BFF
    let cookies = [];
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: BASE_URL,
        },
        body: JSON.stringify({
          email: testEmail,
          password: initialPassword,
        }),
      });
      const body = await res.json();
      assert(res.status === 200, `Login via BFF returns 200 (got ${res.status})`);
      assert(body.user?.name === 'Budi Mahasiswa', 'User name is correct');

      // Verify cookies are set securely without logging cookie values
      const setCookieHeaders = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
      cookies = setCookieHeaders.map(c => c.split(';')[0]);
      assert(
        cookies.some(c => c.startsWith('studyflow_access_token=')),
        'Set-Cookie includes studyflow_access_token'
      );
      assert(
        cookies.some(c => c.startsWith('studyflow_refresh_token=')),
        'Set-Cookie includes studyflow_refresh_token'
      );
    } catch (err) {
      assert(false, `Login test error: ${err instanceof Error ? err.message : err}`);
    }

    const cookieHeader = cookies.join('; ');

    // 6. GET /api/auth/me via BFF with cookies
    try {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: {
          Cookie: cookieHeader,
        },
      });
      const body = await res.json();
      assert(res.status === 200, `GET /api/auth/me with cookies returns 200 (got ${res.status})`);
      assert(body.user?.email === testEmail, 'Current user email matches');
    } catch (err) {
      assert(false, `GET /me test error: ${err instanceof Error ? err.message : err}`);
    }

    // 7. Authenticated access to /dashboard (Next.js server-rendered)
    try {
      const res = await fetch(`${BASE_URL}/dashboard`, {
        headers: {
          Cookie: cookieHeader,
        },
      });
      assert(res.status === 200, `Authenticated /dashboard returns 200 OK (got ${res.status})`);
      const html = await res.text();
      assert(html.includes('Budi Mahasiswa'), 'Dashboard HTML renders user name');
    } catch (err) {
      assert(false, `Dashboard page render test error: ${err instanceof Error ? err.message : err}`);
    }

    // 8. Test direct reload with expired access token (only refresh token sent)
    try {
      const refreshCookie = cookies.find(c => c.startsWith('studyflow_refresh_token='));
      if (refreshCookie) {
        const reloadRes = await fetch(`${BASE_URL}/dashboard`, {
          headers: {
            Cookie: refreshCookie,
          },
        });
        assert(reloadRes.status === 200, `Direct reload /dashboard with expired access token recovers via refresh (got ${reloadRes.status})`);
        const newSetCookies = reloadRes.headers.getSetCookie ? reloadRes.headers.getSetCookie() : [];
        assert(
          newSetCookies.some(c => c.startsWith('studyflow_access_token=')),
          'Reload response issues renewed access token cookie'
        );
      }
    } catch (err) {
      assert(false, `Reload recovery test error: ${err instanceof Error ? err.message : err}`);
    }

    // 9. PATCH /api/auth/me (Update profile)
    try {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Origin: BASE_URL,
          Cookie: cookieHeader,
        },
        body: JSON.stringify({
          name: 'Budi Santoso',
          timezone: 'Asia/Makassar',
        }),
      });
      const body = await res.json();
      assert(res.status === 200, `PATCH /api/auth/me returns 200 (got ${res.status})`);
      assert(body.user?.name === 'Budi Santoso', 'User name updated to Budi Santoso');
      assert(body.user?.timezone === 'Asia/Makassar', 'User timezone updated to Asia/Makassar');
    } catch (err) {
      assert(false, `Update profile test error: ${err instanceof Error ? err.message : err}`);
    }

    // 10. POST /api/auth/change-password
    const newPassword = 'BrandNewPassword456!';
    try {
      const res = await fetch(`${BASE_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: BASE_URL,
          Cookie: cookieHeader,
        },
        body: JSON.stringify({
          currentPassword: initialPassword,
          newPassword,
        }),
      });
      assert(res.status === 200, `Change password via BFF returns 200 (got ${res.status})`);
    } catch (err) {
      assert(false, `Change password test error: ${err instanceof Error ? err.message : err}`);
    }

    // 11. Verify old session is rejected immediately
    try {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: {
          Cookie: cookieHeader,
        },
      });
      assert(res.status === 401, `Old session rejected after password change with 401 (got ${res.status})`);
    } catch (err) {
      assert(false, `Old session rejection test error: ${err instanceof Error ? err.message : err}`);
    }

    // 12. Login with new password
    let newCookies = [];
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: BASE_URL,
        },
        body: JSON.stringify({
          email: testEmail,
          password: newPassword,
        }),
      });
      assert(res.status === 200, `Login with new password succeeds with 200 (got ${res.status})`);
      const setCookieHeaders = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
      newCookies = setCookieHeaders.map(c => c.split(';')[0]);
    } catch (err) {
      assert(false, `Login with new password error: ${err instanceof Error ? err.message : err}`);
    }

    const newCookieHeader = newCookies.join('; ');

    // 13. POST /api/auth/logout
    try {
      const res = await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Origin: BASE_URL,
          Cookie: newCookieHeader,
        },
      });
      assert(res.status === 200, `Logout via BFF returns 200 (got ${res.status})`);
      const setCookieHeaders = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
      assert(
        setCookieHeaders.some(c => c.toLowerCase().includes('max-age=0') || c.toLowerCase().includes('expires=thu, 01 jan 1970')),
        'Logout Set-Cookie clears tokens with Max-Age=0 or 1970 Expire'
      );
    } catch (err) {
      assert(false, `Logout test error: ${err instanceof Error ? err.message : err}`);
    }

  } finally {
    // Isolated Cleanup: Delete test user created during test execution
    try {
      await prisma.user.deleteMany({
        where: { email: testEmail },
      });
      await prisma.$disconnect();
    } catch {
      // Ignore database cleanup errors
    }
  }

  console.log(`\n--- Verification Summary: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

runBffTests().catch(err => {
  console.error('BFF Test Suite Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
