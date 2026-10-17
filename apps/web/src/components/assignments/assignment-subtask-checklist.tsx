'use client';

import * as React from 'react';
import { AssignmentSubtask } from '@studyflow/shared';
import {
  listSubtasks,
  createSubtask,
  updateSubtask,
  deleteSubtask,
} from '@/lib/subtask-client';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';

export interface AssignmentSubtaskChecklistProps {
  assignmentId: string;
  isParentDone: boolean;
  isArchived: boolean;
  onCountChange?: (count: { total: number; completed: number }) => void;
}

export function AssignmentSubtaskChecklist({
  assignmentId,
  isParentDone,
  isArchived,
  onCountChange,
}: AssignmentSubtaskChecklistProps): React.JSX.Element {
  const [subtasks, setSubtasks] = React.useState<AssignmentSubtask[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Quick add state
  const [newTitle, setNewTitle] = React.useState('');
  const [isAdding, setIsAdding] = React.useState(false);

  // Editing state
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingTitle, setEditingTitle] = React.useState('');
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);

  // Per-item pending state
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());

  // Confirm delete state (inline confirmation)
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  // Race condition guard for fetching
  const fetchRequestIdRef = React.useRef(0);

  // Fetch subtasks
  const fetchItems = React.useCallback(async () => {
    const currentRequestId = ++fetchRequestIdRef.current;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const items = await listSubtasks(assignmentId);
      if (currentRequestId === fetchRequestIdRef.current) {
        setSubtasks(items);
        const total = items.length;
        const completed = items.filter((s) => s.completed).length;
        onCountChange?.({ total, completed });
      }
    } catch (err: any) {
      if (currentRequestId === fetchRequestIdRef.current) {
        setErrorMsg(err.message || 'Gagal memuat subtugas');
      }
    } finally {
      if (currentRequestId === fetchRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [assignmentId, onCountChange]);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const total = subtasks.length;
  const completed = subtasks.filter((s) => s.completed).length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Toggle completion with optimistic update & rollback
  const handleToggle = async (sub: AssignmentSubtask) => {
    if (isParentDone || isArchived || pendingIds.has(sub.id)) return;

    const nextCompleted = !sub.completed;
    setErrorMsg(null);
    setPendingIds((prev) => new Set(prev).add(sub.id));

    // Optimistic update
    const previousSubtasks = [...subtasks];
    const updated = subtasks.map((item) =>
      item.id === sub.id ? { ...item, completed: nextCompleted } : item
    );
    setSubtasks(updated);
    onCountChange?.({
      total: updated.length,
      completed: updated.filter((s) => s.completed).length,
    });

    try {
      const res = await updateSubtask(assignmentId, sub.id, { completed: nextCompleted });
      setSubtasks((prev) =>
        prev.map((item) => (item.id === sub.id ? res : item))
      );
    } catch (err: any) {
      // Rollback
      setSubtasks(previousSubtasks);
      onCountChange?.({
        total: previousSubtasks.length,
        completed: previousSubtasks.filter((s) => s.completed).length,
      });
      setErrorMsg(err.message || 'Gagal memperbarui status subtugas');
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(sub.id);
        return next;
      });
    }
  };

  // Add subtask
  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isParentDone || isArchived || isAdding) return;

    const trimmed = newTitle.trim();
    if (!trimmed) return;
    if (total >= 50) {
      setErrorMsg('Batas maksimal subtugas per tugas adalah 50 subtugas');
      return;
    }

    setIsAdding(true);
    setErrorMsg(null);

    try {
      const created = await createSubtask(assignmentId, { title: trimmed });
      setNewTitle('');
      const updated = [...subtasks, created];
      setSubtasks(updated);
      onCountChange?.({
        total: updated.length,
        completed: updated.filter((s) => s.completed).length,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menambahkan subtugas');
      // newTitle is intentionally retained on failure
    } finally {
      setIsAdding(false);
    }
  };

  // Start editing
  const startEdit = (sub: AssignmentSubtask) => {
    if (isParentDone || isArchived) return;
    setEditingId(sub.id);
    setEditingTitle(sub.title);
    setErrorMsg(null);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  // Save editing
  const handleSaveEdit = async (sub: AssignmentSubtask) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      setErrorMsg('Judul subtugas tidak boleh kosong');
      return;
    }
    if (trimmed === sub.title) {
      cancelEdit();
      return;
    }

    setIsSavingEdit(true);
    setErrorMsg(null);

    try {
      const res = await updateSubtask(assignmentId, sub.id, { title: trimmed });
      setSubtasks((prev) =>
        prev.map((item) => (item.id === sub.id ? res : item))
      );
      cancelEdit();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengubah judul subtugas');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete subtask
  const handleDelete = async (subId: string) => {
    if (isParentDone || isArchived) return;
    setPendingIds((prev) => new Set(prev).add(subId));
    setErrorMsg(null);
    setConfirmDeleteId(null);

    const previousSubtasks = [...subtasks];
    const updated = subtasks.filter((s) => s.id !== subId);
    setSubtasks(updated);
    onCountChange?.({
      total: updated.length,
      completed: updated.filter((s) => s.completed).length,
    });

    try {
      await deleteSubtask(assignmentId, subId);
    } catch (err: any) {
      setSubtasks(previousSubtasks);
      onCountChange?.({
        total: previousSubtasks.length,
        completed: previousSubtasks.filter((s) => s.completed).length,
      });
      setErrorMsg(err.message || 'Gagal menghapus subtugas');
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(subId);
        return next;
      });
    }
  };

  return (
    <div className="space-y-3 pt-2">
      {/* Header and Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">
            Checklist Subtugas
          </span>
          {total > 0 && (
            <span className="text-muted-foreground font-medium tabular-nums">
              {completed} dari {total} langkah selesai ({progressPercent}%)
            </span>
          )}
        </div>

        {total > 0 && (
          <Progress
            value={progressPercent}
            className="h-1.5"
            aria-label="Progres penyelesaian subtugas"
          />
        )}
      </div>

      {/* Read-Only Notice when parent task is completed */}
      {isParentDone && (
        <Alert variant="default" className="py-2 bg-muted/50 border-muted">
          <Info className="h-4 w-4 text-muted-foreground shrink-0" />
          <AlertDescription className="text-xs text-muted-foreground">
            Tugas ini telah selesai. Buka kembali tugas untuk mengedit atau menambah subtugas.
          </AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {errorMsg && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Subtasks List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>Memuat checklist...</span>
        </div>
      ) : subtasks.length === 0 ? (
        <div className="text-center py-3 px-4 border border-dashed rounded-lg bg-muted/20 text-xs text-muted-foreground">
          Belum ada subtugas. Tambahkan langkah pekerjaan untuk memecah tugas ini.
        </div>
      ) : (
        <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {subtasks.map((sub) => {
            const isPending = pendingIds.has(sub.id);
            const isEditing = editingId === sub.id;
            const isConfirmingDelete = confirmDeleteId === sub.id;

            return (
              <li
                key={sub.id}
                className={`flex items-center gap-2 p-2 rounded-lg border text-xs transition-colors ${
                  sub.completed
                    ? 'bg-muted/30 border-muted/50'
                    : 'bg-card border-border hover:bg-muted/20'
                }`}
              >
                {/* Checkbox */}
                <div className="shrink-0 flex items-center justify-center">
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  ) : (
                    <Checkbox
                      id={`subtask-check-${sub.id}`}
                      checked={sub.completed}
                      disabled={isParentDone || isArchived || isPending}
                      onCheckedChange={() => handleToggle(sub)}
                      aria-label={
                        sub.completed
                          ? `Tandai "${sub.title}" belum selesai`
                          : `Tandai "${sub.title}" selesai`
                      }
                      className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                    />
                  )}
                </div>

                {/* Title / Inline Edit */}
                {isEditing ? (
                  <div className="flex-1 flex items-center gap-1.5">
                    <Input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSaveEdit(sub);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          e.stopPropagation();
                          cancelEdit();
                        }
                      }}
                      disabled={isSavingEdit}
                      className="h-7 text-xs py-1 px-2"
                      autoFocus
                      maxLength={200}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleSaveEdit(sub)}
                      disabled={isSavingEdit}
                      className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                      title="Simpan perubahan"
                      aria-label="Simpan perubahan"
                    >
                      {isSavingEdit ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={cancelEdit}
                      disabled={isSavingEdit}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Batal"
                      aria-label="Batal"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <span
                      onClick={() => {
                        if (!isParentDone && !isArchived) startEdit(sub);
                      }}
                      className={`block break-words cursor-pointer select-none ${
                        sub.completed
                          ? 'line-through text-muted-foreground'
                          : 'text-foreground'
                      }`}
                      title={!isParentDone && !isArchived ? 'Klik untuk mengedit' : undefined}
                    >
                      {sub.title}
                    </span>
                  </div>
                )}

                {/* Actions (Edit / Delete) */}
                {!isEditing && !isParentDone && !isArchived && (
                  <div className="shrink-0 flex items-center gap-0.5">
                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-1 bg-destructive/10 px-1.5 py-0.5 rounded border border-destructive/20 text-xs">
                        <span className="text-destructive font-medium">Hapus?</span>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-sm"
                          onClick={() => handleDelete(sub.id)}
                          className="h-5 w-5 p-0"
                          title="Ya, hapus"
                          aria-label="Ya, hapus"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setConfirmDeleteId(null)}
                          className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                          title="Batal"
                          aria-label="Batal"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => startEdit(sub)}
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          title="Edit subtugas"
                          aria-label={`Edit subtugas "${sub.title}"`}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setConfirmDeleteId(sub.id)}
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          title="Hapus subtugas"
                          aria-label={`Hapus subtugas "${sub.title}"`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Quick Add Form (Hidden when task is completed) */}
      {!isParentDone && !isArchived && (
        <div className="flex items-center gap-1.5 pt-1">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleAdd();
              }
            }}
            placeholder="Tambah subtugas baru... (tekan Enter)"
            disabled={isAdding || total >= 50}
            maxLength={200}
            className="h-8 text-xs flex-1"
          />
          <Button
            type="button"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleAdd();
            }}
            disabled={!newTitle.trim() || isAdding || total >= 50}
            className="h-8 px-2.5 gap-1 shrink-0 text-xs"
          >
            {isAdding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            <span>Tambah</span>
          </Button>
        </div>
      )}
    </div>
  );
}
