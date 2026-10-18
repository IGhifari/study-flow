'use client';

import * as React from 'react';
import {
  ListTodo,
  Plus,
  CheckCircle2,
  Circle,
  Loader2,
} from 'lucide-react';
import { Assignment, formatUserDateTime } from '@studyflow/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

export interface CourseAssignmentsTabProps {
  assignments: Assignment[];
  isLoading: boolean;
  isArchived: boolean;
  timezone: string;
  pendingAssignmentIds: Set<string>;
  onToggleStatus: (assignment: Assignment) => void;
  onAddAssignment: () => void;
}

export function CourseAssignmentsTab({
  assignments,
  isLoading,
  isArchived,
  timezone,
  pendingAssignmentIds,
  onToggleStatus,
  onAddAssignment,
}: CourseAssignmentsTabProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Daftar Tugas Kuliah</h2>
          <p className="text-xs text-muted-foreground">
            Tenggat waktu dan status tugas yang terhubung dengan mata kuliah ini.
          </p>
        </div>
        <Button
          size="standard"
          onClick={onAddAssignment}
          disabled={isArchived}
          className="gap-1.5 shrink-0 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah tugas</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Belum ada tugas pada mata kuliah ini"
          description="Tambahkan tugas untuk mencatat deadline praktikum, proyek akhir, atau kuis."
          action={
            !isArchived && (
              <Button
                size="standard"
                variant="outline"
                onClick={onAddAssignment}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah tugas pertama</span>
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Desktop Assignments Table */}
          <Card className="hidden md:block overflow-hidden shadow-xs">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="px-4 py-3 w-12 text-center text-xs font-semibold uppercase">
                    Status
                  </TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                    Judul Tugas
                  </TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                    Tenggat Waktu
                  </TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                    Prioritas
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((asg) => {
                  const isDone = asg.status === 'DONE';
                  const isPending = pendingAssignmentIds.has(asg.id);

                  return (
                    <TableRow key={asg.id}>
                      <TableCell className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => onToggleStatus(asg)}
                          disabled={isArchived || isPending}
                          className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
                          title={isDone ? 'Tandai belum selesai' : 'Tandai selesai'}
                          aria-label={`Tandai tugas ${asg.title} ${isDone ? 'belum selesai' : 'selesai'}`}
                        >
                          {isPending ? (
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          ) : isDone ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <Circle className="h-5 w-5 hover:text-primary" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="px-4 py-3 max-w-[360px]">
                        <span
                          className={`font-medium break-words ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                        >
                          {asg.title}
                        </span>
                        {asg.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 break-words">
                            {asg.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                        {formatUserDateTime(asg.dueDate, timezone)}
                        {asg.isOverdue && !isDone && (
                          <span className="block text-destructive font-semibold mt-0.5">Terlambat</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant={
                            asg.priority === 'HIGH'
                              ? 'danger'
                              : asg.priority === 'MEDIUM'
                                ? 'default'
                                : 'secondary'
                          }
                          className="text-xs"
                        >
                          {asg.priority === 'HIGH'
                            ? 'Tinggi'
                            : asg.priority === 'MEDIUM'
                              ? 'Sedang'
                              : 'Rendah'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile Assignments Cards */}
          <div className="grid gap-2.5 md:hidden">
            {assignments.map((asg) => {
              const isDone = asg.status === 'DONE';
              const isPending = pendingAssignmentIds.has(asg.id);

              return (
                <Card
                  key={asg.id}
                  className="p-3.5 shadow-xs flex items-start gap-3"
                >
                  <button
                    type="button"
                    onClick={() => onToggleStatus(asg)}
                    disabled={isArchived || isPending}
                    className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-40 mt-0.5 shrink-0"
                    aria-label={`Tandai tugas ${asg.title} ${isDone ? 'belum selesai' : 'selesai'}`}
                  >
                    {isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Circle className="h-5 w-5 hover:text-primary" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm font-medium break-words ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                      >
                        {asg.title}
                      </p>
                      <Badge
                        variant={
                          asg.priority === 'HIGH'
                            ? 'danger'
                            : asg.priority === 'MEDIUM'
                              ? 'default'
                              : 'secondary'
                        }
                        className="text-xs shrink-0"
                      >
                        {asg.priority === 'HIGH'
                          ? 'Tinggi'
                          : asg.priority === 'MEDIUM'
                            ? 'Sedang'
                            : 'Rendah'}
                      </Badge>
                    </div>

                    {asg.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 break-words">
                        {asg.description}
                      </p>
                    )}

                    <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                      {formatUserDateTime(asg.dueDate, timezone)}
                      {asg.isOverdue && !isDone && (
                        <span className="text-destructive font-semibold ml-1.5">Terlambat</span>
                      )}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
