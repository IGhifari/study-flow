'use client';

import Link from "next/link"
import {
  TrendingDownIcon,
  TrendingUpIcon,
  Users,
  FileText,
  CheckSquare,
  AlertTriangle,
  ArrowRightIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { AdminSummary } from "@studyflow/shared"

interface SectionCardsProps {
  summary?: AdminSummary | null
  isLoading?: boolean
}

export function SectionCards({ summary, isLoading = false }: SectionCardsProps) {
  const hasFailedJobs = Boolean(summary && summary.failedJobs24h > 0)

  return (
    <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:px-6">
      {/* 1. Total Pengguna (Deep-link ke /users) */}
      <Link
        href="/users"
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl group"
      >
        <Card className="@container/card h-full transition-all hover:border-primary/50 hover:shadow-sm">
          <CardHeader className="relative">
            <div className="flex items-center justify-between">
              <CardDescription className="group-hover:text-foreground transition-colors">
                Total Pengguna
              </CardDescription>
              <ArrowRightIcon className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums mt-1">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                (summary ? summary.totalUsers.toLocaleString("id-ID") : "0")
              )}
            </CardTitle>
            <div className="absolute right-4 top-4">
              <Badge
                variant="outline"
                className="flex gap-1 rounded-lg text-xs border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              >
                <TrendingUpIcon className="size-3" />
                Mahasiswa
              </Badge>
            </div>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <div className="line-clamp-1 flex items-center gap-2 font-medium group-hover:text-primary transition-colors">
              Akun mahasiswa terdaftar <Users className="size-3.5 text-muted-foreground" />
            </div>
            <div className="text-muted-foreground text-xs">
              Buka direktori pengguna &rarr;
            </div>
          </CardFooter>
        </Card>
      </Link>

      {/* 2. Total Materi */}
      <Card className="@container/card h-full">
        <CardHeader className="relative">
          <CardDescription>Total Materi Kuliah</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums mt-1">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              (summary ? summary.totalMaterials.toLocaleString("id-ID") : "0")
            )}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge
              variant="outline"
              className="flex gap-1 rounded-lg text-xs border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
            >
              <FileText className="size-3" />
              Dokumen
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex items-center gap-2 font-medium">
            Bahan pembelajaran aktif <TrendingUpIcon className="size-3.5 text-blue-500" />
          </div>
          <div className="text-muted-foreground text-xs">
            Tidak termasuk arsip / terhapus
          </div>
        </CardFooter>
      </Card>

      {/* 3. Total Tugas */}
      <Card className="@container/card h-full">
        <CardHeader className="relative">
          <CardDescription>Total Tugas Akademik</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums mt-1">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              (summary ? summary.totalAssignments.toLocaleString("id-ID") : "0")
            )}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge
              variant="outline"
              className="flex gap-1 rounded-lg text-xs border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400"
            >
              <CheckSquare className="size-3" />
              Tugas
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex items-center gap-2 font-medium">
            Tugas perkuliahan mahasiswa <TrendingUpIcon className="size-3.5 text-violet-500" />
          </div>
          <div className="text-muted-foreground text-xs">
            Terdistribusi lintas semester
          </div>
        </CardFooter>
      </Card>

      {/* 4. Gagal AI (24 Jam) (Deep-link ke /jobs?status=FAILED) */}
      <Link
        href="/jobs?status=FAILED"
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl group"
      >
        <Card className={`@container/card h-full transition-all hover:shadow-sm ${hasFailedJobs ? "hover:border-destructive/60" : "hover:border-primary/50"}`}>
          <CardHeader className="relative">
            <div className="flex items-center justify-between">
              <CardDescription className="group-hover:text-foreground transition-colors">
                Pekerjaan Gagal (24 Jam)
              </CardDescription>
              <ArrowRightIcon className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums mt-1">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                (summary ? summary.failedJobs24h.toLocaleString("id-ID") : "0")
              )}
            </CardTitle>
            <div className="absolute right-4 top-4">
              {hasFailedJobs ? (
                <Badge variant="destructive" className="flex gap-1 rounded-lg text-xs">
                  <TrendingDownIcon className="size-3" />
                  Perlu Perhatian
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="flex gap-1 rounded-lg text-xs border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                >
                  <TrendingUpIcon className="size-3" />
                  Normal
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <div className={`line-clamp-1 flex items-center gap-2 font-medium ${hasFailedJobs ? "group-hover:text-destructive" : "group-hover:text-primary"} transition-colors`}>
              Kestabilan antrean AI <AlertTriangle className="size-3.5 text-muted-foreground" />
            </div>
            <div className="text-muted-foreground text-xs">
              {hasFailedJobs
                ? "Tinjau daftar pekerjaan gagal \u2192"
                : "Buka monitoring pekerjaan \u2192"}
            </div>
          </CardFooter>
        </Card>
      </Link>
    </div>
  )
}
