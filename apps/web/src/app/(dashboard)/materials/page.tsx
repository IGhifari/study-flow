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
  MoreVertical,
  Download,
  Trash2,
  Pin,
} from 'lucide-react';
import {
  MaterialListItem,
  Course,
  Semester,
  formatUserDateTime,
  UserProfile,
} from '@studyflow/shared';
import {
  listMaterials,
  retryMaterialProcessing,
  deleteMaterial,
  getMaterialDownloadUrl,
} from '@/lib/material-client';
import { pinMaterial } from '@/lib/pin-client';
import { listCourses } from '@/lib/course-client';
import { listSemesters } from '@/lib/semester-client';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { MaterialUploadDialog } from '@/components/materials/material-upload-dialog';
import { MaterialStatusBadge } from '@/components/materials/material-status-badge';

export default function MaterialsPage(): React.JSX.Element {
  const [materials, setMaterials] = React.useState<MaterialListItem[]>([]);
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [activeSemester, setActiveSemester] = React.useState<Semester | null>(null);
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [courseFilter, setCourseFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');

  const [isUploadOpen, setIsUploadOpen] = React.useState(false);
  const [retryingId, setRetryingId] = React.useState<string | null>(null);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<MaterialListItem | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [pinningId, setPinningId] = React.useState<string | null>(null);

  const timezone = userProfile?.timezone || 'Asia/Jakarta';

  // Fetch initial data
  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [profile, courseRes, semesterRes, materialRes] = await Promise.all([
        getProfile().catch(() => null),
        listCourses({ isArchived: false }).catch(() => ({ courses: [] })),
        listSemesters().catch(() => ({ semesters: [], activeSemester: null, activeSemesterId: null })),
        listMaterials({
          search: search.trim() || undefined,
          courseId: courseFilter || undefined,
          status: (statusFilter as any) || undefined,
        }),
      ]);

      if (profile) setUserProfile(profile);
      setCourses(courseRes.courses);
      if (semesterRes?.activeSemester) setActiveSemester(semesterRes.activeSemester);
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

  // Polling for any active materials (QUEUED, PROCESSING, or UPLOADING)
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

  const handleRetry = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
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

  const handleDownload = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setDownloadingId(id);
    try {
      const data = await getMaterialDownloadUrl(id);
      if (data?.downloadUrl) {
        window.open(data.downloadUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mendapatkan tautan unduhan.');
    } finally {
      setDownloadingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteMaterial(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus materi.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTogglePin = async (material: MaterialListItem) => {
    if (pinningId === material.id) return;
    const nextPinned = !material.isPinned;
    setPinningId(material.id);

    // Optimistic update
    setMaterials((prev) =>
      prev.map((m) => (m.id === material.id ? { ...m, isPinned: nextPinned } : m))
    );

    try {
      await pinMaterial(material.id, nextPinned);
    } catch (err: any) {
      // Rollback on failure
      setMaterials((prev) =>
        prev.map((m) => (m.id === material.id ? { ...m, isPinned: material.isPinned } : m))
      );
      setErrorMsg(err.message || 'Gagal memperbarui status sematan materi');
    } finally {
      setPinningId(null);
    }
  };

  const hasFilter = Boolean(search || courseFilter || statusFilter);

  const resetFilters = () => {
    setSearch('');
    setCourseFilter('');
    setStatusFilter('');
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. Header Halaman */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3.5 sm:pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-3xl">
            Materi
          </h1>
          <div className="mt-0.5 sm:mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-muted-foreground">
            {activeSemester ? (
              <>
                <span className="font-medium text-foreground">
                  {activeSemester.name.toLowerCase().includes(activeSemester.academicYear.toLowerCase())
                    ? activeSemester.name
                    : `${activeSemester.name} (${activeSemester.academicYear})`}
                </span>
                <span>•</span>
              </>
            ) : null}
            <span>{materials.length} berkas materi</span>
          </div>
        </div>

        <Button
          onClick={() => setIsUploadOpen(true)}
          size="standard"
          className="gap-1.5 shrink-0 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Unggah materi</span>
        </Button>
      </div>

      {/* 2. Pencarian dan Filter Toolbar */}
      <Card className="border border-border bg-card shadow-xs">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            {/* Input Pencarian */}
            <div className="relative flex-1 min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari judul materi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-9 text-xs sm:text-sm"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-full sm:w-[200px]">
                <Select
                  value={courseFilter || 'ALL'}
                  onValueChange={(val) => setCourseFilter(val === 'ALL' ? '' : val)}
                >
                  <SelectTrigger className="h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Semua Mata Kuliah" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-[300px]">
                    <SelectItem value="ALL">Semua Mata Kuliah</SelectItem>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-[170px]">
                <Select
                  value={statusFilter || 'ALL'}
                  onValueChange={(val) => setStatusFilter(val === 'ALL' ? '' : val)}
                >
                  <SelectTrigger className="h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-[220px]">
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
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="h-9 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Hapus filter</span>
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
          <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="border-b border-border bg-muted/40 px-4 py-3">
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="divide-y divide-border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-8 w-16" />
              </div>
              <div className="flex items-center justify-between pt-4">
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-8 w-16" />
              </div>
              <div className="flex items-center justify-between pt-4">
                <Skeleton className="h-5 w-72" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:hidden">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        </div>
      ) : errorMsg ? (
        /* Error State with Retry Button */
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Terjadi kesalahan saat memuat materi</AlertTitle>
          <AlertDescription className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <span>{errorMsg}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData()}
              className="gap-1.5 w-fit h-8"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Coba Lagi</span>
            </Button>
          </AlertDescription>
        </Alert>
      ) : materials.length === 0 ? (
        /* Empty State */
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 sm:p-12 text-center max-w-lg mx-auto">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
            <Files className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            {hasFilter ? 'Tidak ada materi yang cocok' : 'Belum ada materi kuliah'}
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {hasFilter
              ? 'Coba atur ulang kata kunci pencarian atau bersihkan filter mata kuliah dan status.'
              : 'Unggah berkas PDF materi kuliah untuk mulai membaca ringkasan AI, flashcard, dan kuis otomatis.'}
          </p>
          {hasFilter ? (
            <Button onClick={resetFilters} variant="outline" size="standard" className="mt-4 gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Hapus Filter</span>
            </Button>
          ) : (
            <Button onClick={() => setIsUploadOpen(true)} size="standard" className="mt-4 gap-1.5">
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
                    <th scope="col" className="px-4 py-3">
                      Judul Materi
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Mata Kuliah
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Ukuran & Halaman
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Waktu Unggah
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Status
                    </th>
                    <th scope="col" className="w-28 px-3.5 py-3 text-right">
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
                        <td className="px-4 py-3">
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Link
                                  href={`/materials/${m.id}`}
                                  className="font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-2 max-w-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                                  title={m.title}
                                  aria-label={`Buka materi: ${m.title}`}
                                >
                                  <FileText className="h-4 w-4 text-primary shrink-0" />
                                  <span className="truncate max-w-[240px] lg:max-w-[340px]">{m.title}</span>
                                  {m.isPinned && (
                                    <span title="Disematkan" aria-label="Disematkan" className="inline-flex text-primary shrink-0">
                                      <Pin className="h-3.5 w-3.5 fill-current" />
                                    </span>
                                  )}
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="start" className="max-w-xs break-words">
                                <p className="font-semibold">{m.title}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{m.originalFilename}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <p
                            className="text-xs text-muted-foreground truncate max-w-[240px] lg:max-w-[340px] mt-0.5"
                            title={m.originalFilename}
                          >
                            {m.originalFilename}
                          </p>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          {m.course ? (
                            <Link
                              href={`/courses/${m.course.id}`}
                              className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                              title={m.course.name}
                            >
                              <BookOpen className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate max-w-[150px]">{m.course.name}</span>
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                          <span>{sizeMb} MB</span>
                          {m.pageCount ? (
                            <span className="ml-1.5 text-foreground font-medium">
                              • {m.pageCount} hal.
                            </span>
                          ) : null}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatUserDateTime(m.createdAt, timezone)}
                          </span>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <MaterialStatusBadge
                            status={m.status}
                            errorCode={m.errorCode}
                            errorMessage={m.errorMessage}
                          />
                        </td>

                        <td className="w-28 px-3.5 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-xs">
                              <Link href={`/materials/${m.id}`}>
                                <span>Buka</span>
                                <ExternalLink className="ml-1 h-3 w-3" />
                              </Link>
                            </Button>

                            {/* Menu Aksi Sekunder */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                                  aria-label={`Menu aksi materi ${m.title}`}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem asChild>
                                  <Link href={`/materials/${m.id}`} className="cursor-pointer text-xs">
                                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                    <span>Buka Materi</span>
                                  </Link>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => handleTogglePin(m)}
                                  disabled={pinningId === m.id}
                                  className="cursor-pointer text-xs"
                                >
                                  {pinningId === m.id ? (
                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Pin className={`mr-2 h-3.5 w-3.5 ${m.isPinned ? 'fill-primary text-primary' : ''}`} />
                                  )}
                                  <span>{m.isPinned ? 'Lepas Sematan' : 'Sematkan'}</span>
                                </DropdownMenuItem>

                                {canRetry && (
                                  <DropdownMenuItem
                                    onClick={() => handleRetry(m.id)}
                                    disabled={retryingId === m.id}
                                    className="cursor-pointer text-xs"
                                  >
                                    {retryingId === m.id ? (
                                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <RotateCcw className="mr-2 h-3.5 w-3.5" />
                                    )}
                                    <span>Coba Lagi Pemrosesan</span>
                                  </DropdownMenuItem>
                                )}

                                {m.status === 'READY' && (
                                  <DropdownMenuItem
                                    onClick={() => handleDownload(m.id)}
                                    disabled={downloadingId === m.id}
                                    className="cursor-pointer text-xs"
                                  >
                                    {downloadingId === m.id ? (
                                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Download className="mr-2 h-3.5 w-3.5" />
                                    )}
                                    <span>Unduh Berkas Asli</span>
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                  onClick={() => setDeleteTarget(m)}
                                  className="cursor-pointer text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                                  <span>Hapus Materi</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
          <div className="grid grid-cols-1 gap-2.5 md:hidden">
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
                  className="rounded-xl border border-border bg-card p-3.5 shadow-xs space-y-2.5"
                >
                  {/* Judul & Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/materials/${m.id}`}
                        className="font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 text-sm break-words"
                        title={m.title}
                        aria-label={`Buka materi: ${m.title}`}
                      >
                        <span>{m.title}</span>
                        {m.isPinned && (
                          <span title="Disematkan" aria-label="Disematkan" className="inline-flex text-primary shrink-0">
                            <Pin className="h-3 w-3 fill-current" />
                          </span>
                        )}
                      </Link>
                      <p
                        className="text-xs text-muted-foreground break-all mt-0.5"
                        title={m.originalFilename}
                      >
                        {m.originalFilename}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <MaterialStatusBadge
                        status={m.status}
                        errorCode={m.errorCode}
                        errorMessage={m.errorMessage}
                      />
                    </div>
                  </div>

                  {/* Metadata Baris */}
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground border-t border-border/60 pt-2">
                    {m.course && (
                      <span className="flex items-center gap-1 text-foreground/80 font-medium truncate max-w-[140px]">
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

                  {/* Aksi Mobile: Touch Target minimal 44x44px tanpa overlap */}
                  <div className="flex items-center justify-end gap-3.5 pt-1 border-t border-border/40">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-8 px-3 text-xs relative before:absolute before:-inset-y-1.5 before:inset-x-0"
                    >
                      <Link href={`/materials/${m.id}`}>
                        <span>Buka Materi</span>
                        <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground relative before:absolute before:-inset-1.5"
                          aria-label={`Menu aksi materi ${m.title}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem asChild>
                          <Link href={`/materials/${m.id}`} className="cursor-pointer text-xs">
                            <ExternalLink className="mr-2 h-3.5 w-3.5" />
                            <span>Buka Materi</span>
                          </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => handleTogglePin(m)}
                          disabled={pinningId === m.id}
                          className="cursor-pointer text-xs"
                        >
                          {pinningId === m.id ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Pin className={`mr-2 h-3.5 w-3.5 ${m.isPinned ? 'fill-primary text-primary' : ''}`} />
                          )}
                          <span>{m.isPinned ? 'Lepas Sematan' : 'Sematkan'}</span>
                        </DropdownMenuItem>

                        {canRetry && (
                          <DropdownMenuItem
                            onClick={() => handleRetry(m.id)}
                            disabled={retryingId === m.id}
                            className="cursor-pointer text-xs"
                          >
                            {retryingId === m.id ? (
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="mr-2 h-3.5 w-3.5" />
                            )}
                            <span>Coba Lagi Pemrosesan</span>
                          </DropdownMenuItem>
                        )}

                        {m.status === 'READY' && (
                          <DropdownMenuItem
                            onClick={() => handleDownload(m.id)}
                            disabled={downloadingId === m.id}
                            className="cursor-pointer text-xs"
                          >
                            {downloadingId === m.id ? (
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="mr-2 h-3.5 w-3.5" />
                            )}
                            <span>Unduh Berkas Asli</span>
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          onClick={() => setDeleteTarget(m)}
                          className="cursor-pointer text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          <span>Hapus Materi</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

      {/* 5. Konfirmasi Hapus Dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(val) => !val && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[420px] p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Hapus Materi Kuliah?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1.5">
              Materi <span className="font-semibold text-foreground">&ldquo;{deleteTarget?.title}&rdquo;</span>{' '}
              beserta seluruh hasil ringkasan, flashcard, dan kuis yang terkait akan dihapus secara
              permanen. Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="standard"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="standard"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                'Hapus Materi'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
