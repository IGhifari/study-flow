'use client';

import Link from "next/link"
import {
  Users,
  FileText,
  CheckSquare,
  AlertTriangle,
  ArrowRightIcon,
  CheckCircle2,
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
import { StaggerGroup, StaggerItem } from "@/components/ui/motion"
import { formatBytes } from "@/lib/admin-formatters"
import type { AdminSummary } from "@studyflow/shared"

interface SectionCardsProps {
  summary?: AdminSummary | null
  isLoading?: boolean
}

export function SectionCards({ summary, isLoading = false }: SectionCardsProps) {
  const hasFailedJobs = Boolean(summary && summary.failedJobs24h > 0)
  const totalStorage = summary?.totalStorageBytes ? formatBytes(summary.totalStorageBytes) : "0 B"
  const adminCount = summary?.totalAdmins ?? 0
  const courseCount = summary?.totalCourses ?? 0

  return (
    <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 px-4 lg:px-6">
      {/* 1. Total Pengguna (Deep-link ke /users) */}
      <StaggerItem className="h-full">
        <Link
          href="/users"
          className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl group"
        >
          <Card className="@container/card flex h-full flex-col justify-between border border-border bg-card shadow-xs transition-all hover:border-primary/50 hover:shadow-sm">
            <CardHeader className="p-5 pb-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <CardDescription className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Total Pengguna
                </CardDescription>
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-normal shrink-0"
                >
                  <Users className="size-3 text-muted-foreground" />
                  {adminCount > 0 ? `${adminCount} Admin` : "Mahasiswa"}
                </Badge>
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums">
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  (summary ? summary.totalUsers.toLocaleString("id-ID") : "0")
                )}
              </CardTitle>
            </CardHeader>
            <CardFooter className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 bg-muted/15 px-5 py-3 text-xs">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground group-hover:text-primary transition-colors">
                  Akun mahasiswa &amp; admin
                </p>
                <p className="truncate text-muted-foreground">
                  Buka direktori pengguna
                </p>
              </div>
              <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </CardFooter>
          </Card>
        </Link>
      </StaggerItem>

      {/* 2. Total Materi (Deep-link ke /materials) */}
      <StaggerItem className="h-full">
        <Link
          href="/materials"
          className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl group"
        >
          <Card className="@container/card flex h-full flex-col justify-between border border-border bg-card shadow-xs transition-all hover:border-primary/50 hover:shadow-sm">
            <CardHeader className="p-5 pb-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <CardDescription className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Total Materi Kuliah
                </CardDescription>
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-normal tabular-nums shrink-0"
                >
                  <FileText className="size-3 text-muted-foreground" />
                  {totalStorage}
                </Badge>
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums">
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  (summary ? summary.totalMaterials.toLocaleString("id-ID") : "0")
                )}
              </CardTitle>
            </CardHeader>
            <CardFooter className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 bg-muted/15 px-5 py-3 text-xs">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground group-hover:text-primary transition-colors">
                  Storage: {totalStorage}
                </p>
                <p className="truncate text-muted-foreground">
                  Buka direktori materi
                </p>
              </div>
              <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </CardFooter>
          </Card>
        </Link>
      </StaggerItem>

      {/* 3. Total Tugas (Deep-link ke /assignments) */}
      <StaggerItem className="h-full">
        <Link
          href="/assignments"
          className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl group"
        >
          <Card className="@container/card flex h-full flex-col justify-between border border-border bg-card shadow-xs transition-all hover:border-primary/50 hover:shadow-sm">
            <CardHeader className="p-5 pb-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <CardDescription className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Total Tugas Akademik
                </CardDescription>
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-normal tabular-nums shrink-0"
                >
                  <CheckSquare className="size-3 text-muted-foreground" />
                  {courseCount} Matkul
                </Badge>
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums">
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  (summary ? summary.totalAssignments.toLocaleString("id-ID") : "0")
                )}
              </CardTitle>
            </CardHeader>
            <CardFooter className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 bg-muted/15 px-5 py-3 text-xs">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground group-hover:text-primary transition-colors">
                  Mata kuliah aktif: {courseCount}
                </p>
                <p className="truncate text-muted-foreground">
                  Buka daftar tugas
                </p>
              </div>
              <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </CardFooter>
          </Card>
        </Link>
      </StaggerItem>

      {/* 4. Gagal AI (24 Jam) (Deep-link ke /jobs?status=FAILED) */}
      <StaggerItem className="h-full">
        <Link
          href="/jobs?status=FAILED"
          className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl group"
        >
          <Card className={`@container/card flex h-full flex-col justify-between border border-border bg-card shadow-xs transition-all hover:shadow-sm ${hasFailedJobs ? "hover:border-destructive/60" : "hover:border-primary/50"}`}>
            <CardHeader className="p-5 pb-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <CardDescription className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Pekerjaan Gagal (24 Jam)
                </CardDescription>
                {hasFailedJobs ? (
                  <Badge variant="destructive" className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs shrink-0">
                    <AlertTriangle className="size-3" />
                    Perlu Perhatian
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs bg-success text-success-foreground border-transparent shrink-0"
                  >
                    <CheckCircle2 className="size-3" />
                    Normal
                  </Badge>
                )}
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums">
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  (summary ? summary.failedJobs24h.toLocaleString("id-ID") : "0")
                )}
              </CardTitle>
            </CardHeader>
            <CardFooter className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 bg-muted/15 px-5 py-3 text-xs">
              <div className="min-w-0">
                <p className={`truncate font-medium text-foreground ${hasFailedJobs ? "group-hover:text-destructive" : "group-hover:text-primary"} transition-colors`}>
                  Kestabilan antrean AI
                </p>
                <p className="truncate text-muted-foreground">
                  {hasFailedJobs
                    ? "Tinjau daftar pekerjaan gagal"
                    : "Buka monitoring pekerjaan"}
                </p>
              </div>
              <ArrowRightIcon className={`size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 ${hasFailedJobs ? "group-hover:text-destructive" : "group-hover:text-primary"}`} />
            </CardFooter>
          </Card>
        </Link>
      </StaggerItem>
    </StaggerGroup>
  )
}
