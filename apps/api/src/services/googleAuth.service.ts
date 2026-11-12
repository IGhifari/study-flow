import crypto from 'node:crypto';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { prisma, Prisma } from '@studyflow/database';
import { GoogleExchangeInput, UserProfile } from '@studyflow/shared';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  createAccessToken,
  generateRandomToken,
  hashToken,
  getRefreshTokenExpiryDate,
} from './token.service.js';
import { toUserProfile } from './auth.service.js';

export function isGoogleConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export interface GoogleAuthUrlResult {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export function generateGoogleAuthUrl(options?: {
  prompt?: 'select_account' | 'consent';
  redirectUri?: string;
}): GoogleAuthUrlResult {
  if (!isGoogleConfigured() && env.NODE_ENV !== 'test') {
    const error: AppError = new Error('Google OAuth belum dikonfigurasi pada server');
    error.statusCode = 503;
    error.code = 'GOOGLE_AUTH_NOT_CONFIGURED';
    throw error;
  }

  const state = crypto.randomBytes(32).toString('hex');
  const nonce = crypto.randomBytes(32).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');

  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  const redirectUri = options?.redirectUri || env.GOOGLE_REDIRECT_URI;

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID || 'mock-google-client-id');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', options?.prompt || 'select_account');

  return {
    url: url.toString(),
    state,
    nonce,
    codeVerifier,
  };
}

// Deterministic mock holder for testing (never active in production)
let testMockPayload:
  | ((code: string, codeVerifier: string) => Promise<TokenPayload | null> | TokenPayload | null)
  | null = null;

export function __setTestGoogleAuthMock(
  mock: ((code: string, codeVerifier: string) => Promise<TokenPayload | null> | TokenPayload | null) | null
): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Test mock can only be configured in test environment');
  }
  testMockPayload = mock;
}

export interface GoogleAuthExchangeResult {
  user: UserProfile;
  accessToken?: string;
  refreshToken?: string;
  message: string;
}

