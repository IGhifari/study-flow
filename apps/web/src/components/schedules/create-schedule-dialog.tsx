'use client';

import * as React from 'react';
import {
  Course,
  CourseSchedule,
  CourseScheduleConflict,
  CreateCourseScheduleInput,
  DAY_NAMES_ID,
  getDayNameId,
} from '@studyflow/shared';
import { createSchedule } from '@/lib/schedule-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  RadixSelect as Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

export interface CreateScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: Course[];
  preselectedCourseId?: string;
  onSuccess: (
    newSchedule: CourseSchedule,
    hasConflict: boolean,
    conflicts?: CourseScheduleConflict[]
  ) => void;
}

export function CreateScheduleDialog({
  open,
  onOpenChange,
  courses,
  preselectedCourseId,
  onSuccess,
}: CreateScheduleDialogProps): React.JSX.Element {
  const [courseId, setCourseId] = React.useState('');
  const [dayOfWeek, setDayOfWeek] = React.useState('1');
  const [startTime, setStartTime] = React.useState('08:00');
  const [endTime, setEndTime] = React.useState('09:40');
  const [room, setRoom] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const wasOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      setErrorMsg(null);
      if (preselectedCourseId) {
        setCourseId(preselectedCourseId);
      } else if (courses.length > 0) {
        setCourseId(courses[0].id);
      } else {
        setCourseId('');
      }
      setDayOfWeek('1');
      setStartTime('08:00');
      setEndTime('09:40');
      setRoom('');
    }
    wasOpenRef.current = open;
  }, [open, preselectedCourseId, courses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const selectedCourseId = preselectedCourseId || courseId;
    if (!selectedCourseId) {
      setErrorMsg('Silakan pilih mata kuliah');
      return;
    }

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
      const input: CreateCourseScheduleInput = {
        courseId: selectedCourseId,
        dayOfWeek: parseInt(dayOfWeek, 10),
        startTime,
        endTime,
        room: room.trim() || null,
      };

      const res = await createSchedule(input);
      onOpenChange(false);
      onSuccess(res.schedule, res.hasConflict, res.conflicts);
    } catch (err: any) {
      // Retain user input on failure
      setErrorMsg(err.message || 'Gagal menambahkan jadwal kuliah');
    } finally {
      setIsSubmitting(false);
    }
  };

  const dayOptions = [1, 2, 3, 4, 5, 6, 7].map((dayNum) => ({
    value: String(dayNum),
    label: getDayNameId(dayNum),
  }));

  const selectedCourse = courses.find((c) => c.id === (preselectedCourseId || courseId));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Jadwal Kuliah</DialogTitle>
          <DialogDescription>
            Masukkan jadwal perkuliahan mingguan untuk mata kuliah aktif.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {errorMsg && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Gagal Menyimpan Jadwal</AlertTitle>
              <AlertDescription className="text-xs break-words">{errorMsg}</AlertDescription>
            </Alert>
          )}

          {/* Pemilihan Mata Kuliah */}
          <div className="space-y-1.5">
            <Label htmlFor="schedule-course" className="text-xs font-semibold text-foreground">
              Mata Kuliah <span className="text-destructive">*</span>
            </Label>
            {preselectedCourseId ? (
              <Input
                id="schedule-course"
                disabled
                value={
                  selectedCourse
                    ? `${selectedCourse.name}${selectedCourse.code ? ` (${selectedCourse.code})` : ''}`
                    : 'Mata Kuliah Terpilih'
                }
                className="h-9 bg-muted/40 font-medium"
              />
            ) : (
              <Select
                value={courseId}
                onValueChange={(val) => setCourseId(val)}
                disabled={isSubmitting || courses.length === 0}
              >
                <SelectTrigger id="schedule-course" className="h-9 w-full">
                  <SelectValue
                    placeholder={
                      courses.length === 0
                        ? 'Belum ada mata kuliah aktif di semester ini'
                        : 'Pilih mata kuliah aktif'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((crs) => (
                    <SelectItem key={crs.id} value={crs.id}>
                      {crs.name}
                      {crs.code ? ` (${crs.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              Semester mengikuti semester mata kuliah terpilih secara otomatis.
            </p>
          </div>

          {/* Hari */}
          <div className="space-y-1.5">
            <Label htmlFor="schedule-day" className="text-xs font-semibold text-foreground">
              Hari Perkuliahan <span className="text-destructive">*</span>
            </Label>
            <Select
              value={dayOfWeek}
              onValueChange={(val) => setDayOfWeek(val)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="schedule-day" className="h-9 w-full">
                <SelectValue placeholder="Pilih hari perkuliahan" />
              </SelectTrigger>
              <SelectContent>
                {dayOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Rentang Jam (Mulai & Selesai) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="schedule-start-time" className="text-xs font-semibold text-foreground">
                Waktu Mulai <span className="text-destructive">*</span>
              </Label>
              <Input
                id="schedule-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={isSubmitting}
                className="h-9"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="schedule-end-time" className="text-xs font-semibold text-foreground">
                Waktu Selesai <span className="text-destructive">*</span>
              </Label>
              <Input
                id="schedule-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={isSubmitting}
                className="h-9"
                required
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Waktu lokal mingguan berulang (24 jam). Sesi harus selesai di hari yang sama.
          </p>

          {/* Ruangan / Lokasi */}
          <div className="space-y-1.5">
            <Label htmlFor="schedule-room" className="text-xs font-semibold text-foreground">
              Ruangan / Lokasi <span className="text-xs font-normal text-muted-foreground">(Opsional)</span>
            </Label>
            <Input
              id="schedule-room"
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
              disabled={isSubmitting || (!preselectedCourseId && courses.length === 0)}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Jadwal</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
