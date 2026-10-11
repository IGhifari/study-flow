'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Heading1,
  Heading2,
  Bold,
  Italic,
  Code,
  List,
  Quote,
  Link2,
  ExternalLink,
  Save,
  Edit3,
  Eye,
  FileText,
} from 'lucide-react';
import { Note, formatUserDateTime, UserProfile, MaterialListItem } from '@studyflow/shared';
import { getNote, updateNote } from '@/lib/note-client';
import { listMaterials } from '@/lib/material-client';
import { getProfile } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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

  // Perform Save
  // Perform Save
  const handleSave = async (overrideVersion?: number): Promise<{ success: boolean; stillDirty: boolean }> => {
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
  };

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

  // Resolve Conflict: Force overwrite using latest version number
  const handleForceOverwrite = async () => {
    if (!versionConflict) return;
    await handleSave(versionConflict.currentVersion);
  };

  const isArchived = Boolean(note?.course?.archivedAt || note?.course?.semester?.archivedAt);

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
    <div className="mx-auto max-w-5xl space-y-4">
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
                <Badge variant="outline" className="text-[10px] border-warning text-warning">
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>Mata Kuliah:</span>
          {note.course ? (
            <Link
              href={`/courses/${note.course.id}`}
              className="font-semibold text-foreground hover:underline"
            >
              {note.course.name}
            </Link>
          ) : (
            <span className="font-semibold text-foreground">—</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Tautan Materi:</span>
          {isArchived ? (
            note.material ? (
              <Link
                href={`/materials/${note.material.id}`}
                className="font-medium text-primary hover:underline flex items-center gap-1"
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="truncate max-w-[200px]">{note.material.title}</span>
              </Link>
            ) : (
              <span className="text-muted-foreground italic">Tidak terhubung</span>
            )
          ) : (
            <div className="flex items-center gap-2">
              <NativeSelect
                value={materialId || 'none'}
                onChange={(e) => setMaterialId(e.target.value === 'none' ? null : e.target.value)}
                className="h-8 text-xs py-0 w-auto min-w-[200px] max-w-[280px]"
                aria-label="Pilih Materi Terkait"
              >
                <option value="none">— Tidak terhubung ke materi —</option>
                {courseMaterials.map((m) => (
                  <option key={m.id} value={m.id}>
                    📄 {m.title}
                  </option>
                ))}
              </NativeSelect>
              {materialId && (
                <Link
                  href={`/materials/${materialId}`}
                  target="_blank"
                  className="text-muted-foreground hover:text-primary transition-colors"
                  title="Buka materi di tab baru"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
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
          className="text-xl sm:text-2xl font-bold tracking-tight h-12 px-3 border-none bg-transparent hover:bg-muted/20 focus-visible:bg-transparent shadow-none"
        />
      </div>

      {/* 6. Tabs: Tulis & Pratinjau */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Card className="overflow-hidden border border-border bg-card shadow-xs">
          {/* Tab List & Formatting Toolbar */}
          <div className="flex flex-wrap items-center justify-between border-b border-border bg-muted/40 p-2 gap-2">
            <TabsList className="h-9">
              <TabsTrigger value="write" className="gap-1.5">
                <Edit3 className="h-3.5 w-3.5" />
                <span>Tulis</span>
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                <span>Pratinjau</span>
              </TabsTrigger>
            </TabsList>

            {/* Markdown Quick Toolbar (Only shown in Write tab) */}
            {activeTab === 'write' && !isArchived && (
              <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => insertFormatting('# ', '', 'Judul')}
                  title="Heading 1"
                  aria-label="Format Heading 1"
                >
                  <Heading1 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => insertFormatting('## ', '', 'Subjudul')}
                  title="Heading 2"
                  aria-label="Format Heading 2"
                >
                  <Heading2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => insertFormatting('**', '**', 'teks tebal')}
                  title="Bold (Tebal)"
                  aria-label="Format Bold"
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => insertFormatting('*', '*', 'teks miring')}
                  title="Italic (Miring)"
                  aria-label="Format Italic"
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => insertFormatting('```\n', '\n```', 'kode')}
                  title="Code block"
                  aria-label="Format Code Block"
                >
                  <Code className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => insertFormatting('- ', '', 'Poin daftar')}
                  title="Daftar (List)"
                  aria-label="Format List"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => insertFormatting('> ', '', 'Kutipan')}
                  title="Kutipan (Quote)"
                  aria-label="Format Quote"
                >
                  <Quote className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => insertFormatting('[', '](https://example.com)', 'Nama tautan')}
                  title="Link"
                  aria-label="Format Link"
                >
                  <Link2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Tab Content: Write */}
          <TabsContent value="write" className="m-0 p-4">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isArchived}
              placeholder="Tulis catatan menggunakan format Markdown di sini..."
              rows={22}
              className="w-full resize-y rounded-md bg-transparent p-2 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary border-none min-h-[460px]"
            />
          </TabsContent>

          {/* Tab Content: Preview */}
          <TabsContent value="preview" className="m-0 p-6 min-h-[500px] bg-background/50">
            <div className="max-w-3xl mx-auto">
              <SafeMarkdownRenderer content={content} />
            </div>
          </TabsContent>
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
    </div>
  );
}