export async function exchangeGoogleCode(
  input: GoogleExchangeInput,
  currentUserId?: string
): Promise<GoogleAuthExchangeResult> {
  let verifiedPayload: TokenPayload;

  if (process.env.NODE_ENV === 'test' && testMockPayload) {
    const mock = await testMockPayload(input.code, input.codeVerifier);
    if (!mock) {
      const error: AppError = new Error('Kode otorisasi Google tidak valid atau ditolak oleh provider');
      error.statusCode = 400;
      error.code = 'OAUTH_PROVIDER_ERROR';
      throw error;
    }
    verifiedPayload = mock;
  } else {
    if (!isGoogleConfigured()) {
      const error: AppError = new Error('Google OAuth belum dikonfigurasi pada server');
      error.statusCode = 503;
      error.code = 'GOOGLE_AUTH_NOT_CONFIGURED';
      throw error;
    }

    // Exchange authorization code for tokens via Google Token Endpoint
    let tokenRes: Response;
    try {
      tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code: input.code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: input.redirectUri,
          grant_type: 'authorization_code',
          code_verifier: input.codeVerifier,
        }),
      });
    } catch {
      const error: AppError = new Error('Gagal menghubungi layanan Google OAuth');
      error.statusCode = 502;
      error.code = 'OAUTH_NETWORK_ERROR';
      throw error;
    }

    if (!tokenRes.ok) {
      const error: AppError = new Error('Kode otorisasi Google tidak valid atau kedaluwarsa');
      error.statusCode = 400;
      error.code = 'OAUTH_CODE_EXCHANGE_FAILED';
      throw error;
    }

    const tokenData = (await tokenRes.json()) as { id_token?: string; access_token?: string };
    if (!tokenData.id_token) {
      const error: AppError = new Error('ID Token Google tidak ditemukan dalam respon pertukaran');
      error.statusCode = 400;
      error.code = 'ID_TOKEN_MISSING';
      throw error;
    }

    // Verify ID Token signature, issuer, audience, and expiry with Google Auth Library
    try {
      const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
      const ticket = await client.verifyIdToken({
        idToken: tokenData.id_token,
        audience: env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error('Payload token kosong');
      }
      verifiedPayload = payload;
    } catch {
      const error: AppError = new Error('ID Token Google tidak valid atau tanda tangan digital gagal diverifikasi');
      error.statusCode = 401;
      error.code = 'INVALID_ID_TOKEN';
      throw error;
    }
  }

  // 1. Validate Nonce (ID Token Replay Protection)
  if (!verifiedPayload.nonce || verifiedPayload.nonce !== input.nonce) {
    const error: AppError = new Error('Nonce ID token Google tidak sesuai dengan transaksi');
    error.statusCode = 400;
    error.code = 'OAUTH_NONCE_MISMATCH';
    throw error;
  }

  // 2. Validate email verification status
  if (!verifiedPayload.email_verified) {
    const error: AppError = new Error('Email akun Google belum terverifikasi');
    error.statusCode = 400;
    error.code = 'EMAIL_NOT_VERIFIED';
    throw error;
  }

  const googleSub = verifiedPayload.sub;
  const rawEmail = verifiedPayload.email;
  if (!googleSub || !rawEmail) {
    const error: AppError = new Error('Identitas akun Google tidak lengkap');
    error.statusCode = 400;
    error.code = 'INVALID_IDENTITY_PAYLOAD';
    throw error;
  }

  const googleEmail = rawEmail.toLowerCase().trim();
  const googleName = verifiedPayload.name?.trim() || 'Pengguna Google';

  // 3. Handle Linking Intent (from Settings by an existing authenticated user)
  if (input.intent === 'link') {
    if (!currentUserId) {
      const error: AppError = new Error('Sesi autentikasi diperlukan untuk menghubungkan akun Google');
      error.statusCode = 401;
      error.code = 'UNAUTHORIZED';
      throw error;
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      include: {
        federatedIdentities: true,
      },
    });

    if (!currentUser) {
      const error: AppError = new Error('Pengguna tidak ditemukan');
      error.statusCode = 404;
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    // Email matching verification: Google email must match the StudyFlow account email
    if (googleEmail !== currentUser.email.toLowerCase().trim()) {
      const error: AppError = new Error(
        `Alamat email Google (${googleEmail}) berbeda dengan email akun StudyFlow Anda (${currentUser.email}). Email harus sama untuk menghubungkan akun.`
      );
      error.statusCode = 400;
      error.code = 'EMAIL_MISMATCH';
      throw error;
    }

    // Check if this Google identity is already connected
    const existingIdentity = await prisma.federatedIdentity.findUnique({
      where: {
        provider_subject: {
          provider: 'google',
          subject: googleSub,
        },
      },
    });

    if (existingIdentity) {
      if (existingIdentity.userId !== currentUser.id) {
        const error: AppError = new Error('Akun Google ini sudah terhubung ke akun StudyFlow yang lain');
        error.statusCode = 409;
        error.code = 'IDENTITY_ALREADY_LINKED';
        throw error;
      }

      // Already linked to the same user
      const providers = Array.from(
        new Set([...currentUser.federatedIdentities.map((f) => f.provider), 'google'])
      );
      return {
        user: toUserProfile(currentUser, providers),
        message: 'Akun Google sudah terhubung dengan akun StudyFlow Anda',
      };
    }

    // Create the federated identity link
    await prisma.federatedIdentity.create({
      data: {
        userId: currentUser.id,
        provider: 'google',
        subject: googleSub,
        email: googleEmail,
      },
    });

    // If user's email was not verified yet, but Google claims email_verified and email matches, mark verified
    let updatedCurrentUser = currentUser;
    if (!currentUser.emailVerifiedAt && verifiedPayload.email_verified && googleEmail === currentUser.email.toLowerCase().trim()) {
      updatedCurrentUser = await prisma.user.update({
        where: { id: currentUser.id },
        data: { emailVerifiedAt: new Date() },
        include: { federatedIdentities: true },
      });
    }

    const providers = Array.from(
      new Set([...currentUser.federatedIdentities.map((f) => f.provider), 'google'])
    );

    return {
      user: toUserProfile(updatedCurrentUser, providers),
      message: 'Akun Google berhasil dihubungkan ke akun StudyFlow Anda',
    };
  }

  // 4. Handle Login/Register Intent
  // Step 4A: Check if the Google identity (provider, subject) is already linked
  const existingIdentity = await prisma.federatedIdentity.findUnique({
    where: {
      provider_subject: {
        provider: 'google',
        subject: googleSub,
      },
    },
    include: {
      user: {
        include: {
          federatedIdentities: true,
        },
      },
    },
  });

  if (existingIdentity) {
    const user = existingIdentity.user;
    const providers = user.federatedIdentities.map((f) => f.provider);

    // Issue StudyFlow application session
    const familyId = crypto.randomUUID();
    const rawRefreshToken = generateRandomToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = getRefreshTokenExpiryDate();

    await prisma.refreshSession.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash,
        expiresAt,
      },
    });

    const accessToken = createAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    return {
      user: toUserProfile(user, providers),
      accessToken,
      refreshToken: rawRefreshToken,
      message: 'Masuk dengan Google berhasil',
    };
  }

  // Step 4B: If the Google identity is NOT yet linked, check if a User exists with this email
  const existingUserByEmail = await prisma.user.findUnique({
    where: { email: googleEmail },
  });

  if (existingUserByEmail) {
    // DO NOT automatically merge accounts! Require user to log in and link from Settings.
    const error: AppError = new Error(
      `Email ${googleEmail} sudah terdaftar menggunakan password. Silakan masuk dengan email dan password Anda terlebih dahulu, lalu hubungkan akun Google melalui menu Pengaturan.`
    );
    error.statusCode = 409;
    error.code = 'ACCOUNT_NOT_LINKED';
    throw error;
  }

  // Step 4C: If no user exists with this email, register a new StudyFlow account without local password
  let newUser: {
    id: string;
    name: string;
    email: string;
    passwordHash: string | null;
    timezone: string;
    role: 'USER' | 'ADMIN';
    tokenVersion: number;
    createdAt: Date;
    updatedAt: Date;
  };

  try {
    newUser = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: googleName,
          email: googleEmail,
          passwordHash: null,
          timezone: 'Asia/Jakarta',
          emailVerifiedAt: verifiedPayload.email_verified && googleEmail === rawEmail.toLowerCase().trim() ? new Date() : null,
        },
      });

      await tx.federatedIdentity.create({
        data: {
          userId: created.id,
          provider: 'google',
          subject: googleSub,
          email: googleEmail,
        },
      });

      return created;
    });
  } catch (err) {
    // Handle concurrent duplicate insertion
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const error: AppError = new Error('Akun Google ini sedang diproses atau sudah terdaftar.');
      error.statusCode = 409;
      error.code = 'CONCURRENT_CREATION_CONFLICT';
      throw error;
    }
    throw err;
  }

  // Issue StudyFlow application session for the newly created account
  const familyId = crypto.randomUUID();
  const rawRefreshToken = generateRandomToken();
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = getRefreshTokenExpiryDate();

  await prisma.refreshSession.create({
    data: {
      userId: newUser.id,
      familyId,
      tokenHash,
      expiresAt,
    },
  });

  const accessToken = createAccessToken({
    userId: newUser.id,
    email: newUser.email,
    role: newUser.role,
    tokenVersion: newUser.tokenVersion,
  });

  return {
    user: toUserProfile(newUser, ['google']),
    accessToken,
    refreshToken: rawRefreshToken,
    message: 'Akun StudyFlow berhasil dibuat melalui Google',
  };
}
