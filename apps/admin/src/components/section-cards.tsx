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
    <StaggerGroup className="@xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 lg:px-6">
      {/* 1. Total Pengguna (Deep-link ke /users) */}
      <StaggerItem className="h-full">
        <Link
          href="/users"
          className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl group"
        >
          <Card className="@container/card h-full border border-border bg-card shadow-xs transition-all hover:border-primary/50 hover:shadow-sm">
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
                  variant="secondary"
                  className="flex items-center gap-1 rounded-lg text-xs font-normal"
                >
                  <Users className="size-3 text-muted-foreground" />
                  {adminCount > 0 ? `${adminCount} Admin` : "Mahasiswa"}
                </Badge>
              </div>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-sm">
              <div className="line-clamp-1 flex items-center gap-2 font-medium group-hover:text-primary transition-colors">
                Akun mahasiswa & admin <Users className="size-3.5 text-muted-foreground" />
              </div>
              <div className="text-muted-foreground text-xs">
                Buka direktori pengguna &rarr;
              </div>
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
          <Card className="@container/card h-full border border-border bg-card shadow-xs transition-all hover:border-primary/50 hover:shadow-sm">
            <CardHeader className="relative">
              <div className="flex items-center justify-between">
                <CardDescription className="group-hover:text-foreground transition-colors">
                  Total Materi Kuliah
                </CardDescription>
                <ArrowRightIcon className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums mt-1">
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  (summary ? summary.totalMaterials.toLocaleString("id-ID") : "0")
                )}
              </CardTitle>
              <div className="absolute right-4 top-4">
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 rounded-lg text-xs font-normal tabular-nums"
                >
                  <FileText className="size-3 text-muted-foreground" />
                  {totalStorage}
                </Badge>
              </div>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-sm">
              <div className="line-clamp-1 flex items-center gap-2 font-medium group-hover:text-primary transition-colors">
                Storage: {totalStorage} <FileText className="size-3.5 text-muted-foreground" />
              </div>
              <div className="text-muted-foreground text-xs">
                Buka direktori materi &rarr;
              </div>
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
          <Card className="@container/card h-full border border-border bg-card shadow-xs transition-all hover:border-primary/50 hover:shadow-sm">
            <CardHeader className="relative">
              <div className="flex items-center justify-between">
                <CardDescription className="group-hover:text-foreground transition-colors">
                  Total Tugas Akademik
                </CardDescription>
                <ArrowRightIcon className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums mt-1">
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  (summary ? summary.totalAssignments.toLocaleString("id-ID") : "0")
                )}
              </CardTitle>
              <div className="absolute right-4 top-4">
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 rounded-lg text-xs font-normal tabular-nums"
                >
                  <CheckSquare className="size-3 text-muted-foreground" />
                  {courseCount} Matkul
                </Badge>
              </div>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-sm">
              <div className="line-clamp-1 flex items-center gap-2 font-medium group-hover:text-primary transition-colors">
                Mata kuliah aktif: {courseCount} <CheckSquare className="size-3.5 text-muted-foreground" />
              </div>
              <div className="text-muted-foreground text-xs">
                Buka daftar tugas &rarr;
              </div>
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
          <Card className={`@container/card h-full border border-border bg-card shadow-xs transition-all hover:shadow-sm ${hasFailedJobs ? "hover:border-destructive/60" : "hover:border-primary/50"}`}>
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
                  <Badge variant="destructive" className="flex items-center gap-1 rounded-lg text-xs">
                    <AlertTriangle className="size-3" />
                    Perlu Perhatian
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 rounded-lg text-xs bg-success text-success-foreground border-transparent"
                  >
                    <CheckCircle2 className="size-3" />
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
      </StaggerItem>
    </StaggerGroup>
  )
}
