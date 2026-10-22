import { NextRequest, NextResponse } from 'next/server';

export const MAX_BFF_BODY_BYTES = 1024 * 1024; // 1 MiB

export interface ReadBodyLimitResult {
  ok: boolean;
  body?: string;
  errorResponse?: NextResponse;
}

/**
 * Safely reads the request body stream with a strict byte limit (1 MiB).
 * Bails out immediately if Content-Length exceeds limit or if stream exceeds limit,
 * safely cancelling the underlying reader to prevent unbounded memory consumption.
 */
export async function readRequestBodyWithLimit(
  req: NextRequest,
  maxBytes: number = MAX_BFF_BODY_BYTES
): Promise<ReadBodyLimitResult> {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return { ok: true, body: undefined };
  }

  // 1. Fast rejection if Content-Length header is present, valid integer, and exceeds limit
  const clHeader = req.headers.get('content-length');
  if (clHeader !== null && clHeader !== '') {
    const parsedCl = parseInt(clHeader, 10);
    if (!Number.isNaN(parsedCl) && parsedCl > maxBytes) {
      if (req.body && typeof (req.body as any).getReader === 'function') {
        try {
          const reader = req.body.getReader();
          await reader.cancel('PAYLOAD_TOO_LARGE');
        } catch {
          // ignore stream cancellation error
        }
      }
      return {
        ok: false,
        errorResponse: NextResponse.json(
          {
            error: {
              code: 'PAYLOAD_TOO_LARGE',
              message: 'Ukuran payload request melebihi batas maksimal 1 MiB.',
            },
          },
          { status: 413 }
        ),
      };
    }
  }

  // 2. If no body stream is available
  if (!req.body) {
    return { ok: true, body: undefined };
  }

  // 3. Fallback for non-standard ReadableStream
  if (typeof req.body.getReader !== 'function') {
    try {
      const text = await req.text();
      const byteLen = Buffer.byteLength(text, 'utf-8');
      if (byteLen > maxBytes) {
        return {
          ok: false,
          errorResponse: NextResponse.json(
            {
              error: {
                code: 'PAYLOAD_TOO_LARGE',
                message: 'Ukuran payload request melebihi batas maksimal 1 MiB.',
              },
            },
            { status: 413 }
          ),
        };
      }
      return { ok: true, body: text };
    } catch {
      return {
        ok: false,
        errorResponse: NextResponse.json(
          {
            error: {
              code: 'REQUEST_STREAM_ERROR',
              message: 'Gagal membaca stream request body.',
            },
          },
          { status: 400 }
        ),
      };
    }
  }

  // 4. Stream-bounded reader: read chunk by chunk up to maxBytes
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          try {
            await reader.cancel('PAYLOAD_TOO_LARGE');
          } catch {
            // ignore stream cancellation error
          }
          return {
            ok: false,
            errorResponse: NextResponse.json(
              {
                error: {
                  code: 'PAYLOAD_TOO_LARGE',
                  message: 'Ukuran payload request melebihi batas maksimal 1 MiB.',
                },
              },
              { status: 413 }
            ),
          };
        }
        chunks.push(value);
      }
    }
  } catch {
    return {
      ok: false,
      errorResponse: NextResponse.json(
        {
          error: {
            code: 'REQUEST_STREAM_ERROR',
            message: 'Gagal membaca stream request body.',
          },
        },
        { status: 400 }
      ),
    };
  }

  if (chunks.length === 0) {
    return { ok: true, body: '' };
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, body: new TextDecoder('utf-8').decode(combined) };
}
