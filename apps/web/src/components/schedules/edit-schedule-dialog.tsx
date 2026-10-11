'use client';

import * as React from 'react';
import {
  CourseSchedule,
  CourseScheduleConflict,
  UpdateCourseScheduleInput,
  getDayNameId,
} from '@studyflow/shared';
import { updateSchedule } from '@/lib/schedule-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export interface EditScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: CourseSchedule | null;
  onSuccess: (
    updatedSchedule: CourseSchedule,
    hasConflict: boolean,
    conflicts?: CourseScheduleConflict[]
  ) => void;
}

export function EditScheduleDialog({
  open,
  onOpenChange,
  schedule,
  onSuccess,
}: EditScheduleDialogProps): React.JSX.Element {
  const [dayOfWeek, setDayOfWeek] = React.useState('1');
  const [startTime, setStartTime] = React.useState('08:00');
  const [endTime, setEndTime] = React.useState('09:40');
  const [room, setRoom] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (schedule && open) {
      setErrorMsg(null);
      setDayOfWeek(String(schedule.dayOfWeek));
      setStartTime(schedule.startTime);
      setEndTime(schedule.endTime);
      setRoom(schedule.room || '');
    }
  }, [schedule, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedule) return;
    setErrorMsg(null);

    if (!startTime) {
      setErrorMsg('Waktu mulai wajib diisi');
      return;
    }
    if (!endTime) {
      setErrorMsg('Waktu selesai wajib diisi');
      return;
    }

    if (startTime === endTime) {
      setErrorMsg('Waktu selesai harus lebih besar daripada waktu mulai');
      return;
    }

    if (startTime > endTime) {
      setErrorMsg(
        'Sesi jadwal lintas tengah malam belum didukung. Harap tentukan waktu mulai dan selesai dalam hari yang sama.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const input: UpdateCourseScheduleInput = {
        dayOfWeek: parseInt(dayOfWeek, 10),
        startTime,
        endTime,
        room: room.trim() || null,
      };

      const res = await updateSchedule(schedule.id, input);
      onOpenChange(false);
      onSuccess(res.schedule, res.hasConflict, res.conflicts);
    } catch (err: any) {
      // Retain user input on failure
      setErrorMsg(err.message || 'Gagal memperbarui jadwal kuliah');
    } finally {
      setIsSubmitting(false);
    }
  };

  const dayOptions = [1, 2, 3, 4, 5, 6, 7].map((dayNum) => ({
    value: String(dayNum),
    label: getDayNameId(dayNum),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Jadwal Kuliah</DialogTitle>
          <DialogDescription>
            Perbarui waktu atau ruangan perkuliahan untuk mata kuliah ini.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {errorMsg && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Gagal Menyimpan Perubahan</AlertTitle>
              <AlertDescription className="text-xs break-words">{errorMsg}</AlertDescription>
            </Alert>
          )}

          {/* Mata Kuliah (Informasi Tetap) */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-schedule-course" className="text-xs font-semibold text-foreground">
              Mata Kuliah
            </Label>
            <Input
              id="edit-schedule-course"
              disabled
              value={
                schedule?.course
                  ? `${schedule.course.name}${schedule.course.code ? ` (${schedule.course.code})` : ''}`
                  : 'Mata Kuliah'
              }
              className="h-9 bg-muted/40 font-medium"
            />
          </div>

          {/* Hari */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-schedule-day" className="text-xs font-semibold text-foreground">
              Hari Perkuliahan <span className="text-destructive">*</span>
            </Label>
            <NativeSelect
              id="edit-schedule-day"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value)}
              disabled={isSubmitting}
              className="h-9"
              required
            >
              {dayOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          {/* Rentang Jam (Mulai & Selesai) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-schedule-start-time" className="text-xs font-semibold text-foreground">
                Waktu Mulai <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-schedule-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={isSubmitting}
                className="h-9"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-schedule-end-time" className="text-xs font-semibold text-foreground">
                Waktu Selesai <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-schedule-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={isSubmitting}
                className="h-9"
                required
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Waktu lokal mingguan berulang (24 jam). Sesi harus selesai di hari yang sama.
          </p>

          {/* Ruangan / Lokasi */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-schedule-room" className="text-xs font-semibold text-foreground">
              Ruangan / Lokasi <span className="text-xs font-normal text-muted-foreground">(Opsional)</span>
            </Label>
            <Input
              id="edit-schedule-room"
              placeholder="Contoh: Lab Komputer 3, R.204, atau Daring"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              disabled={isSubmitting}
              maxLength={100}
              className="h-9"
            />
          </div>

          <DialogFooter className="pt-3 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="standard"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="default"
              size="standard"
              disabled={isSubmitting}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Perubahan</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
