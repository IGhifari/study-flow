import { z } from 'zod';

export const SummaryStatusEnum = z.enum([
  'QUEUED',
  'PROCESSING',
  'READY',
  'FAILED',
]);
export type SummaryStatus = z.infer<typeof SummaryStatusEnum>;

export const KeyConceptSchema = z.object({
  concept: z.string().min(1, 'Nama konsep tidak boleh kosong'),
  explanation: z.string().min(1, 'Penjelasan konsep tidak boleh kosong'),
  pageReferences: z.array(z.number().int().positive()),
});
export type KeyConcept = z.infer<typeof KeyConceptSchema>;

export const SummarySectionSchema = z.object({
  heading: z.string().min(1, 'Judul bagian tidak boleh kosong'),
  content: z.string().min(1, 'Isi bagian tidak boleh kosong'),
  pageReferences: z.array(z.number().int().positive()),
});
export type SummarySection = z.infer<typeof SummarySectionSchema>;

export const KeyTermSchema = z.object({
  term: z.string().min(1, 'Istilah tidak boleh kosong'),
  definition: z.string().min(1, 'Definisi tidak boleh kosong'),
  pageReferences: z.array(z.number().int().positive()),
});
export type KeyTerm = z.infer<typeof KeyTermSchema>;

export const SummaryStructuredOutputSchema = z.object({
  title: z.string().min(1),
  overview: z.string().min(10),
  keyConcepts: z.array(KeyConceptSchema).min(1),
  sections: z.array(SummarySectionSchema).min(1),
  keyTerms: z.array(KeyTermSchema).min(1),
});
export type SummaryStructuredOutput = z.infer<typeof SummaryStructuredOutputSchema>;

export const ChunkSummaryOutputSchema = z.object({
  keyConcepts: z.array(KeyConceptSchema).min(1),
  sections: z.array(SummarySectionSchema).min(1),
});
export type ChunkSummaryOutput = z.infer<typeof ChunkSummaryOutputSchema>;

export const MaterialSummarySchema = z.object({
  id: z.string(),
  userId: z.string(),
  materialId: z.string(),
  status: SummaryStatusEnum,
  title: z.string().nullable().optional(),
  overview: z.string().nullable().optional(),
  keyConcepts: z.array(KeyConceptSchema).nullable().optional(),
  sections: z.array(SummarySectionSchema).nullable().optional(),
  keyTerms: z.array(KeyTermSchema).nullable().optional(),
  limitations: z.string().nullable().optional(),
  provider: z.string(),
  model: z.string(),
  promptVersion: z.string(),
  sourcePageCount: z.number().int().nonnegative(),
  sourceCharacterCount: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative().nullable().optional(),
  outputTokens: z.number().int().nonnegative().nullable().optional(),
  durationMs: z.number().int().nonnegative().nullable().optional(),
  activeJobId: z.string().nullable().optional(),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MaterialSummary = z.infer<typeof MaterialSummarySchema>;

export const GenerateSummaryInputSchema = z.object({
  regenerate: z.boolean().optional().default(false),
});
export type GenerateSummaryInput = z.infer<typeof GenerateSummaryInputSchema>;

export const AiQuotaStatusSchema = z.object({
  dailyLimit: z.number().int().nonnegative(),
  dailyUsed: z.number().int().nonnegative(),
  dailyRemaining: z.number().int().nonnegative(),
  activeJobsLimit: z.number().int().nonnegative(),
  activeJobsCount: z.number().int().nonnegative(),
  resetUtc: z.string(),
});
export type AiQuotaStatus = z.infer<typeof AiQuotaStatusSchema>;

export const SummaryResponseSchema = z.object({
  summary: MaterialSummarySchema.nullable(),
  quota: AiQuotaStatusSchema.optional(),
});
export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;

export const GenerateSummaryResponseSchema = z.object({
  message: z.string(),
  jobId: z.string(),
  summary: MaterialSummarySchema,
});
export type GenerateSummaryResponse = z.infer<typeof GenerateSummaryResponseSchema>;
