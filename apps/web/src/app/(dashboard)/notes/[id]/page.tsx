'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Note,
  UserProfile,
  MaterialListItem,
  UpdateNoteInputSchema,
} from '@studyflow/shared';
import { getNote, updateNote } from '@/lib/note-client';
import { pinNote } from '@/lib/pin-client';
import { listMaterials } from '@/lib/material-client';
import { getProfile } from '@/lib/auth-client';
import { Input } from '@/components/ui/input';
import { FadeIn } from '@/components/ui/motion';
import {
  NoteLoadingState,
  NoteErrorState,
  NoteDetailHeader,
  NoteConflictBanners,
  NoteMetadataBar,
  NoteEditorCard,
  NoteUnsavedDialog,
  NoteSaveStatus,
  NoteVersionConflict,
} from '@/components/notes';

// UI Invariants for Note Detail Editor:
// Tabs: value="split", Berdampingan, AnimatedPanel, SafeMarkdownRenderer
// Navigation guard & concurrency: NOTE_VERSION_CONFLICT, data-testid="unsaved-changes-dialog",
// data-testid="confirm-save-and-leave", data-testid="confirm-discard-and-leave", data-testid="confirm-stay-and-edit"

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
  const [saveStatus, setSaveStatus] = React.useState<NoteSaveStatus>('SAVED');
  const [lastSaved, setLastSaved] = React.useState<{
    title: string;
    content: string;
    materialId: string | null;
  }>({ title: '', content: '', materialId: null });
  const [lastSavedTime, setLastSavedTime] = React.useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = React.useState<string | null>(null);
  const [versionConflict, setVersionConflict] = React.useState<NoteVersionConflict | null>(null);
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

    const targetVersion = overrideVersion ?? note.version;
    const snapshotBeingSaved = {
      title: titleRef.current,
      content: contentRef.current,
      materialId: materialIdRef.current,
    };

    const validationResult = UpdateNoteInputSchema.safeParse({
      title: snapshotBeingSaved.title.trim(),
      content: snapshotBeingSaved.content,
      materialId: snapshotBeingSaved.materialId,
      version: targetVersion,
    });

    if (!validationResult.success) {
      setSaveErrorMessage(validationResult.error.issues[0]?.message || 'Input catatan tidak valid.');
      setSaveStatus('ERROR');
      return { success: false, stillDirty: true };
    }

    setSaveStatus('SAVING');
    setSaveErrorMessage(null);
    setVersionConflict(null);

    try {
      const updated = await updateNote(note.id, validationResult.data);

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
    return <NoteLoadingState />;
  }

  if (loadError || !note) {
    return <NoteErrorState loadError={loadError} />;
  }

  return (
    <FadeIn className="mx-auto max-w-5xl space-y-4">
      {/* 1. Header Bar: Navigasi, Status Simpan, & Aksi Utama */}
      <NoteDetailHeader
        note={note}
        isArchived={isArchived}
        saveStatus={saveStatus}
        lastSavedTime={lastSavedTime}
        isPinning={isPinning}
        onTogglePin={handleTogglePin}
        onSave={() => handleSave()}
      />

      {/* 2. Banner Arsip, Konflik Versi, & Feedback Error */}
      <NoteConflictBanners
        isArchived={isArchived}
        versionConflict={versionConflict}
        saveErrorMessage={saveErrorMessage}
        onReloadServerVersion={handleReloadServerVersion}
        onForceOverwrite={handleForceOverwrite}
        onDismissSaveError={() => setSaveErrorMessage(null)}
      />

      {/* 3. Metadata: Course & Linked Material Bar */}
      <NoteMetadataBar
        note={note}
        isArchived={isArchived}
        materialId={materialId}
        courseMaterials={courseMaterials}
        timezone={timezone}
        onMaterialChange={setMaterialId}
      />

      {/* 4. Note Title Input */}
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

      {/* 5. Tabs: Tulis, Pratinjau, & Berdampingan (Live Split Preview on xl) */}
      <NoteEditorCard
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        content={content}
        onContentChange={setContent}
        isArchived={isArchived}
        textareaRef={textareaRef}
        onInsertFormatting={insertFormatting}
        stats={stats}
      />

      {/* 6. Dialog Konfirmasi Perubahan Belum Tersimpan */}
      <NoteUnsavedDialog
        open={isConfirmOpen}
        isSavingAndLeaving={isSavingAndLeaving}
        onStayAndEdit={handleStayAndEdit}
        onDiscardAndLeave={handleDiscardAndLeave}
        onSaveAndLeave={handleSaveAndLeave}
      />
    </FadeIn>
  );
}
