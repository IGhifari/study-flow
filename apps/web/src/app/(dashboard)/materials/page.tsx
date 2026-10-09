'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Files,
  Plus,
  Search,
  RotateCcw,
  ExternalLink,
  AlertCircle,
  FileText,
  BookOpen,
  Clock,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  MaterialListItem,
  Course,
  formatUserDateTime,
  UserProfile,
} from '@studyflow/shared';
import { listMaterials, retryMaterialProcessing } from '@/lib/material-client';
import { listCourses } from '@/lib/course-client';
import { getProfile } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  RadixSelect as Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { MaterialUploadDialog } from '@/components/materials/material-upload-dialog';
import { MaterialStatusBadge } from '@/components/materials/material-status-badge';

export default function MaterialsPage(): React.JSX.Element {
  const [materials, setMaterials] = React.useState<MaterialListItem[]>([]);
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [courseFilter, setCourseFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');

  const [isUploadOpen, setIsUploadOpen] = React.useState(false);
  const [retryingId, setRetryingId] = React.useState<string | null>(null);

  const timezone = userProfile?.timezone || 'Asia/Jakarta';

  // Fetch initial data
  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [profile, courseRes, materialRes] = await Promise.all([
        getProfile().catch(() => null),
        listCourses({ isArchived: false }).catch(() => ({ courses: [] })),
        listMaterials({
          search: search.trim() || undefined,
          courseId: courseFilter || undefined,
          status: (statusFilter as any) || undefined,
        }),
      ]);

      if (profile) setUserProfile(profile);
      setCourses(courseRes.courses);
      setMaterials(materialRes.materials);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat daftar materi kuliah.');
    } finally {
      setIsLoading(false);
    }
  }, [search, courseFilter, statusFilter]);

  React.useEffect(() => {
    loadData();

    const handleSemesterChange = () => {
      loadData();
    };
    window.addEventListener('studyflow:semester-changed', handleSemesterChange);

    return () => {
      window.removeEventListener('studyflow:semester-changed', handleSemesterChange);
    };
  }, [loadData]);

  // Polling for any active materials (QUEUED or PROCESSING)
  React.useEffect(() => {
    const hasActiveJobs = materials.some(
      (m) => m.status === 'QUEUED' || m.status === 'PROCESSING' || m.status === 'UPLOADING'
    );

    if (!hasActiveJobs) return;

    let pollInterval = 5000;
    let timer: NodeJS.Timeout;

    const poll = async () => {
      if (document.hidden) return;

      try {
        const res = await listMaterials({
          search: search.trim() || undefined,
          courseId: courseFilter || undefined,
          status: (statusFilter as any) || undefined,
        });
        setMaterials(res.materials);
      } catch {
        pollInterval = Math.min(pollInterval * 1.5, 30000);
      }
    };

    timer = setInterval(poll, pollInterval);

    const handleVisibility = () => {
      if (!document.hidden) {
        poll();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [materials, search, courseFilter, statusFilter]);

  const handleRetry = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRetryingId(id);
    try {
      await retryMaterialProcessing(id);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengulang pemrosesan');
    } finally {
      setRetryingId(null);
    }
  };

  const hasFilter = Boolean(search || courseFilter || statusFilter);

  return (
    <div className="space-y-6">
      {/* 1. Header Halaman */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Materi PDF
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Unggah dan pelajari materi kuliah berbasis teks dengan ekstraksi halaman otomatis.
          </p>
        </div>

        <Button
          onClick={() => setIsUploadOpen(true)}
          className="gap-2 shrink-0 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Unggah materi</span>
        </Button>
      </div>

      {/* 2. Pencarian dan Filter Toolbar */}
      <Card className="border border-border shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari judul materi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="w-full sm:w-[220px]">
                <Select
                  value={courseFilter || 'ALL'}
                  onValueChange={(val) => setCourseFilter(val === 'ALL' ? '' : val)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Semua Mata Kuliah" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-[320px]">
                    <SelectItem value="ALL">Semua Mata Kuliah</SelectItem>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-[180px]">
                <Select
                  value={statusFilter || 'ALL'}
                  onValueChange={(val) => setStatusFilter(val === 'ALL' ? '' : val)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-[240px]">
                    <SelectItem value="ALL">Semua Status</SelectItem>
                    <SelectItem value="READY">Siap dipelajari</SelectItem>
                    <SelectItem value="PROCESSING">Membaca PDF</SelectItem>
                    <SelectItem value="QUEUED">Dalam antrean</SelectItem>
                    <SelectItem value="FAILED">Gagal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setCourseFilter('');
                    setStatusFilter('');
                  }}
                  className="h-11 px-3 text-xs text-muted-foreground hover:text-foreground shrink-0"
                >
                  Hapus filter
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Materials List / Status Views */}
      {isLoading ? (
        /* Loading Skeleton State */
        <div className="space-y-3" data-testid="materials-skeleton">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : errorMsg ? (
        /* Error State with Retry Button */
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Terjadi kesalahan saat memuat materi</AlertTitle>
          <AlertDescription className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span>{errorMsg}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData()}
              className="gap-1.5 w-fit"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Coba Lagi</span>
            </Button>
          </AlertDescription>
        </Alert>
      ) : materials.length === 0 ? (
        /* Empty State */
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 sm:p-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
            <Files className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            {hasFilter ? 'Tidak ada materi yang cocok' : 'Belum ada materi kuliah'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {hasFilter
              ? 'Coba atur ulang kata kunci pencarian atau sesuaikan filter mata kuliah dan status.'
              : 'Unggah berkas PDF kuliah Anda untuk mulai mengekstrak ringkasan, flashcard, dan kuis.'}
          </p>
          {!hasFilter && (
            <Button onClick={() => setIsUploadOpen(true)} className="mt-5 gap-2">
              <Plus className="h-4 w-4" />
              <span>Unggah materi pertama</span>
            </Button>
          )}
        </div>
      ) : (
        /* Data Loaded View: Desktop Table + Mobile Cards */
        <div className="space-y-4">
          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3.5">
                      Judul Materi
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Mata Kuliah
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Ukuran & Halaman
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Waktu Unggah
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-right">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {materials.map((m) => {
                    const sizeMb = (m.bytes / (1024 * 1024)).toFixed(1);
                    const canRetry =
                      m.status === 'FAILED' &&
                      m.errorCode !== 'SCANNED_PDF_NO_TEXT' &&
                      m.errorCode !== 'FILE_CORRUPTED' &&
                      m.errorCode !== 'EXCEEDS_PAGE_LIMIT' &&
                      m.errorCode !== 'FILE_ENCRYPTED' &&
                      m.errorCode !== 'FILE_TOO_LARGE';

                    return (
                      <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3.5">
                          <Link
                            href={`/materials/${m.id}`}
                            className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-2"
                            title={m.title}
                          >
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <span className="truncate max-w-[280px]">{m.title}</span>
                          </Link>
                          <p
                            className="text-xs text-muted-foreground truncate max-w-[280px] mt-0.5"
                            title={m.originalFilename}
                          >
                            {m.originalFilename}
                          </p>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {m.course ? (
                            <Link
                              href={`/courses/${m.course.id}`}
                              className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                              title={m.course.name}
                            >
                              <BookOpen className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate max-w-[160px]">{m.course.name}</span>
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                          <span>{sizeMb} MB</span>
                          {m.pageCount ? (
                            <span className="ml-1.5 text-foreground font-medium">
                              • {m.pageCount} hal.
                            </span>
                          ) : null}
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatUserDateTime(m.createdAt, timezone)}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <MaterialStatusBadge
                            status={m.status}
                            errorCode={m.errorCode}
                            errorMessage={m.errorMessage}
                          />
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canRetry && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => handleRetry(m.id, e)}
                                disabled={retryingId === m.id}
                                className="h-8 gap-1 text-xs"
                              >
                                {retryingId === m.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3 w-3" />
                                )}
                                <span>Coba lagi</span>
                              </Button>
                            )}

                            <Button variant="ghost" size="sm" asChild className="h-8 px-2.5 text-xs">
                              <Link href={`/materials/${m.id}`}>
                                <span>Buka</span>
                                <ExternalLink className="ml-1 h-3 w-3" />
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List (< 768px) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {materials.map((m) => {
              const sizeMb = (m.bytes / (1024 * 1024)).toFixed(1);
              const canRetry =
                m.status === 'FAILED' &&
                m.errorCode !== 'SCANNED_PDF_NO_TEXT' &&
                m.errorCode !== 'FILE_CORRUPTED' &&
                m.errorCode !== 'EXCEEDS_PAGE_LIMIT' &&
                m.errorCode !== 'FILE_ENCRYPTED' &&
                m.errorCode !== 'FILE_TOO_LARGE';

              return (
                <div
                  key={m.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/materials/${m.id}`}
                        className="font-medium text-foreground hover:text-primary transition-colors block text-sm truncate"
                        title={m.title}
                      >
                        {m.title}
                      </Link>
                      <p
                        className="text-xs text-muted-foreground truncate mt-0.5"
                        title={m.originalFilename}
                      >
                        {m.originalFilename}
                      </p>
                    </div>
                    <MaterialStatusBadge
                      status={m.status}
                      errorCode={m.errorCode}
                      errorMessage={m.errorMessage}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground border-t border-border/60 pt-2.5">
                    {m.course && (
                      <span className="flex items-center gap-1 text-foreground/80 font-medium truncate max-w-[150px]">
                        <BookOpen className="h-3 w-3 shrink-0" />
                        {m.course.name}
                      </span>
                    )}
                    <span>•</span>
                    <span>{sizeMb} MB</span>
                    {m.pageCount ? <span>• {m.pageCount} hal.</span> : null}
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatUserDateTime(m.createdAt, timezone)}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {canRetry && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleRetry(m.id, e)}
                        disabled={retryingId === m.id}
                        className="h-8 gap-1 text-xs"
                      >
                        {retryingId === m.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        <span>Coba lagi</span>
                      </Button>
                    )}

                    <Button variant="outline" size="sm" asChild className="h-8 px-3 text-xs">
                      <Link href={`/materials/${m.id}`}>
                        <span>Buka Materi</span>
                        <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Upload Dialog */}
      <MaterialUploadDialog
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        courses={courses}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
}
