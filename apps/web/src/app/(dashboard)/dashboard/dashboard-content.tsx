'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  CalendarRange,
  BookOpen,
  Plus,
  ArrowRight,
  User,
  AlertCircle,
  Loader2,
  Calendar,
  Layers,
} from 'lucide-react';
import { Semester, Course, UserProfile } from '@studyflow/shared';
import { listSemesters } from '@/lib/semester-client';
import { listCourses } from '@/lib/course-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

interface DashboardContentProps {
  user: UserProfile;
}

export function DashboardContent({ user }: DashboardContentProps): React.JSX.Element {
  const [semesters, setSemesters] = React.useState<Semester[]>([]);
  const [activeSemester, setActiveSemester] = React.useState<Semester | null>(null);
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadDashboardData() {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const semData = await listSemesters('all');
        setSemesters(semData.semesters);
        setActiveSemester(semData.activeSemester);

        if (semData.activeSemester) {
          const courseData = await listCourses({
            semesterId: semData.activeSemester.id,
            isArchived: false,
          });
          setCourses(courseData.courses);
        } else {
          setCourses([]);
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat ringkasan dashboard');
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 mb-2">
              <Badge variant="outline" className="gap-1.5 py-0.5 text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Sesi Aktif
              </Badge>
              {activeSemester && (
                <Badge variant="secondary" className="gap-1 py-0.5 text-xs font-normal">
                  <CalendarRange className="h-3 w-3" />
                  {activeSemester.name}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Halo, {user.name}!
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Selamat datang di ruang belajar pribadimu. Kelola semester dan mata kuliah dengan terstruktur.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/semesters" className="gap-2">
                <CalendarRange className="h-4 w-4" />
                <span>Kelola Semester</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger-foreground">
          <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="mt-3 text-sm">Menyiapkan ringkasan perkuliahan...</p>
        </div>
      ) : semesters.length === 0 ? (
        /* State 1: Belum ada semester */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CalendarRange className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">
              Mulai Perjalanan Belajarmu
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Tambahkan semester perkuliahan pertamamu untuk mulai mengorganisasi mata kuliah dan bahan belajar.
            </p>
            <Button asChild className="mt-6 gap-2">
              <Link href="/semesters">
                <Plus className="h-4 w-4" />
                <span>Tambah Semester Pertama</span>
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : !activeSemester ? (
        /* State 2: Semester ada, belum ada yang aktif */
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm font-semibold">
              <AlertCircle className="h-4 w-4" />
              <span>Belum Ada Semester Aktif</span>
            </div>
            <CardTitle className="text-lg">Pilih Semester yang Sedang Berjalan</CardTitle>
            <CardDescription>
              Anda memiliki {semesters.length} semester terdaftar, namun belum ada semester yang dipilih sebagai aktif.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="gap-2">
              <Link href="/semesters">
                <span>Pilih Semester Aktif</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : courses.length === 0 ? (
        /* State 3: Semester aktif ada, belum ada mata kuliah */
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Semester Aktif: {activeSemester.name}
                  </CardTitle>
                  <CardDescription>
                    Tahun Ajaran: {activeSemester.academicYear}
                  </CardDescription>
                </div>
                <Badge variant="default" className="bg-primary text-primary-foreground">
                  Aktif
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg border-dashed bg-muted/20">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-foreground">
                  Belum Ada Mata Kuliah di Semester Ini
                </h3>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Tambahkan mata kuliah yang Anda ambil pada semester ini untuk mulai mengelola jadwal dan materi.
                </p>
                <Button asChild size="sm" className="mt-4 gap-1.5">
                  <Link href="/courses">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Tambah Mata Kuliah</span>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* State 4: Semester aktif & mata kuliah tersedia */
        <div className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Mata Kuliah Semester Ini ({activeSemester.name})
              </h2>
              <p className="text-xs text-muted-foreground">
                Tahun Ajaran {activeSemester.academicYear} • {courses.length} mata kuliah terdaftar
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/courses" className="gap-1.5">
                  <span>Lihat Semua</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.id} className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="truncate text-base font-semibold">
                      <Link
                        href={`/courses/${course.id}`}
                        className="hover:text-primary transition-colors"
                      >
                        {course.name}
                      </Link>
                    </CardTitle>
                    {course.code && (
                      <Badge variant="outline" className="font-mono text-[11px] shrink-0">
                        {course.code}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {course.lecturer ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{course.lecturer}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic">
                      Dosen belum ditentukan
                    </div>
                  )}

                  <div className="border-t border-border pt-2.5">
                    <Button asChild size="sm" variant="ghost" className="w-full justify-between text-xs px-2">
                      <Link href={`/courses/${course.id}`}>
                        <span>Buka Detail</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Info Box Akun */}
      <div className="grid gap-4 sm:grid-cols-2 pt-2">
        <div className="rounded-lg border border-border/70 bg-card p-4">
          <div className="flex items-center gap-2.5 font-medium text-foreground text-sm">
            <Calendar className="h-4 w-4 text-primary" />
            <span>Zona Waktu Akun</span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            Zona waktu saat ini: <strong className="text-foreground">{user.timezone}</strong>.
            Seluruh aktivitas dan pengelompokan semester mengikuti zona waktu ini.
          </p>
        </div>

        <div className="rounded-lg border border-border/70 bg-card p-4">
          <div className="flex items-center gap-2.5 font-medium text-foreground text-sm">
            <Layers className="h-4 w-4 text-primary" />
            <span>Fasilitas Belajar Mandiri</span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            Ruang belajar terisolasi untuk data pribadi Anda. Data antar-mahasiswa aman dan terpisah sepenuhnya.
          </p>
        </div>
      </div>
    </div>
  );
}
