import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GeminiAiProviderAdapter,
  AiProviderError,
  AiProviderUnavailableAdapter,
  getAiProviderAdapter,
  setAiProviderAdapterForTesting,
  GEMINI_SUMMARY_RESPONSE_SCHEMA,
  GEMINI_CHUNK_RESPONSE_SCHEMA,
} from '../services/aiProvider.js';
import { env } from '../config/env.js';

describe('GeminiAiProviderAdapter Structured Output & Error Handling', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should include responseSchema and successfully parse valid structured output', async () => {
    let capturedBody: any = null;

    global.fetch = vi.fn().mockImplementation(async (_url, options) => {
      capturedBody = JSON.parse(options.body);
      const validPayload = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    title: 'Ringkasan Sistem Operasi',
                    overview: 'Materi ini membahas prinsip dasar arsitektur sistem operasi modern secara menyeluruh.',
                    keyConcepts: [
                      {
                        concept: 'Manajemen Memori Virtual',
                        explanation: 'Mekanisme paging dan segmentasi untuk alokasi memori proses.',
                        pageReferences: [1],
                      },
                    ],
                    sections: [
                      {
                        heading: '1. Konsep Proses dan Thread',
                        content: 'Proses adalah program yang sedang dieksekusi dengan ruang alamat independen.',
                        pageReferences: [1],
                      },
                    ],
                    keyTerms: [
                      {
                        term: 'Deadlock',
                        definition: 'Kondisi di mana dua atau lebih proses saling menunggu sumber daya.',
                        pageReferences: [1],
                      },
                    ],
                  }),
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 150,
          candidatesTokenCount: 90,
        },
      };

      return new Response(JSON.stringify(validPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const adapter = new GeminiAiProviderAdapter('fake-key-for-test', 'gemini-3.5-flash-lite');
    const result = await adapter.generateSummary({
      materialTitle: 'Sistem Operasi',
      totalPages: 1,
      pages: [{ pageNumber: 1, text: 'Materi pengantar sistem operasi.' }],
    });

    // Check request payload sent to Gemini
    expect(capturedBody).toBeDefined();
    expect(capturedBody.generationConfig).toBeDefined();
    expect(capturedBody.generationConfig.responseMimeType).toBe('application/json');
    expect(capturedBody.generationConfig.responseSchema).toEqual(GEMINI_SUMMARY_RESPONSE_SCHEMA);

    // Check parsed result
    expect(result.title).toBe('Ringkasan Sistem Operasi');
    expect(result.keyConcepts).toHaveLength(1);
    expect(result.sections).toHaveLength(1);
    expect(result.keyTerms).toHaveLength(1);
    expect(result.inputTokens).toBe(150);
    expect(result.outputTokens).toBe(90);
  });

  it('should detect missing required fields and throw AI_INVALID_OUTPUT detailing the missing field and code', async () => {
    // Model returns Indonesian keys instead of required schema keys
    global.fetch = vi.fn().mockImplementation(async () => {
      const invalidPayload = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    judul: 'Pengantar Sistem Komputer',
                    ringkasan: 'Pembahasan ringkas materi kuliah',
                    total_halaman: 1,
                  }),
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      };

      return new Response(JSON.stringify(invalidPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const adapter = new GeminiAiProviderAdapter('fake-key-for-test', 'gemini-3.5-flash-lite');

    let thrownError: any = null;
    try {
      await adapter.generateSummary({
        materialTitle: 'Sistem Komputer',
        totalPages: 1,
        pages: [{ pageNumber: 1, text: 'Arsitektur Von Neumann.' }],
      });
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(AiProviderError);
    expect(thrownError.code).toBe('AI_INVALID_OUTPUT');
    expect(thrownError.isRetryable).toBe(true);
    // Error message must contain exact missing field path and code
    expect(thrownError.message).toContain('title');
    expect(thrownError.message).toContain('invalid_type');
  });

  it('should detect truncated output when finishReason is MAX_TOKENS and throw retryable AI_OUTPUT_TRUNCATED', async () => {
    global.fetch = vi.fn().mockImplementation(async () => {
      const truncatedPayload = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '{"title": "Ringkasan Terpotong',
                },
              ],
            },
            finishReason: 'MAX_TOKENS',
          },
        ],
      };

      return new Response(JSON.stringify(truncatedPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const adapter = new GeminiAiProviderAdapter('fake-key-for-test', 'gemini-3.5-flash-lite');

    await expect(
      adapter.generateSummary({
        materialTitle: 'Dokumen Terpotong',
        totalPages: 1,
        pages: [{ pageNumber: 1, text: 'Teks panjang yang terpotong.' }],
      })
    ).rejects.toMatchObject({
      code: 'AI_OUTPUT_TRUNCATED',
      isRetryable: true,
    });
  });

  it('should detect safety block when finishReason is SAFETY and throw non-retryable AI_SAFETY_BLOCKED', async () => {
    global.fetch = vi.fn().mockImplementation(async () => {
      const blockedPayload = {
        candidates: [
          {
            finishReason: 'SAFETY',
          },
        ],
      };

      return new Response(JSON.stringify(blockedPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const adapter = new GeminiAiProviderAdapter('fake-key-for-test', 'gemini-3.5-flash-lite');

    await expect(
      adapter.generateSummary({
        materialTitle: 'Materi Sensitif',
        totalPages: 1,
        pages: [{ pageNumber: 1, text: 'Konten sensitif.' }],
      })
    ).rejects.toMatchObject({
      code: 'AI_SAFETY_BLOCKED',
      isRetryable: false,
    });
  });

  it('should throw AI_EMPTY_RESPONSE when candidate has no text parts', async () => {
    global.fetch = vi.fn().mockImplementation(async () => {
      const emptyPayload = {
        candidates: [
          {
            content: {
              parts: [{ text: '   ' }],
            },
            finishReason: 'STOP',
          },
        ],
      };

      return new Response(JSON.stringify(emptyPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const adapter = new GeminiAiProviderAdapter('fake-key-for-test', 'gemini-3.5-flash-lite');

    await expect(
      adapter.generateSummary({
        materialTitle: 'Dokumen Kosong',
        totalPages: 1,
        pages: [{ pageNumber: 1, text: 'Teks kosong.' }],
      })
    ).rejects.toMatchObject({
      code: 'AI_EMPTY_RESPONSE',
      isRetryable: false,
    });
  });

  it('should handle multi-chunk processing with GEMINI_CHUNK_RESPONSE_SCHEMA and synthesis merge', async () => {
    const chunkSchemasSeen: any[] = [];

    global.fetch = vi.fn().mockImplementation(async (_url, options) => {
      const body = JSON.parse(options.body);
      chunkSchemasSeen.push(body.generationConfig.responseSchema);

      if (body.generationConfig.responseSchema === GEMINI_CHUNK_RESPONSE_SCHEMA) {
        // Chunk response
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        keyConcepts: [
                          {
                            concept: 'Konsep Chunk',
                            explanation: 'Penjelasan bagian chunk',
                            pageReferences: [1],
                          },
                        ],
                        sections: [
                          {
                            heading: 'Bagian Chunk',
                            content: 'Isi bagian chunk',
                            pageReferences: [1],
                          },
                        ],
                      }),
                    },
                  ],
                },
                finishReason: 'STOP',
              },
            ],
            usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Synthesis merge response
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: 'Ringkasan Multi Chunk',
                      overview: 'Gambaran umum sintesis materi panjang dari berbagai bab.',
                      keyConcepts: [
                        {
                          concept: 'Konsep Gabungan',
                          explanation: 'Penjelasan konsep sintesis akhir',
                          pageReferences: [1],
                        },
                      ],
                      sections: [
                        {
                          heading: 'Bab Gabungan',
                          content: 'Isi pembahasan gabungan',
                          pageReferences: [1],
                        },
                      ],
                      keyTerms: [
                        {
                          term: 'Istilah Sintesis',
                          definition: 'Definisi istilah hasil gabungan',
                          pageReferences: [1],
                        },
                      ],
                    }),
                  },
                ],
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: { promptTokenCount: 200, candidatesTokenCount: 120 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const adapter = new GeminiAiProviderAdapter('fake-key-for-test', 'gemini-3.5-flash-lite');

    // Create 2 pages within single-page limit (25,000 <= 40,000), but combined (50,000) > 40,000
    const longText1 = 'A'.repeat(25000);
    const longText2 = 'B'.repeat(25000);

    const result = await adapter.generateSummary({
      materialTitle: 'Buku Ajar Jaringan Lanjut',
      totalPages: 2,
      pages: [
        { pageNumber: 1, text: longText1 },
        { pageNumber: 2, text: longText2 },
      ],
    });

    expect(result.title).toBe('Ringkasan Multi Chunk');
    expect(chunkSchemasSeen).toHaveLength(3); // 2 chunk calls + 1 merge call
    expect(chunkSchemasSeen[0]).toEqual(GEMINI_CHUNK_RESPONSE_SCHEMA);
    expect(chunkSchemasSeen[1]).toEqual(GEMINI_CHUNK_RESPONSE_SCHEMA);
    expect(chunkSchemasSeen[2]).toEqual(GEMINI_SUMMARY_RESPONSE_SCHEMA);
  });

  it('should reject when a single page exceeds maxChunkCharacters (40,000 characters)', async () => {
    const adapter = new GeminiAiProviderAdapter('fake-key-for-test', 'gemini-3.5-flash-lite');

    await expect(
      adapter.generateSummary({
        materialTitle: 'Satu Halaman Terlalu Besar',
        totalPages: 1,
        pages: [{ pageNumber: 1, text: 'X'.repeat(45000) }],
      })
    ).rejects.toMatchObject({
      code: 'DOCUMENT_TOO_LARGE',
    });
  });

  it('should reject when total chunks capacity exceeds 3 chunks', async () => {
    const adapter = new GeminiAiProviderAdapter('fake-key-for-test', 'gemini-3.5-flash-lite');

    // 4 separate pages of 35,000 chars each -> requires 4 chunks, exceeding maxChunks (3)
    const pages = [
      { pageNumber: 1, text: 'A'.repeat(35000) },
      { pageNumber: 2, text: 'B'.repeat(35000) },
      { pageNumber: 3, text: 'C'.repeat(35000) },
      { pageNumber: 4, text: 'D'.repeat(35000) },
    ];

    await expect(
      adapter.generateSummary({
        materialTitle: 'Empat Bagian',
        totalPages: 4,
        pages,
      })
    ).rejects.toMatchObject({
      code: 'DOCUMENT_TOO_LARGE',
    });
  });
});

