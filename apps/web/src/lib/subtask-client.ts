import {
  AssignmentSubtask,
  CreateSubtaskInput,
  UpdateSubtaskInput,
  SubtaskListResponseSchema,
  SubtaskDetailResponseSchema,
} from '@studyflow/shared';

export async function listSubtasks(assignmentId: string): Promise<AssignmentSubtask[]> {
  const res = await fetch(`/api/assignments/${assignmentId}/subtasks`, {
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || data.message || 'Gagal memuat subtugas');
  }

  const parsed = SubtaskListResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('Format respons subtugas tidak valid');
  }

  return parsed.data.subtasks;
}

export async function createSubtask(
  assignmentId: string,
  input: CreateSubtaskInput
): Promise<AssignmentSubtask> {
  const res = await fetch(`/api/assignments/${assignmentId}/subtasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || data.message || 'Gagal menambahkan subtugas');
  }

  const parsed = SubtaskDetailResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('Format respons subtugas tidak valid');
  }

  return parsed.data.subtask;
}

export async function updateSubtask(
  assignmentId: string,
  subtaskId: string,
  input: UpdateSubtaskInput
): Promise<AssignmentSubtask> {
  const res = await fetch(`/api/assignments/${assignmentId}/subtasks/${subtaskId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || data.message || 'Gagal memperbarui subtugas');
  }

  const parsed = SubtaskDetailResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('Format respons subtugas tidak valid');
  }

  return parsed.data.subtask;
}

export async function deleteSubtask(
  assignmentId: string,
  subtaskId: string
): Promise<void> {
  const res = await fetch(`/api/assignments/${assignmentId}/subtasks/${subtaskId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || data.message || 'Gagal menghapus subtugas');
  }
}
