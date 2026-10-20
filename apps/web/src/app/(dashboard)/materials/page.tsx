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
  ChevronLeft,
  ChevronRight,
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { FadeIn, StaggerGroup, StaggerItem } from '@/components/ui/motion';
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

export interface MaterialPaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function MaterialsPage(): React.JSX.Element {
  const [materials, setMaterials] = React.useState<MaterialListItem[]>([]);
  const [pagination, setPagination] = React.useState<MaterialPaginationInfo | null>(null);
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [activeSemester, setActiveSemester] = React.useState<Semester | null>(null);
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);

  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Search & Filter State
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [courseFilter, setCourseFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [page, setPage] = React.useState(1);

  // Dialogs & Actions State
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);
  const [retryingId, setRetryingId] = React.useState<string | null>(null);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<MaterialListItem | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [pinningId, setPinningId] = React.useState<string | null>(null);

  const timezone = userProfile?.timezone || 'Asia/Jakarta';

  // Race condition & lifecycle guards
  const fetchRequestIdRef = React.useRef(0);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 1. Debounce search input by ~300ms
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch((prev) => {
        if (prev !== search) {
          setPage(1);
          return search;
        }
        return prev;
      });
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  // 2. Fetch metadata (Profile, Courses, Active Semester) independently
  const loadMetadata = React.useCallback(async () => {
    try {
      const [profile, courseRes, semesterRes] = await Promise.all([
        getProfile().catch(() => null),
        listCourses({ isArchived: false }).catch(() => ({ courses: [] })),
        listSemesters().catch(() => ({ semesters: [], activeSemester: null, activeSemesterId: null })),
      ]);

      if (!isMountedRef.current) return;
      if (profile) setUserProfile(profile);
      if (courseRes?.courses) setCourses(courseRes.courses);
      if (semesterRes?.activeSemester) setActiveSemester(semesterRes.activeSemester);
    } catch (err: unknown) {
      console.error('Failed to load materials metadata:', err);
    }
  }, []);

  // 3. Fetch materials data with sequence counter & abort signal
  const fetchMaterialsData = React.useCallback(async () => {
    // Abort previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const requestId = ++fetchRequestIdRef.current;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await listMaterials(
        {
          search: debouncedSearch.trim() || undefined,
          courseId: courseFilter || undefined,
          status: (statusFilter as any) || undefined,
          page,
          limit: 20,
        },
        { signal: controller.signal }
      );

      // Only apply state update if this request is still the latest and component is mounted
      if (isMountedRef.current && requestId === fetchRequestIdRef.current) {
        setMaterials(res.materials);
        setPagination(res.pagination);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Ignored: request was superseded by a newer query or unmount
        return;
      }
      if (isMountedRef.current && requestId === fetchRequestIdRef.current) {
        console.error('Failed to load materials:', err);
        const message = err instanceof Error ? err.message : 'Gagal memuat daftar materi kuliah.';
        setErrorMsg(message);
      }
    } finally {
      if (isMountedRef.current && requestId === fetchRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [debouncedSearch, courseFilter, statusFilter, page]);

  const fetchMaterialsDataRef = React.useRef(fetchMaterialsData);
  React.useEffect(() => {
    fetchMaterialsDataRef.current = fetchMaterialsData;
  }, [fetchMaterialsData]);

  // Mount effect: load metadata once and listen for semester changes
  React.useEffect(() => {
    loadMetadata();

    const handleSemesterChange = () => {
      loadMetadata();
      fetchMaterialsDataRef.current();
    };
    window.addEventListener('studyflow:semester-changed', handleSemesterChange);

    return () => {
      window.removeEventListener('studyflow:semester-changed', handleSemesterChange);
    };
  }, [loadMetadata]);

  // Query effect: fetch materials whenever debounced search, filters, or page change
  React.useEffect(() => {
    fetchMaterialsData();
  }, [fetchMaterialsData]);

  // Polling for active background jobs (QUEUED, PROCESSING, UPLOADING)
  React.useEffect(() => {
    const hasActiveJobs = materials.some(
      (m) => m.status === 'QUEUED' || m.status === 'PROCESSING' || m.status === 'UPLOADING'
    );

    if (!hasActiveJobs) return;

    let pollInterval = 5000;
    let timer: NodeJS.Timeout;

    const poll = async () => {
      if (document.hidden || !isMountedRef.current) return;

      try {
        const res = await listMaterials({
          search: debouncedSearch.trim() || undefined,
          courseId: courseFilter || undefined,
          status: (statusFilter as any) || undefined,
          page,
          limit: 20,
        });
        if (isMountedRef.current) {
          setMaterials(res.materials);
          setPagination(res.pagination);
        }
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
  }, [materials, debouncedSearch, courseFilter, statusFilter, page]);

  const handleRetry = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setRetryingId(id);
    try {
      await retryMaterialProcessing(id);
      if (!isMountedRef.current) return;
      await fetchMaterialsData();
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Gagal mengulang pemrosesan';
      setErrorMsg(message);
    } finally {
      if (isMountedRef.current) {
        setRetryingId(null);
      }
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
      if (!isMountedRef.current) return;
      if (data?.downloadUrl) {
        window.open(data.downloadUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Gagal mendapatkan tautan unduhan.';
      setErrorMsg(message);
    } finally {
      if (isMountedRef.current) {
        setDownloadingId(null);
      }
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteMaterial(deleteTarget.id);
      if (!isMountedRef.current) return;
      setDeleteTarget(null);
      await fetchMaterialsData();
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Gagal menghapus materi.';
      setErrorMsg(message);
    } finally {
      if (isMountedRef.current) {
        setIsDeleting(false);
      }
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
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      // Rollback on failure
      setMaterials((prev) =>
        prev.map((m) => (m.id === material.id ? { ...m, isPinned: material.isPinned } : m))
      );
      const message = err instanceof Error ? err.message : 'Gagal memperbarui status sematan materi';
      setErrorMsg(message);
    } finally {
      if (isMountedRef.current) {
        setPinningId(null);
      }
    }
  };

  const handleCourseFilterChange = (val: string) => {
    setCourseFilter(val === 'ALL' ? '' : val);
    setPage(1);
  };

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val === 'ALL' ? '' : val);
    setPage(1);
  };

  const hasFilter = Boolean(search || courseFilter || statusFilter || page > 1);

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setCourseFilter('');
    setStatusFilter('');
    setPage(1);
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
            <span>{pagination ? pagination.total : materials.length} berkas materi</span>
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
                  onValueChange={handleCourseFilterChange}
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
                  onValueChange={handleStatusFilterChange}
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
              onClick={() => fetchMaterialsData()}
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
          <FadeIn className="hidden md:block">
            <Card className="overflow-hidden shadow-xs">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">
                      Judul Materi
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Mata Kuliah
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Ukuran & Halaman
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Waktu Unggah
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Status
                    </TableHead>
                    <TableHead className="w-28 text-right text-xs font-semibold">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
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
                      <TableRow key={m.id}>
                        <TableCell className="py-3">
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
                                <p className="text-xs text-muted-foreground mt-0.5">{m.originalFilename}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <p
                            className="text-xs text-muted-foreground truncate max-w-[240px] lg:max-w-[340px] mt-0.5"
                            title={m.originalFilename}
                          >
                            {m.originalFilename}
                          </p>
                        </TableCell>

                        <TableCell className="py-3 whitespace-nowrap">
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
                        </TableCell>

                        <TableCell className="py-3 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                          <span>{sizeMb} MB</span>
                          {m.pageCount ? (
                            <span className="ml-1.5 text-foreground font-medium tabular-nums">
                              • {m.pageCount} hal.
                            </span>
                          ) : null}
                        </TableCell>

                        <TableCell className="py-3 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 shrink-0" />
                            {formatUserDateTime(m.createdAt, timezone)}
                          </span>
                        </TableCell>

                        <TableCell className="py-3 whitespace-nowrap">
                          <MaterialStatusBadge
                            status={m.status}
                            errorCode={m.errorCode}
                            errorMessage={m.errorMessage}
                          />
                        </TableCell>

                        <TableCell className="w-28 py-3 whitespace-nowrap text-right">
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </FadeIn>

          {/* Mobile Card List (< 768px) */}
          <StaggerGroup className="grid grid-cols-1 gap-2.5 md:hidden">
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
                <StaggerItem key={m.id}>
                  <Card className="p-3.5 shadow-xs space-y-2.5">
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
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground border-t border-border/60 pt-2 tabular-nums">
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
                        <Clock className="h-3 w-3 shrink-0" />
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
                  </Card>
                </StaggerItem>
              );
            })}
          </StaggerGroup>

          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && (
            <div
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-border px-4 py-3 bg-card shadow-xs text-xs text-muted-foreground tabular-nums"
              data-testid="materials-pagination"
            >
              <div>
                Menampilkan{' '}
                <span className="font-semibold text-foreground">
                  {materials.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
                </span>{' '}
                hingga{' '}
                <span className="font-semibold text-foreground">
                  {materials.length > 0 ? Math.min(pagination.page * pagination.limit, pagination.total) : 0}
                </span>{' '}
                dari{' '}
                <span className="font-semibold text-foreground">
                  {pagination.total.toLocaleString('id-ID')}
                </span>{' '}
                berkas materi
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1 || isLoading}
                  className="h-8 px-2.5 gap-1 text-xs"
                  aria-label="Halaman sebelumnya"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Sebelumnya</span>
                </Button>
                <span className="px-2 font-medium text-foreground tabular-nums">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page >= pagination.totalPages || isLoading}
                  className="h-8 px-2.5 gap-1 text-xs"
                  aria-label="Halaman berikutnya"
                >
                  <span>Berikutnya</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Upload Dialog */}
      <MaterialUploadDialog
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        courses={courses}
        onSuccess={() => {
          fetchMaterialsData();
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
