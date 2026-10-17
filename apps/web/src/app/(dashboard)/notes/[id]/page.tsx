'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CalendarClock,
  Clock,
  AlertCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Heading1,
  Heading2,
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Link2,
  Minus,
  ExternalLink,
  Save,
  Edit3,
  Eye,
  Columns2,
  FileText,
  Pin,
} from 'lucide-react';
import { Note, formatUserDateTime, UserProfile, MaterialListItem } from '@studyflow/shared';
import { getNote, updateNote } from '@/lib/note-client';
import { pinNote } from '@/lib/pin-client';
import { listMaterials } from '@/lib/material-client';
import { getProfile } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  RadixSelect as Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FadeIn, AnimatedPanel } from '@/components/ui/motion';
import { SafeMarkdownRenderer } from '@/components/notes/markdown-renderer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

type SaveStatus = 'SAVED' | 'DIRTY' | 'SAVING' | 'ERROR';

export default function NoteDetailPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const noteId = params.id as string;

  const [note, setNote] = React.useState<Note | null>(null);
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Editor states
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [materialId, setMaterialId] = React.useState<string | null>(null);
  const [courseMaterials, setCourseMaterials] = React.useState<MaterialListItem[]>([]);
  const [activeTab, setActiveTab] = React.useState<string>('write');

  // Track save state & concurrency
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('SAVED');
  const [lastSaved, setLastSaved] = React.useState<{
    title: string;
    content: string;
    materialId: string | null;
  }>({ title: '', content: '', materialId: null });
  const [lastSavedTime, setLastSavedTime] = React.useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = React.useState<string | null>(null);
  const [versionConflict, setVersionConflict] = React.useState<{
    currentVersion: number;
    message: string;
  } | null>(null);
  const [isPinning, setIsPinning] = React.useState(false);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Live refs to guarantee access to the latest edits without stale closures
  const titleRef = React.useRef(title);
  titleRef.current = title;
  const contentRef = React.useRef(content);
  contentRef.current = content;
  const materialIdRef = React.useRef(materialId);
  materialIdRef.current = materialId;

  // Unsaved changes navigation guard state
  const isNavigatingRef = React.useRef(false);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [pendingNavigation, setPendingNavigation] = React.useState<string | 'BACK' | null>(null);
  const [isSavingAndLeaving, setIsSavingAndLeaving] = React.useState(false);

  const timezone = userProfile?.timezone || 'Asia/Jakarta';

  // Load Note
  React.useEffect(() => {
    let isMounted = true;
    async function fetchNote() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [profile, fetchedNote] = await Promise.all([
          getProfile().catch(() => null),
          getNote(noteId),
        ]);
        if (!isMounted) return;
        if (profile) setUserProfile(profile);
        setNote(fetchedNote);
        setTitle(fetchedNote.title);
        setContent(fetchedNote.content || '');
        setMaterialId(fetchedNote.materialId || null);
        setLastSaved({
          title: fetchedNote.title,
          content: fetchedNote.content || '',
          materialId: fetchedNote.materialId || null,
        });

        if (fetchedNote.updatedAt) {
          const d = new Date(fetchedNote.updatedAt);
          setLastSavedTime(
            d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          );
        }

        if (fetchedNote.courseId) {
          try {
            const matRes = await listMaterials({ courseId: fetchedNote.courseId, limit: 100 });
            if (isMounted) setCourseMaterials(matRes.materials);
          } catch (mErr) {
            console.error('Failed to load course materials:', mErr);
          }
        }

        setSaveStatus('SAVED');
      } catch (err: any) {
        if (isMounted) setLoadError(err.message || 'Gagal memuat catatan.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (noteId) {
      fetchNote();
    }
    return () => {
      isMounted = false;
    };
  }, [noteId]);

  // Track unsaved changes
  const hasUnsavedChanges = React.useMemo(() => {
    return (
      title !== lastSaved.title ||
      content !== lastSaved.content ||
      materialId !== lastSaved.materialId
    );
  }, [title, content, materialId, lastSaved]);

  React.useEffect(() => {
    if (saveStatus === 'SAVING') return;
    if (hasUnsavedChanges) {
      setSaveStatus('DIRTY');
    }
  }, [hasUnsavedChanges, saveStatus]);

  // Warn before leaving page (browser reload or close)
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Insert markdown helper at cursor
  const insertFormatting = (prefix: string, suffix: string = '', placeholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end) || placeholder;

    const replacement = `${prefix}${selected}${suffix}`;
    const nextContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(nextContent);

    // Reposition cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selected.length
      );
    }, 0);
  };

  const isArchived = Boolean(note?.course?.archivedAt || note?.course?.semester?.archivedAt);

  // Note stats (word count, char count, read time)
  const stats = React.useMemo(() => {
    const trimmed = content.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = content.length;
    const readTimeMinutes = Math.max(1, Math.ceil(words / 200));
    return { words, chars, readTimeMinutes };
  }, [content]);

  // Perform Save
  const handleSave = React.useCallback(async (overrideVersion?: number): Promise<{ success: boolean; stillDirty: boolean }> => {
    if (!note) return { success: false, stillDirty: false };
    const currentTitle = titleRef.current;
    if (!currentTitle.trim()) {
      setSaveErrorMessage('Judul catatan wajib diisi.');
      setSaveStatus('ERROR');
      return { success: false, stillDirty: true };
    }

    setSaveStatus('SAVING');
    setSaveErrorMessage(null);
    setVersionConflict(null);

    const snapshotBeingSaved = {
      title: titleRef.current,
      content: contentRef.current,
      materialId: materialIdRef.current,
    };

    try {
      const targetVersion = overrideVersion ?? note.version;
      const updated = await updateNote(note.id, {
        title: snapshotBeingSaved.title.trim(),
        content: snapshotBeingSaved.content,
        materialId: snapshotBeingSaved.materialId,
        version: targetVersion,
      });

      // Update current note metadata (including new version)
      setNote(updated);
      setLastSaved(snapshotBeingSaved);

      const now = new Date();
      setLastSavedTime(
        now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      );

      // Check if user continued typing while saving was in-flight
      const stillHasChanges =
        titleRef.current !== snapshotBeingSaved.title ||
        contentRef.current !== snapshotBeingSaved.content ||
        materialIdRef.current !== snapshotBeingSaved.materialId;

      if (stillHasChanges) {
        setSaveStatus('DIRTY');
      } else {
        setSaveStatus('SAVED');
      }
      return { success: true, stillDirty: stillHasChanges };
    } catch (err: any) {
      if (err.code === 'NOTE_VERSION_CONFLICT') {
        setVersionConflict({
          currentVersion: err.currentVersion || note.version + 1,
          message:
            'Catatan ini telah diperbarui di sesi atau tab lain. Perubahan lokal Anda tidak ditimpa secara otomatis.',
        });
      }
      setSaveErrorMessage(err.message || 'Gagal menyimpan catatan.');
      setSaveStatus('ERROR');
      return { success: false, stillDirty: true };
    }
  }, [note]);

  // Keyboard shortcut: Ctrl+S / Cmd+S to save
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (saveStatus !== 'SAVING' && !isArchived) {
          void handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [saveStatus, isArchived, handleSave]);

  // Intercept internal link clicks when unsaved changes exist
  React.useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      if (isNavigatingRef.current) return;
      if (!hasUnsavedChanges) return;

      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      if (href.startsWith('#') || href.startsWith('javascript:') || anchor.target === '_blank') {
        return;
      }

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) {
        return;
      }

      const currentFull = window.location.pathname + window.location.search;
      const targetFull = url.pathname + url.search;
      if (targetFull === currentFull) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      setPendingNavigation(targetFull);
      setIsConfirmOpen(true);
    };

    document.addEventListener('click', handleAnchorClick, true);
    return () => {
      document.removeEventListener('click', handleAnchorClick, true);
    };
  }, [hasUnsavedChanges]);

  // Keep ref updated for popstate handler to avoid stale closures
  const hasUnsavedChangesRef = React.useRef(false);
  hasUnsavedChangesRef.current = hasUnsavedChanges;
  const sentinelPushedRef = React.useRef(false);

  // Push sentinel history state ONCE when transitioning to dirty
  React.useEffect(() => {
    if (hasUnsavedChanges && !sentinelPushedRef.current && !isNavigatingRef.current) {
      window.history.pushState({ noteEditorGuard: true }, '', window.location.href);
      sentinelPushedRef.current = true;
    }
  }, [hasUnsavedChanges]);

  // Listen to popstate (Browser Back/Forward) with anti-loop protection and proper cleanup
  React.useEffect(() => {
    const handlePopState = () => {
      if (isNavigatingRef.current) return;

      if (hasUnsavedChangesRef.current) {
        // Browser already popped the sentinel on Back. Re-push sentinel so URL stays on editor.
        window.history.pushState({ noteEditorGuard: true }, '', window.location.href);
        sentinelPushedRef.current = true;

        setPendingNavigation('BACK');
        setIsConfirmOpen(true);
      } else {
        sentinelPushedRef.current = false;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleStayAndEdit = () => {
    setIsConfirmOpen(false);
    setPendingNavigation(null);
  };

  const handleDiscardAndLeave = () => {
    isNavigatingRef.current = true;
    setIsConfirmOpen(false);
    const nav = pendingNavigation;
    setPendingNavigation(null);
    if (nav === 'BACK') {
      sentinelPushedRef.current = false;
      window.history.go(-2);
    } else if (typeof nav === 'string') {
      router.push(nav);
    }
  };

  const handleSaveAndLeave = async () => {
    setIsSavingAndLeaving(true);
    const result = await handleSave();
    setIsSavingAndLeaving(false);

    // If save succeeded but user typed new edits while save was in-flight, do NOT leave!
    if (result.success && result.stillDirty) {
      setIsConfirmOpen(false);
      setPendingNavigation(null);
      setSaveErrorMessage(
        'Ada perubahan baru yang diketik saat proses simpan. Simpan kembali sebelum berpindah.'
      );
      return;
    }

    if (result.success) {
      isNavigatingRef.current = true;
      setIsConfirmOpen(false);
      const nav = pendingNavigation;
      setPendingNavigation(null);
      if (nav === 'BACK') {
        sentinelPushedRef.current = false;
        window.history.go(-2);
      } else if (typeof nav === 'string') {
        router.push(nav);
      }
    } else {
      // Failed to save (HTTP 500, network error, or conflict): stay in editor, keep user edits intact!
      setIsConfirmOpen(false);
      setPendingNavigation(null);
    }
  };

  // Resolve Conflict: Reload from server
  const handleReloadServerVersion = async () => {
    try {
      const fresh = await getNote(noteId);
      setNote(fresh);
      setTitle(fresh.title);
      setContent(fresh.content || '');
      setMaterialId(fresh.materialId || null);
      setLastSaved({
        title: fresh.title,
        content: fresh.content || '',
        materialId: fresh.materialId || null,
      });
      setVersionConflict(null);
      setSaveStatus('SAVED');
    } catch (err: any) {
      setSaveErrorMessage(err.message || 'Gagal memuat ulang dari server');
    }
  };

  const handleForceOverwrite = async () => {
    if (!versionConflict) return;
    await handleSave(versionConflict.currentVersion);
  };

  const handleTogglePin = async () => {
    if (!note || isPinning || isArchived) return;
    const nextPinned = !note.isPinned;
    setIsPinning(true);

    // Optimistic update
    setNote((prev) => (prev ? { ...prev, isPinned: nextPinned } : null));

    try {
      await pinNote(note.id, nextPinned);
    } catch (err: any) {
      // Rollback
      setNote((prev) => (prev ? { ...prev, isPinned: note.isPinned } : null));
      setSaveErrorMessage(err.message || 'Gagal memperbarui status sematan catatan');
    } finally {
      setIsPinning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Memuat catatan...</p>
        </div>
      </div>
    );
  }

  if (loadError || !note) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-danger/30 bg-danger/5 p-8 text-center my-8">
        <AlertCircle className="h-10 w-10 text-danger" />
        <h3 className="mt-3 text-base font-semibold text-danger">Catatan Tidak Ditemukan</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-md">
          {loadError || 'Catatan tidak ada atau Anda tidak memiliki akses.'}
        </p>
        <Link href="/notes" className="mt-4">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali ke Daftar Catatan
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <FadeIn className="mx-auto max-w-5xl space-y-4">
      {/* 1. Header Bar: Navigasi, Status Simpan, & Aksi Utama */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3.5 sm:pb-4">
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8 relative after:absolute after:-inset-1.5 sm:after:hidden touch-manipulation text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Kembali ke daftar catatan"
          >
            <Link href="/notes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Catatan
              </span>
              {isArchived && (
                <Badge variant="outline" className="text-xs border-warning text-warning">
                  Arsip (Hanya-baca)
                </Badge>
              )}
            </div>
            {note.course && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <BookOpen className="h-3 w-3 shrink-0 text-muted-foreground" />
                <Link
                  href={`/courses/${note.course.id}`}
                  className="hover:underline font-medium text-foreground truncate max-w-[240px]"
                >
                  {note.course.name}
                </Link>
              </p>
            )}
          </div>
        </div>

        {/* Save Status & Action */}
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          {/* Status Label */}
          <div className="text-xs flex items-center gap-1.5 font-medium">
            {saveStatus === 'SAVING' && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                Menyimpan…
              </span>
            )}
            {saveStatus === 'SAVED' && (
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {lastSavedTime ? `Tersimpan pukul ${lastSavedTime}` : 'Tersimpan'}
              </span>
            )}
            {saveStatus === 'DIRTY' && (
              <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Belum disimpan
              </span>
            )}
            {saveStatus === 'ERROR' && (
              <span className="flex items-center gap-1.5 text-destructive font-semibold">
                <AlertCircle className="h-3.5 w-3.5" />
                Gagal menyimpan
              </span>
            )}
          </div>

          <Button
            variant="outline"
            size="standard"
            onClick={handleTogglePin}
            disabled={isPinning || isArchived}
            className="gap-1.5 shrink-0 text-xs"
            title={note.isPinned ? 'Lepas sematan' : 'Sematkan catatan ini'}
            aria-label={note.isPinned ? 'Lepas sematan' : 'Sematkan catatan ini'}
          >
            {isPinning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Pin className={`h-4 w-4 ${note.isPinned ? 'fill-primary text-primary' : ''}`} />
            )}
            <span>{note.isPinned ? 'Disematkan' : 'Sematkan'}</span>
          </Button>

          <Button
            onClick={() => handleSave()}
            disabled={saveStatus === 'SAVING' || isArchived}
            size="standard"
            className="gap-1.5 shrink-0"
          >
            {saveStatus === 'SAVING' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>Simpan</span>
          </Button>
        </div>
      </div>

      {/* 2. Banner Arsip jika Read-only */}
      {isArchived && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Mata kuliah diarsipkan</AlertTitle>
          <AlertDescription>
            Catatan ini bersifat <strong>hanya-baca</strong> karena mata kuliah atau semesternya sedang diarsipkan.
          </AlertDescription>
        </Alert>
      )}

      {/* 3. Version Conflict Banner */}
      {versionConflict && (
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Konflik Versi Catatan (Versi Server: {versionConflict.currentVersion})</AlertTitle>
          <AlertDescription className="space-y-2 mt-1">
            <p className="text-xs">
              {versionConflict.message} Tulisan Anda saat ini masih berada di editor ini. Pilih tindakan penyelesaian di bawah:
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReloadServerVersion}
                className="text-xs"
              >
                Muat Ulang Versi Server (Buang Lokal)
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleForceOverwrite}
                className="text-xs"
              >
                Timpa Server dengan Tulisan Ini
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Save Error Feedback */}
      {saveErrorMessage && !versionConflict && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{saveErrorMessage}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSaveErrorMessage(null)}
              className="h-6 px-1.5 text-xs"
            >
              Tutup
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 4. Metadata: Course & Linked Material Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-card/60 backdrop-blur-xs px-4 py-3 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="font-medium text-muted-foreground">Mata Kuliah:</span>
            {note.course ? (
              <Link
                href={`/courses/${note.course.id}`}
                className="font-semibold text-foreground hover:text-primary transition-colors hover:underline"
              >
                {note.course.name}
              </Link>
            ) : (
              <span className="font-semibold text-foreground">—</span>
            )}
          </div>

          {note.updatedAt && (
            <>
              <span className="hidden sm:inline text-border">•</span>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Diperbarui {formatUserDateTime(note.updatedAt, timezone)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Tautan Materi Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-muted-foreground whitespace-nowrap font-medium">Materi:</span>
          {isArchived ? (
            note.material ? (
              <Link
                href={`/materials/${note.material.id}`}
                className="font-medium text-primary hover:underline flex items-center gap-1.5 max-w-[220px]"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{note.material.title}</span>
              </Link>
            ) : (
              <span className="text-muted-foreground italic">Tidak terhubung</span>
            )
          ) : (
            <div className="flex items-center gap-1.5">
              <Select
                value={materialId || 'none'}
                onValueChange={(val) => setMaterialId(val === 'none' ? null : val)}
              >
                <SelectTrigger
                  className="h-8 text-xs py-0 w-auto min-w-[200px] max-w-[280px] bg-background"
                  aria-label="Pilih Materi Terkait"
                >
                  <SelectValue placeholder="Pilih materi terkait..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">— Tidak terhubung ke materi —</span>
                  </SelectItem>
                  {courseMaterials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="truncate">{m.title}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {materialId && (
                <Button
                  asChild
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                  title="Buka materi terkait di tab baru"
                >
                  <Link href={`/materials/${materialId}`} target="_blank">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5. Note Title Input */}
      <div>
        <Input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isArchived}
          placeholder="Judul Catatan..."
          className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight h-13 sm:h-14 px-4 bg-card border-border/80 rounded-xl shadow-2xs focus-visible:ring-2 focus-visible:ring-primary/40 placeholder:text-muted-foreground/60 transition-all"
        />
      </div>

      {/* 6. Tabs: Tulis, Pratinjau, & Berdampingan (Live Split Preview on xl) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Card className="overflow-hidden border border-border/80 bg-card shadow-xs rounded-xl">
          {/* Tab List & Formatting Toolbar */}
          <div className="flex flex-wrap items-center justify-between border-b border-border/80 bg-muted/40 p-2 sm:px-3 gap-2">
            <TabsList className="h-9">
              <TabsTrigger value="write" className="gap-1.5 text-xs">
                <Edit3 className="h-3.5 w-3.5" />
                <span>Tulis</span>
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-1.5 text-xs">
                <Eye className="h-3.5 w-3.5" />
                <span>Pratinjau</span>
              </TabsTrigger>
              <TabsTrigger value="split" className="hidden xl:inline-flex gap-1.5 text-xs">
                <Columns2 className="h-3.5 w-3.5" />
                <span>Berdampingan</span>
              </TabsTrigger>
            </TabsList>

            {/* Markdown Quick Toolbar (Shown in Write and Split tabs) */}
            {(activeTab === 'write' || activeTab === 'split') && !isArchived && (
              <div className="flex items-center gap-0.5 overflow-x-auto py-0.5">
                {/* Heading group */}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => insertFormatting('# ', '', 'Judul')}
                  title="Heading 1 (# Judul)"
                  aria-label="Format Heading 1"
                >
                  <Heading1 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => insertFormatting('## ', '', 'Subjudul')}
                  title="Heading 2 (## Subjudul)"
                  aria-label="Format Heading 2"
                >
                  <Heading2 className="h-4 w-4" />
                </Button>

                <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

                {/* Inline formatting group */}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => insertFormatting('**', '**', 'teks tebal')}
                  title="Tebal (**teks**)"
                  aria-label="Format Tebal"
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => insertFormatting('*', '*', 'teks miring')}
                  title="Miring (*teks*)"
                  aria-label="Format Miring"
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => insertFormatting('~~', '~~', 'teks dicoret')}
                  title="Coret (~~teks~~)"
                  aria-label="Format Coret"
                >
                  <Strikethrough className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => insertFormatting('`', '`', 'kode')}
                  title="Kode inline (`kode`)"
                  aria-label="Format Kode Inline"
                >
                  <Code className="h-4 w-4" />
                </Button>

                <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

                {/* Block and list group */}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => insertFormatting('- ', '', 'Poin daftar')}
                  title="Daftar Poin (- Poin)"
                  aria-label="Format Daftar Poin"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => insertFormatting('1. ', '', 'Poin nomor')}
                  title="Daftar Nomor (1. Poin)"
                  aria-label="Format Daftar Nomor"
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => insertFormatting('> ', '', 'Kutipan')}
                  title="Kutipan (> Kutipan)"
                  aria-label="Format Kutipan"
                >
                  <Quote className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => insertFormatting('\n---\n', '', '')}
                  title="Garis Pemisah (---)"
                  aria-label="Format Garis Pemisah"
                >
                  <Minus className="h-4 w-4" />
                </Button>

                <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

                {/* Link group */}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => insertFormatting('[', '](https://example.com)', 'Nama tautan')}
                  title="Tautan ([Nama](https://...))"
                  aria-label="Format Tautan"
                >
                  <Link2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Tab Content: Write */}
          <TabsContent value="write" className="m-0 p-4 sm:p-6">
            <AnimatedPanel panelKey="write-panel">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={isArchived}
                placeholder="Tulis catatan menggunakan format Markdown di sini... Gunakan toolbar di atas untuk memformat teks dengan cepat."
                rows={24}
                className="w-full resize-y rounded-lg bg-transparent p-2 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden border-none min-h-[500px]"
              />
            </AnimatedPanel>
          </TabsContent>

          {/* Tab Content: Preview */}
          <TabsContent value="preview" className="m-0 p-6 min-h-[520px] bg-background/40">
            <AnimatedPanel panelKey="preview-panel">
              {content.trim() ? (
                <div className="max-w-3xl mx-auto py-2">
                  <SafeMarkdownRenderer content={content} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="rounded-full bg-muted/60 p-4 mb-3 text-muted-foreground">
                    <FileText className="h-8 w-8" />
                  </div>
                  <h4 className="text-base font-semibold text-foreground">Belum ada konten untuk dipratinjau</h4>
                  <p className="text-sm text-muted-foreground max-w-sm mt-1">
                    Tulis rangkuman dan catatan Anda di tab Tulis dengan format Markdown, lalu lihat hasil tampilannya di sini.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('write')}
                    className="mt-4 gap-1.5 text-xs"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Mulai Menulis
                  </Button>
                </div>
              )}
            </AnimatedPanel>
          </TabsContent>

          {/* Tab Content: Live Split Preview (xl desktop) */}
          <TabsContent value="split" className="m-0">
            <AnimatedPanel panelKey="split-panel">
              <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-border/80 min-h-[520px]">
                <div className="p-4 sm:p-6">
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    disabled={isArchived}
                    placeholder="Tulis catatan menggunakan format Markdown di sini... Pratinjau langsung tampil di sisi kanan."
                    rows={24}
                    className="w-full resize-y rounded-lg bg-transparent p-2 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden border-none min-h-[500px]"
                  />
                </div>
                <div className="p-4 sm:p-6 bg-background/40 overflow-y-auto max-h-[680px]">
                  {content.trim() ? (
                    <SafeMarkdownRenderer content={content} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-16 text-center text-muted-foreground">
                      <FileText className="h-7 w-7 mb-2 opacity-60" />
                      <p className="text-xs">Pratinjau Markdown langsung akan tampil saat Anda mengetik.</p>
                    </div>
                  )}
                </div>
              </div>
            </AnimatedPanel>
          </TabsContent>

          {/* Footer Bar: Stats & Hints */}
          <div className="flex flex-wrap items-center justify-between border-t border-border/80 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground gap-2">
            <div className="flex items-center gap-3 tabular-nums">
              <span>{stats.words.toLocaleString('id-ID')} kata</span>
              <span>•</span>
              <span>{stats.chars.toLocaleString('id-ID')} karakter</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                ±{stats.readTimeMinutes} menit baca
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground">
                Ctrl+S
              </kbd>
              <span>untuk menyimpan</span>
            </div>
          </div>
        </Card>
      </Tabs>

      {/* 7. Dialog Konfirmasi Perubahan Belum Tersimpan */}
      <Dialog
        open={isConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !isSavingAndLeaving) {
            handleStayAndEdit();
          }
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          data-testid="unsaved-changes-dialog"
          aria-describedby="unsaved-changes-description"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              Perubahan Belum Tersimpan
            </DialogTitle>
            <DialogDescription id="unsaved-changes-description" className="text-sm text-muted-foreground mt-1">
              Catatan ini memiliki perubahan yang belum disimpan. Pilih tindakan yang ingin Anda lakukan sebelum berpindah halaman:
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-col sm:flex-col gap-2 mt-4">
            {/* 3. Simpan dan lanjutkan */}
            <Button
              type="button"
              variant="default"
              onClick={handleSaveAndLeave}
              disabled={isSavingAndLeaving}
              className="w-full justify-center gap-2 h-9"
              data-testid="confirm-save-and-leave"
            >
              {isSavingAndLeaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan dan melanjutkan…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Simpan dan lanjutkan
                </>
              )}
            </Button>

            {/* 2. Buang perubahan dan lanjutkan */}
            <Button
              type="button"
              variant="destructive"
              onClick={handleDiscardAndLeave}
              disabled={isSavingAndLeaving}
              className="w-full justify-center h-9"
              data-testid="confirm-discard-and-leave"
            >
              Buang perubahan dan lanjutkan
            </Button>

            {/* 1. Tetap mengedit */}
            <Button
              type="button"
              variant="outline"
              onClick={handleStayAndEdit}
              disabled={isSavingAndLeaving}
              className="w-full justify-center h-9"
              data-testid="confirm-stay-and-edit"
            >
              Tetap mengedit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FadeIn>
  );
}