describe('GeminiAiProviderAdapter Security & API Key Protection', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setAiProviderAdapterForTesting(null);
  });

  it('should send API key in x-goog-api-key header and NOT expose it in the request URL query params', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};

    global.fetch = vi.fn().mockImplementation(async (url, options) => {
      capturedUrl = String(url);
      capturedHeaders = options.headers;
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: 'Ringkasan Aman',
                      overview: 'Overview ringkasan',
                      keyConcepts: [{ concept: 'C1', explanation: 'E1', pageReferences: [1] }],
                      sections: [{ heading: 'H1', content: 'C1', pageReferences: [1] }],
                      keyTerms: [{ term: 'T1', definition: 'D1', pageReferences: [1] }],
                    }),
                  },
                ],
              },
              finishReason: 'STOP',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const secretKey = 'secret-gemini-key-999-xyz';
    const adapter = new GeminiAiProviderAdapter(secretKey, 'gemini-2.5-flash');

    await adapter.generateSummary({
      materialTitle: 'Keamanan API Key',
      totalPages: 1,
      pages: [{ pageNumber: 1, text: 'Isi teks uji' }],
    });

    // 1. Endpoint verification
    expect(capturedUrl).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
    );
    expect(capturedUrl).not.toContain('key=');
    expect(capturedUrl).not.toContain(secretKey);

    // 2. Header verification
    expect(capturedHeaders['x-goog-api-key']).toBe(secretKey);
    expect(capturedHeaders['Content-Type']).toBe('application/json');
  });

  it('should redact API key from network error messages (defense-in-depth)', async () => {
    const secretKey = 'sensitive-token-secret-123';
    const adapter = new GeminiAiProviderAdapter(secretKey, 'gemini-2.5-flash');

    // Simulate fetch throwing an error that includes the secret key in the error message
    global.fetch = vi.fn().mockRejectedValue(
      new Error(`connect ECONNREFUSED https://generativelanguage.googleapis.com?key=${secretKey}`)
    );

    let caughtError: any = null;
    try {
      await adapter.generateSummary({
        materialTitle: 'Uji Error Jaringan',
        totalPages: 1,
        pages: [{ pageNumber: 1, text: 'Konten' }],
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(AiProviderError);
    expect(caughtError.code).toBe('AI_NETWORK_ERROR');
    expect(caughtError.message).not.toContain(secretKey);
    expect(caughtError.message).toContain('[REDACTED]');
  });

  it('should redact API key if provider error body echoes the key', async () => {
    const secretKey = 'sensitive-token-secret-456';
    const adapter = new GeminiAiProviderAdapter(secretKey, 'gemini-2.5-flash');

    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: `API key ${secretKey} is invalid or has expired.`,
            status: 'INVALID_ARGUMENT',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    );

    let caughtError: any = null;
    try {
      await adapter.generateSummary({
        materialTitle: 'Uji Error Provider',
        totalPages: 1,
        pages: [{ pageNumber: 1, text: 'Konten' }],
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(AiProviderError);
    expect(caughtError.message).not.toContain(secretKey);
    expect(caughtError.message).toContain('[REDACTED]');
  });

  it('should return AiProviderUnavailableAdapter when AI_PROVIDER is gemini but GEMINI_API_KEY is empty', async () => {
    const originalProvider = env.AI_PROVIDER;
    const originalApiKey = env.GEMINI_API_KEY;

    try {
      (env as any).AI_PROVIDER = 'gemini';
      (env as any).GEMINI_API_KEY = '';
      setAiProviderAdapterForTesting(null);

      const adapter = getAiProviderAdapter();
      expect(adapter).toBeInstanceOf(AiProviderUnavailableAdapter);

      await expect(
        adapter.generateSummary({
          materialTitle: 'Test',
          totalPages: 1,
          pages: [{ pageNumber: 1, text: 'Sample' }],
        })
      ).rejects.toMatchObject({
        code: 'AI_PROVIDER_UNAVAILABLE',
        statusCode: 503,
      });
    } finally {
      (env as any).AI_PROVIDER = originalProvider;
      (env as any).GEMINI_API_KEY = originalApiKey;
      setAiProviderAdapterForTesting(null);
    }
  });
});
