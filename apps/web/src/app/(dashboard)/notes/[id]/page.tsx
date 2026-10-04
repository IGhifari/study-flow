'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  FileText,
  Save,
  Eye,
  Edit3,
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
} from 'lucide-react';
import { Note, formatUserDateTime, UserProfile, MaterialListItem } from '@studyflow/shared';
import { getNote, updateNote } from '@/lib/note-client';
import { listMaterials } from '@/lib/material-client';
import { getProfile } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { SafeMarkdownRenderer } from '@/components/notes/markdown-renderer';

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
  const [activeTab, setActiveTab] = React.useState<'write' | 'preview'>('write');

  // Track save state & concurrency
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('SAVED');
  const [saveErrorMessage, setSaveErrorMessage] = React.useState<string | null>(null);
  const [versionConflict, setVersionConflict] = React.useState<{
    currentVersion: number;
    message: string;
  } | null>(null);

  // References to track what content was sent in the in-flight save
  const lastSavedSnapshot = React.useRef({ title: '', content: '', materialId: null as string | null });
  const inFlightSnapshot = React.useRef<{ title: string; content: string; materialId: string | null } | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const timezone = userProfile?.timezone || 'Asia/Jakarta';

  // Load Note
  React.useEffect(() => {
    async function fetchNote() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [profile, fetchedNote] = await Promise.all([
          getProfile().catch(() => null),
          getNote(noteId),
        ]);
        if (profile) setUserProfile(profile);
        setNote(fetchedNote);
        setTitle(fetchedNote.title);
        setContent(fetchedNote.content || '');
        setMaterialId(fetchedNote.materialId || null);
        lastSavedSnapshot.current = {
          title: fetchedNote.title,
          content: fetchedNote.content || '',
          materialId: fetchedNote.materialId || null,
        };

        if (fetchedNote.courseId) {
          try {
            const matRes = await listMaterials({ courseId: fetchedNote.courseId, limit: 100 });
            setCourseMaterials(matRes.materials);
          } catch (mErr) {
            console.error('Failed to load course materials:', mErr);
          }
        }

        setSaveStatus('SAVED');
      } catch (err: any) {
        setLoadError(err.message || 'Gagal memuat catatan.');
      } finally {
        setIsLoading(false);
      }
    }

    if (noteId) {
      fetchNote();
    }
  }, [noteId]);

  // Track unsaved changes
  const hasUnsavedChanges = React.useMemo(() => {
    return (
      title !== lastSavedSnapshot.current.title ||
      content !== lastSavedSnapshot.current.content ||
      materialId !== lastSavedSnapshot.current.materialId
    );
  }, [title, content, materialId]);

  React.useEffect(() => {
    if (saveStatus !== 'SAVING') {
      setSaveStatus(hasUnsavedChanges ? 'DIRTY' : 'SAVED');
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
  const handleSave = async (overrideVersion?: number) => {
    if (!note) return;
    if (!title.trim()) {
      setSaveErrorMessage('Judul catatan wajib diisi.');
      setSaveStatus('ERROR');
      return;
    }

    setSaveStatus('SAVING');
    setSaveErrorMessage(null);
    setVersionConflict(null);

    // Snapshot of what is being saved right now
    const snapshotBeingSaved = { title, content, materialId };
    inFlightSnapshot.current = snapshotBeingSaved;

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
      lastSavedSnapshot.current = snapshotBeingSaved;

      // Crucial requirement: If user kept typing while save was in flight,
      // only mark SAVED if current state matches the snapshot that was successfully saved.
      if (
        title === snapshotBeingSaved.title &&
        content === snapshotBeingSaved.content &&
        materialId === snapshotBeingSaved.materialId
      ) {
        setSaveStatus('SAVED');
      } else {
        setSaveStatus('DIRTY');
      }
    } catch (err: any) {
      if (err.code === 'NOTE_VERSION_CONFLICT') {
        setVersionConflict({
          currentVersion: err.currentVersion || (note.version + 1),
          message:
            'Catatan ini telah diperbarui di sesi atau tab lain. Perubahan lokal Anda tidak ditimpa secara otomatis.',
        });
      }
      setSaveErrorMessage(err.message || 'Gagal menyimpan catatan.');
      setSaveStatus('ERROR');
    } finally {
      inFlightSnapshot.current = null;
    }
  };

  // Resolve Conflict: Reload from server
  const handleReloadServerVersion = async () => {
    if (!confirm('Perubahan lokal yang belum tersimpan akan dibuang. Muat ulang dari server?')) {
      return;
    }
    try {
      const fresh = await getNote(noteId);
      setNote(fresh);
      setTitle(fresh.title);
      setContent(fresh.content || '');
      setMaterialId(fresh.materialId || null);
      lastSavedSnapshot.current = {
        title: fresh.title,
        content: fresh.content || '',
        materialId: fresh.materialId || null,
      };
      setVersionConflict(null);
      setSaveStatus('SAVED');
    } catch (err: any) {
      alert(err.message || 'Gagal memuat ulang dari server');
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
        <p className="mt-1 text-sm text-muted-foreground max-w-md">{loadError || 'Catatan tidak ada atau Anda tidak memiliki akses.'}</p>
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
    <div className="space-y-4">
      {/* Back and Status Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Link href="/notes">
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Catatan Kuliah
              </span>
              {isArchived && (
                <Badge variant="outline" className="text-[10px] border-warning text-warning">
                  Arsip (Hanya-baca)
                </Badge>
              )}
            </div>
            {note.course && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <BookOpen className="h-3 w-3" />
                <Link href={`/courses/${note.course.id}`} className="hover:underline font-medium text-foreground">
                  {note.course.name}
                </Link>
              </p>
            )}
          </div>
        </div>

        {/* Save Status & Action */}
        <div className="flex items-center gap-3">
          {/* Status Label */}
          <div className="text-xs flex items-center gap-1.5 font-medium">
            {saveStatus === 'SAVING' && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                Menyimpan…
              </span>
            )}
            {saveStatus === 'SAVED' && (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Tersimpan
              </span>
            )}
            {saveStatus === 'DIRTY' && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Belum disimpan
              </span>
            )}
            {saveStatus === 'ERROR' && (
              <span className="flex items-center gap-1 text-danger font-semibold">
                <AlertCircle className="h-3.5 w-3.5" />
                Gagal menyimpan
              </span>
            )}
          </div>

          <Button
            onClick={() => handleSave()}
            disabled={saveStatus === 'SAVING' || isArchived}
            className="h-9 px-4"
          >
            {saveStatus === 'SAVING' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Simpan
          </Button>
        </div>
      </div>

      {/* Read-only Banner for Archived Course/Semester */}
      {isArchived && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3.5 text-xs text-warning-foreground flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <span>
            Mata kuliah atau semester catatan ini sedang diarsipkan. Catatan bersifat <strong>hanya-baca</strong>. Pulihkan mata kuliah terlebih dahulu untuk mengedit.
          </span>
        </div>
      )}

      {/* Version Conflict Banner */}
      {versionConflict && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-foreground flex flex-col gap-2">
          <div className="flex items-start gap-2 text-danger font-semibold">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>Konflik Versi Catatan (Versi {versionConflict.currentVersion})</span>
          </div>
          <p className="text-xs text-muted-foreground ml-7">
            {versionConflict.message} Tulisan Anda saat ini masih tersimpan di editor ini. Pilih tindakan pemulihan di bawah:
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1 ml-7">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReloadServerVersion}
              className="text-xs"
            >
              Muat Ulang Versi Server (Buang Lokal)
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleForceOverwrite}
              className="text-xs bg-danger hover:bg-danger/90 text-white"
            >
              Timpa Server dengan Tulisan Ini
            </Button>
          </div>
        </div>
      )}

      {saveErrorMessage && !versionConflict && (
        <div className="rounded-md bg-danger/10 p-3 text-xs font-medium text-danger border border-danger/20 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{saveErrorMessage}</span>
        </div>
      )}

      {/* Course & Material Link Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5 text-primary" />
          <span>Mata Kuliah:</span>
          {note.course ? (
            <Link href={`/courses/${note.course.id}`} className="font-semibold text-foreground hover:underline">
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
                <span>{note.material.title}</span>
              </Link>
            ) : (
              <span className="text-muted-foreground italic">Tidak terhubung</span>
            )
          ) : (
            <div className="flex items-center gap-2">
              <Select
                value={materialId || 'none'}
                onChange={(e) => setMaterialId(e.target.value === 'none' ? null : e.target.value)}
                className="h-8 text-xs py-0 w-auto min-w-[200px]"
                aria-label="Pilih Materi Terkait"
              >
                <option value="none">— Tidak terhubung ke materi —</option>
                {courseMaterials.map((m) => (
                  <option key={m.id} value={m.id}>
                    📄 {m.title}
                  </option>
                ))}
              </Select>
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

      {/* Note Title Input */}
      <div>
        <Input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isArchived}
          placeholder="Judul Catatan..."
          className="text-xl font-bold tracking-tight h-12 px-3 border-none bg-transparent hover:bg-muted/30 focus-visible:bg-transparent shadow-none"
        />
      </div>

      {/* Editor Tabs & Toolbar */}
      <Card className="overflow-hidden border border-border bg-card">
        {/* Tab & Toolbar Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-border bg-muted/40 p-2 gap-2">
          {/* Tabs: Tulis & Pratinjau */}
          <div className="flex items-center gap-1 rounded-lg bg-background p-1 border border-border">
            <button
              type="button"
              onClick={() => setActiveTab('write')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'write'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Edit3 className="h-3.5 w-3.5" />
              Tulis
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'preview'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              Pratinjau
            </button>
          </div>

          {/* Markdown Quick Toolbar (Only shown in Write tab) */}
          {activeTab === 'write' && !isArchived && (
            <div className="flex items-center gap-1 overflow-x-auto">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => insertFormatting('# ', '', 'Judul')}
                title="Heading 1"
              >
                <Heading1 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => insertFormatting('## ', '', 'Subjudul')}
                title="Heading 2"
              >
                <Heading2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => insertFormatting('**', '**', 'teks tebal')}
                title="Bold (Tebal)"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => insertFormatting('*', '*', 'teks miring')}
                title="Italic (Miring)"
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => insertFormatting('```\n', '\n```', 'kode')}
                title="Code block"
              >
                <Code className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => insertFormatting('- ', '', 'Poin daftar')}
                title="Daftar (List)"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => insertFormatting('> ', '', 'Kutipan')}
                title="Kutipan (Quote)"
              >
                <Quote className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => insertFormatting('[', '](https://example.com)', 'Nama tautan')}
                title="Link"
              >
                <Link2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Tab Body */}
        {activeTab === 'write' ? (
          <div className="p-4">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isArchived}
              placeholder="Tulis catatan menggunakan format Markdown di sini..."
              rows={22}
              className="w-full resize-y rounded-md bg-transparent p-2 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary border-none"
            />
          </div>
        ) : (
          <div className="p-6 min-h-[500px] bg-background/50">
            <SafeMarkdownRenderer content={content} />
          </div>
        )}
      </Card>
    </div>
  );
}
