import { z } from "zod"
import { schema } from "@/components/data-table"

export type PlatformServiceItem = z.infer<typeof schema>

export const platformServicesData: PlatformServiceItem[] = [
  {
    id: 1,
    header: "Worker BullMQ AI & Ekstraksi",
    type: "Background Worker",
    status: "Done",
    target: "100%",
    limit: "15MB / Dokumen",
    reviewer: "Redis Queue",
  },
  {
    id: 2,
    header: "REST API Backend & Otentikasi",
    type: "Core Engine",
    status: "Done",
    target: "99.9%",
    limit: "60 req / min",
    reviewer: "Express Server",
  },
  {
    id: 3,
    header: "Basis Data PostgreSQL & Prisma",
    type: "Penyimpanan Utama",
    status: "Done",
    target: "100%",
    limit: "Pool Size 20",
    reviewer: "Prisma ORM",
  },
  {
    id: 4,
    header: "Supabase Private Object Storage",
    type: "Penyimpanan Berkas",
    status: "Done",
    target: "100%",
    limit: "Signed URL 1 Jam",
    reviewer: "Supabase S3",
  },
  {
    id: 5,
    header: "Pipeline AI Ringkasan, Kartu & Kuis",
    type: "AI Pipeline",
    status: "Done",
    target: "Kuota Aktif",
    limit: "Gemini 2.5",
    reviewer: "Google AI Studio",
  },
  {
    id: 6,
    header: "Manajemen Kuota Harian AI Mahasiswa",
    type: "Security & Quota",
    status: "Done",
    target: "10 req/hari",
    limit: "Atomic Postgres Tx",
    reviewer: "Quota Middleware",
  },
  {
    id: 7,
    header: "Monitoring Antrean Pekerjaan & Retry",
    type: "Admin Ops",
    status: "Done",
    target: "Realtime",
    limit: "Retensi 24 Jam",
    reviewer: "Admin Engine",
  },
  {
    id: 8,
    header: "Audit Akses & Otentikasi Admin",
    type: "Authorization",
    status: "Done",
    target: "100%",
    limit: "Strict DB Role Check",
    reviewer: "Admin Guard",
  },
]
