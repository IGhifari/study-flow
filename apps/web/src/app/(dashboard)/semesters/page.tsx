'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarRange,
  Plus,
  CheckCircle2,
  Archive,
  RotateCcw,
  Pencil,
  Trash2,
  AlertCircle,
  Loader2,
  Layers,
} from 'lucide-react';
import { Semester, CreateSemesterInput, UpdateSemesterInput } from '@studyflow/shared';
import {
  listSemesters,
  createSemester,
  updateSemester,
  activateSemester,
  archiveSemester,
  unarchiveSemester,
  deleteSemester,
} from '@/lib/semester-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export default function SemestersPage(): React.JSX.Element {
  const router = useRouter();
  const [semesters, setSemesters] = React.useState<Semester[]>([]);
  const [activeSemester, setActiveSemester] = React.useState<Semester | null>(null);
  const [filter, setFilter] = React.useState<'all' | 'active' | 'archived'>('all');
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Modal Create
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [createName, setCreateName] = React.useState('');
  const [createYear, setCreateYear] = React.useState('');
  const [createMakeActive, setCreateMakeActive] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [isSubmittingCreate, setIsSubmittingCreate] = React.useState(false);

  // Modal Edit
  const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editYear, setEditYear] = React.useState('');
  const [editError, setEditError] = React.useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);

  // Modal Delete
  const [deletingSemester, setDeletingSemester] = React.useState<Semester | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = React.useState(false);

  const fetchSemesters = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await listSemesters(filter);
      setSemesters(data.semesters);
      setActiveSemester(data.activeSemester);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat data semester');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  React.useEffect(() => {
    fetchSemesters();
  }, [fetchSemesters]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!createName.trim()) {
      setCreateError('Nama semester wajib diisi');
      return;
    }
    if (!createYear.trim()) {
      setCreateError('Tahun ajaran wajib diisi (contoh: 2026/2027)');
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const input: CreateSemesterInput = {
        name: createName.trim(),
        academicYear: createYear.trim(),
        makeActive: createMakeActive,
      };
      await createSemester(input);
      setIsCreateOpen(false);
      setCreateName('');
      setCreateYear('');
      setCreateMakeActive(false);
      await fetchSemesters();
      router.refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Gagal membuat semester');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleOpenEdit = (sem: Semester) => {
    setEditingSemester(sem);
    setEditName(sem.name);
    setEditYear(sem.academicYear);
    setEditError(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSemester) return;
    setEditError(null);
    if (!editName.trim()) {
      setEditError('Nama semester wajib diisi');
      return;
    }
    if (!editYear.trim()) {
      setEditError('Tahun ajaran wajib diisi');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const input: UpdateSemesterInput = {
        name: editName.trim(),
        academicYear: editYear.trim(),
      };
      await updateSemester(editingSemester.id, input);
      setEditingSemester(null);
      await fetchSemesters();
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Gagal memperbarui semester');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleActivate = async (id: string) => {
    setErrorMsg(null);
    try {
      await activateSemester(id);
      await fetchSemesters();
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengaktifkan semester');
    }
  };

  const handleArchive = async (id: string) => {
    setErrorMsg(null);
    try {
      await archiveSemester(id);
      await fetchSemesters();
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengarsipkan semester');
    }
  };

  const handleUnarchive = async (id: string) => {
    setErrorMsg(null);
    try {
      await unarchiveSemester(id);
      await fetchSemesters();
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memulihkan semester');
    }
  };

  const handleDelete = async () => {
    if (!deletingSemester) return;
    setDeleteError(null);
    setIsSubmittingDelete(true);
    try {
      await deleteSemester(deletingSemester.id);
      setDeletingSemester(null);
      await fetchSemesters();
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Gagal menghapus semester');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Kelola Semester
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Atur periode perkuliahan, pilih semester yang sedang aktif, dan arsipkan semester lama.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreateError(null);
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center gap-2 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Semester</span>
        </Button>
      </div>

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger-foreground">
          <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-secondary text-secondary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          Semua ({semesters.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('active')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            filter === 'active'
              ? 'bg-secondary text-secondary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          Aktif
        </button>
        <button
          type="button"
          onClick={() => setFilter('archived')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            filter === 'archived'
              ? 'bg-secondary text-secondary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          Arsip
        </button>
      </div>

      {/* Content List / States */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="mt-3 text-sm">Memuat data semester...</p>
        </div>
      ) : semesters.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CalendarRange className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-foreground">
              {filter === 'all'
                ? 'Belum ada semester'
                : filter === 'active'
                ? 'Tidak ada semester aktif'
                : 'Tidak ada semester yang diarsipkan'}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {filter === 'all'
                ? 'Mulai dengan menambahkan semester pertama Anda untuk mengatur mata kuliah.'
                : 'Pilih semester untuk dijadikan aktif atau ubah filter.'}
            </p>
            {filter === 'all' && (
              <Button
                onClick={() => setIsCreateOpen(true)}
                variant="outline"
                className="mt-4 inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Semester Pertama</span>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {semesters.map((semester) => {
            const isArchived = Boolean(semester.archivedAt);
            return (
              <Card
                key={semester.id}
                className={`relative flex flex-col justify-between transition-shadow hover:shadow-md ${
                  semester.isActive ? 'border-primary ring-1 ring-primary/20' : ''
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base font-semibold text-foreground">
                        {semester.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Tahun Ajaran: {semester.academicYear}
                      </CardDescription>
                    </div>
                    {semester.isActive ? (
                      <Badge variant="default" className="shrink-0 bg-primary text-primary-foreground">
                        Aktif
                      </Badge>
                    ) : isArchived ? (
                      <Badge variant="secondary" className="shrink-0 text-muted-foreground">
                        Arsip
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Layers className="h-4 w-4" />
                    <span>
                      {typeof semester.courseCount === 'number'
                        ? `${semester.courseCount} Mata Kuliah`
                        : 'Mata kuliah terkait'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    {!isArchived && !semester.isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleActivate(semester.id)}
                        className="inline-flex items-center gap-1 text-xs"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        <span>Jadikan Aktif</span>
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenEdit(semester)}
                      className="inline-flex items-center gap-1 text-xs"
                      title="Edit semester"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </Button>

                    {isArchived ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUnarchive(semester.id)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        title="Pulihkan semester"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Pulihkan</span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleArchive(semester.id)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        title="Arsipkan semester"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        <span>Arsipkan</span>
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDeleteError(null);
                        setDeletingSemester(semester);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-danger hover:bg-danger/10"
                      title="Hapus semester"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Hapus</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Tambah Semester */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Tambah Semester Baru</DialogTitle>
              <DialogDescription>
                Masukkan nama dan tahun ajaran untuk semester perkuliahan Anda.
              </DialogDescription>
            </DialogHeader>

            {createError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger-foreground">
                <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
                <span>{createError}</span>
              </div>
            )}

            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="create-sem-name">Nama Semester</Label>
                <Input
                  id="create-sem-name"
                  placeholder="Contoh: Semester Ganjil 2026/2027"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  disabled={isSubmittingCreate}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-sem-year">Tahun Ajaran</Label>
                <Input
                  id="create-sem-year"
                  placeholder="Contoh: 2026/2027"
                  value={createYear}
                  onChange={(e) => setCreateYear(e.target.value)}
                  disabled={isSubmittingCreate}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="create-sem-active"
                  checked={createMakeActive}
                  onChange={(e) => setCreateMakeActive(e.target.checked)}
                  disabled={isSubmittingCreate}
                  className="h-4 w-4 rounded-sm border-input text-primary focus:ring-primary"
                />
                <Label htmlFor="create-sem-active" className="cursor-pointer text-xs font-normal">
                  Jadikan semester aktif saat ini
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmittingCreate}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmittingCreate}>
                {isSubmittingCreate ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  'Simpan Semester'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Edit Semester */}
      <Dialog
        open={Boolean(editingSemester)}
        onOpenChange={(open) => !open && setEditingSemester(null)}
      >
        <DialogContent>
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>Edit Semester</DialogTitle>
              <DialogDescription>
                Perbarui nama dan tahun ajaran untuk semester ini.
              </DialogDescription>
            </DialogHeader>

            {editError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger-foreground">
                <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
                <span>{editError}</span>
              </div>
            )}

            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-sem-name">Nama Semester</Label>
                <Input
                  id="edit-sem-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={isSubmittingEdit}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-sem-year">Tahun Ajaran</Label>
                <Input
                  id="edit-sem-year"
                  value={editYear}
                  onChange={(e) => setEditYear(e.target.value)}
                  disabled={isSubmittingEdit}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingSemester(null)}
                disabled={isSubmittingEdit}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmittingEdit}>
                {isSubmittingEdit ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memperbarui...
                  </>
                ) : (
                  'Simpan Perubahan'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Konfirmasi Hapus Semester */}
      <Dialog
        open={Boolean(deletingSemester)}
        onOpenChange={(open) => !open && setDeletingSemester(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Semester</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus semester{' '}
              <strong className="text-foreground">{deletingSemester?.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          {deleteError ? (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger-foreground">
              <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
              <span>{deleteError}</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-2">
              Semester hanya dapat dihapus jika tidak memiliki mata kuliah di dalamnya. Jika masih ada mata kuliah, Anda dapat mengarsipkannya sebagai gantinya.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingSemester(null)}
              disabled={isSubmittingDelete}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmittingDelete}
            >
              {isSubmittingDelete ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                'Hapus Semester'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
