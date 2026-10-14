import { prisma } from '@studyflow/database';
import {
  DashboardSummary,
  DashboardChartsResponse,
  CourseWorkloadItem,
  getUserTodayRange,
  getLocalComponents,
  localComponentsToUtc,
  Assignment,
  Course,
  Semester,
} from '@studyflow/shared';

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const timezone = user?.timezone || 'Asia/Jakarta';

  // 1. Find active semester
  const activeSemester = await prisma.semester.findFirst({
    where: {
      userId,
      isActive: true,
      archivedAt: null,
    },
  });

  if (!activeSemester) {
    return {
      activeSemester: null,
      totalCourses: 0,
      activeCourses: [],
      assignmentsToday: [],
      assignmentsUpcoming: [],
      recentMaterials: [],
      overdueCount: 0,
      completedCount: 0,
      totalAssignments: 0,
      completionPercentage: 0,
    };
  }

  // 2. Find active (non-archived) courses in this active semester
  const courses = await prisma.course.findMany({
    where: {
      userId,
      semesterId: activeSemester.id,
      archivedAt: null,
    },
    orderBy: { name: 'asc' },
  });

  const courseIds = courses.map((c) => c.id);

  if (courseIds.length === 0) {
    return {
      activeSemester: {
        id: activeSemester.id,
        userId: activeSemester.userId,
        name: activeSemester.name,
        academicYear: activeSemester.academicYear,
        isActive: activeSemester.isActive,
        archivedAt: null,
        createdAt: activeSemester.createdAt.toISOString(),
        updatedAt: activeSemester.updatedAt.toISOString(),
      },
      totalCourses: 0,
      activeCourses: [],
      assignmentsToday: [],
      assignmentsUpcoming: [],
      recentMaterials: [],
      overdueCount: 0,
      completedCount: 0,
      totalAssignments: 0,
      completionPercentage: 0,
    };
  }

  // 3. Time calculations based on user's profile timezone
  const now = new Date();
  const { startOfToday, endOfToday, endOf7Days } = getUserTodayRange(now, timezone);

  // 4. Fetch all assignments in active courses
  const allAssignments = await prisma.assignment.findMany({
    where: {
      userId,
      courseId: { in: courseIds },
    },
    include: {
      course: {
        include: {
          semester: true,
        },
      },
    },
    orderBy: [
      { dueDate: 'asc' },
      { id: 'asc' },
    ],
  });

  const assignmentIds = allAssignments.map((a) => a.id);
  const subtaskCountMap: Record<string, { total: number; completed: number }> = {};

  if (assignmentIds.length > 0) {
    const grouped = await prisma.assignmentSubtask.groupBy({
      by: ['assignmentId', 'isCompleted'],
      where: { assignmentId: { in: assignmentIds } },
      _count: { _all: true },
    });

    for (const item of grouped) {
      const current = subtaskCountMap[item.assignmentId] || { total: 0, completed: 0 };
      current.total += item._count._all;
      if (item.isCompleted) {
        current.completed += item._count._all;
      }
      subtaskCountMap[item.assignmentId] = current;
    }
  }

  let overdueCount = 0;
  let completedCount = 0;
  const assignmentsToday: Assignment[] = [];
  const assignmentsUpcoming: Assignment[] = [];

  for (const raw of allAssignments) {
    const isCompleted = raw.status === 'DONE';
    const isOverdue = !isCompleted && raw.dueDate.getTime() < now.getTime();

    if (isCompleted) {
      completedCount++;
    } else if (isOverdue) {
      overdueCount++;
    }

    const item: Assignment = {
      id: raw.id,
      userId: raw.userId,
      courseId: raw.courseId,
      title: raw.title,
      description: raw.description,
      dueDate: raw.dueDate.toISOString(),
      priority: raw.priority,
      status: raw.status,
      completedAt: raw.completedAt ? raw.completedAt.toISOString() : null,
      isOverdue,
      subtaskCount: subtaskCountMap[raw.id] || { total: 0, completed: 0 },
      course: raw.course
        ? {
            id: raw.course.id,
            userId: raw.course.userId,
            semesterId: raw.course.semesterId,
            name: raw.course.name,
            code: raw.course.code,
            lecturer: raw.course.lecturer,
            description: raw.course.description,
            archivedAt: raw.course.archivedAt ? raw.course.archivedAt.toISOString() : null,
            createdAt: raw.course.createdAt.toISOString(),
            updatedAt: raw.course.updatedAt.toISOString(),
          }
        : undefined,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString(),
    };

    if (!isCompleted) {
      const dueTime = raw.dueDate.getTime();
      // Due today: startOfToday <= dueDate <= endOfToday
      if (dueTime >= startOfToday.getTime() && dueTime <= endOfToday.getTime()) {
        assignmentsToday.push(item);
      }
      // Upcoming next 7 calendar days: endOfToday < dueDate <= endOf7Days
      else if (dueTime > endOfToday.getTime() && dueTime <= endOf7Days.getTime()) {
        assignmentsUpcoming.push(item);
      }
    }
  }

  const totalAssignments = allAssignments.length;
  const completionPercentage =
    totalAssignments > 0 ? Math.round((completedCount / totalAssignments) * 100) : 0;

  // 5. Fetch up to 5 most recent non-deleted materials in active semester courses
  const recentMaterialsRaw = await prisma.material.findMany({
    where: {
      userId,
      courseId: { in: courseIds },
      deletedAt: null,
    },
    include: {
      course: {
        include: { semester: true },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    take: 5,
  });

  const recentMaterials = recentMaterialsRaw.map((m) => ({
    id: m.id,
    userId: m.userId,
    courseId: m.courseId,
    title: m.title,
    originalFilename: m.originalFilename,
    mimeType: m.mimeType,
    bytes: m.bytes,
    pageCount: m.pageCount,
    status: m.status,
    errorCode: m.errorCode,
    errorMessage: m.errorMessage,
    course: m.course
      ? {
          id: m.course.id,
          userId: m.course.userId,
          semesterId: m.course.semesterId,
          name: m.course.name,
          code: m.course.code,
          lecturer: m.course.lecturer,
          description: m.course.description,
          archivedAt: null,
          createdAt: m.course.createdAt.toISOString(),
          updatedAt: m.course.updatedAt.toISOString(),
        }
      : undefined,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
  }));

  const activeCoursesResponse: Course[] = courses.map((c) => ({
    id: c.id,
    userId: c.userId,
    semesterId: c.semesterId,
    name: c.name,
    code: c.code,
    lecturer: c.lecturer,
    description: c.description,
    archivedAt: null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  const activeSemesterResponse: Semester = {
    id: activeSemester.id,
    userId: activeSemester.userId,
    name: activeSemester.name,
    academicYear: activeSemester.academicYear,
    isActive: activeSemester.isActive,
    archivedAt: null,
    createdAt: activeSemester.createdAt.toISOString(),
    updatedAt: activeSemester.updatedAt.toISOString(),
  };

  return {
    activeSemester: activeSemesterResponse,
    totalCourses: courses.length,
    activeCourses: activeCoursesResponse,
    assignmentsToday,
    assignmentsUpcoming,
    recentMaterials,
    overdueCount,
    completedCount,
    totalAssignments,
    completionPercentage,
  };
}

export interface GetDashboardChartsOptions {
  period?: '7d' | '30d' | '3m';
  semesterId?: string;
}

const ID_MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
];

const ID_MONTH_NAMES_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const ID_DAY_NAMES = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
];

interface InternalBucket {
  date: string;
  label: string;
  fullDateLabel: string;
  startUtc: Date;
  endUtc: Date;
  tasksCompleted: number;
  quizzesCompleted: number;
}

export async function getDashboardCharts(
  userId: string,
  options: GetDashboardChartsOptions = {}
): Promise<DashboardChartsResponse> {
  const period = options.period || '30d';
  if (!['7d', '30d', '3m'].includes(period)) {
    const error: any = new Error('Parameter period harus berupa 7d, 30d, atau 3m');
    error.statusCode = 400;
    error.code = 'INVALID_PERIOD';
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const timezone = user?.timezone || 'Asia/Jakarta';

  // 1. Tentukan semester yang digunakan
  let targetSemester: { id: string; name: string } | null = null;
  if (options.semesterId) {
    const sem = await prisma.semester.findFirst({
      where: {
        id: options.semesterId,
        userId,
      },
      select: { id: true, name: true },
    });
    if (!sem) {
      const error: any = new Error('Semester tidak ditemukan');
      error.statusCode = 404;
      error.code = 'SEMESTER_NOT_FOUND';
      throw error;
    }
    targetSemester = sem;
  } else {
    const activeSem = await prisma.semester.findFirst({
      where: {
        userId,
        isActive: true,
        archivedAt: null,
      },
      select: { id: true, name: true },
    });
    targetSemester = activeSem;
  }

  // Jika tidak ada semester aktif / ditemukan
  if (!targetSemester) {
    return {
      semesterId: null,
      semesterName: null,
      activityChart: {
        period,
        grouping: period === '3m' ? 'weekly' : 'daily',
        items: [],
        totalTasksCompleted: 0,
        totalQuizzesCompleted: 0,
        historyNotice: 'Belum ada semester aktif yang dipilih.',
      },
      workloadChart: {
        items: [],
        totalPendingTasks: 0,
      },
    };
  }

  // 2. Cari semua mata kuliah aktif di semester tersebut
  const courses = await prisma.course.findMany({
    where: {
      userId,
      semesterId: targetSemester.id,
      archivedAt: null,
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: { name: 'asc' },
  });

  const courseIds = courses.map((c) => c.id);

  // 3. Hitung Beban Tugas (Workload Chart) secara teragregasi
  let workloadItems: CourseWorkloadItem[] = [];
  let totalPendingTasks = 0;

  if (courseIds.length > 0) {
    const pendingGroupBy = await prisma.assignment.groupBy({
      by: ['courseId'],
      where: {
        userId,
        courseId: { in: courseIds },
        status: { in: ['TODO', 'IN_PROGRESS'] },
      },
      _count: { id: true },
    });

    const pendingMap = new Map(pendingGroupBy.map((g) => [g.courseId, g._count.id]));

    workloadItems = courses.map((c) => {
      const pendingCount = pendingMap.get(c.id) || 0;
      totalPendingTasks += pendingCount;
      return {
        courseId: c.id,
        courseName: c.name,
        courseCode: c.code,
        pendingTasks: pendingCount,
      };
    });

    // Urutkan terbanyak secara menurun; jika sama urutkan alfabetis nama mata kuliah (stabil)
    workloadItems.sort((a, b) => {
      if (b.pendingTasks !== a.pendingTasks) {
        return b.pendingTasks - a.pendingTasks;
      }
      return a.courseName.localeCompare(b.courseName, 'id');
    });
  }

  // 4. Bangun Rentang Waktu dan Bucket untuk Aktivitas Belajar
  const now = new Date();
  const todayComp = getLocalComponents(now, timezone);
  const buckets: InternalBucket[] = [];
  const grouping: 'daily' | 'weekly' = period === '3m' ? 'weekly' : 'daily';

  if (period === '7d' || period === '30d') {
    const countDays = period === '7d' ? 7 : 30;
    for (let i = countDays - 1; i >= 0; i--) {
      const dObj = new Date(Date.UTC(todayComp.year, todayComp.month - 1, todayComp.day - i));
      const y = dObj.getUTCFullYear();
      const m = dObj.getUTCMonth() + 1;
      const d = dObj.getUTCDate();
      const dayOfWeek = dObj.getUTCDay();

      const startUtc = localComponentsToUtc(y, m, d, 0, 0, 0, timezone);
      const endUtc = localComponentsToUtc(y, m, d, 23, 59, 59, timezone);

      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const label = `${d} ${ID_MONTH_NAMES_SHORT[m - 1]}`;
      const fullDateLabel = `${ID_DAY_NAMES[dayOfWeek]}, ${d} ${ID_MONTH_NAMES_FULL[m - 1]} ${y}`;

      buckets.push({
        date: dateStr,
        label,
        fullDateLabel,
        startUtc,
        endUtc,
        tasksCompleted: 0,
        quizzesCompleted: 0,
      });
    }
  } else {
    // 3m: bulan berjalan sampai hari ini + dua bulan kalender sebelumnya, mingguan mulai Senin
    let startYear = todayComp.year;
    let startMonth = todayComp.month - 2;
    if (startMonth <= 0) {
      startMonth += 12;
      startYear -= 1;
    }

    const firstDayObj = new Date(Date.UTC(startYear, startMonth - 1, 1));
    const firstDayWeekday = firstDayObj.getUTCDay(); // 0 = Min, 1 = Sen, ...
    const daysBackToMonday = firstDayWeekday === 0 ? 6 : firstDayWeekday === 1 ? 0 : firstDayWeekday - 1;
    const monday1Obj = new Date(Date.UTC(startYear, startMonth - 1, 1 - daysBackToMonday));
    const todayUtcTime = Date.UTC(todayComp.year, todayComp.month - 1, todayComp.day);

    let currentMonday = new Date(monday1Obj.getTime());
    while (currentMonday.getTime() <= todayUtcTime) {
      const mY = currentMonday.getUTCFullYear();
      const mM = currentMonday.getUTCMonth() + 1;
      const mD = currentMonday.getUTCDate();
      const startUtc = localComponentsToUtc(mY, mM, mD, 0, 0, 0, timezone);

      const sundayObj = new Date(Date.UTC(mY, mM - 1, mD + 6));
      const sY = sundayObj.getUTCFullYear();
      const sM = sundayObj.getUTCMonth() + 1;
      const sD = sundayObj.getUTCDate();
      const endUtc = localComponentsToUtc(sY, sM, sD, 23, 59, 59, timezone);

      let label = '';
      let fullDateLabel = '';
      if (mY === sY && mM === sM) {
        label = `${mD} - ${sD} ${ID_MONTH_NAMES_SHORT[mM - 1]}`;
        fullDateLabel = `${mD} - ${sD} ${ID_MONTH_NAMES_FULL[mM - 1]} ${mY}`;
      } else if (mY === sY) {
        label = `${mD} ${ID_MONTH_NAMES_SHORT[mM - 1]} - ${sD} ${ID_MONTH_NAMES_SHORT[sM - 1]}`;
        fullDateLabel = `${mD} ${ID_MONTH_NAMES_FULL[mM - 1]} - ${sD} ${ID_MONTH_NAMES_FULL[sM - 1]} ${mY}`;
      } else {
        label = `${mD} ${ID_MONTH_NAMES_SHORT[mM - 1]} ${mY} - ${sD} ${ID_MONTH_NAMES_SHORT[sM - 1]} ${sY}`;
        fullDateLabel = `${mD} ${ID_MONTH_NAMES_FULL[mM - 1]} ${mY} - ${sD} ${ID_MONTH_NAMES_FULL[sM - 1]} ${sY}`;
      }

      const dateKey = `${mY}-${String(mM).padStart(2, '0')}-${String(mD).padStart(2, '0')}`;
      buckets.push({
        date: dateKey,
        label,
        fullDateLabel,
        startUtc,
        endUtc,
        tasksCompleted: 0,
        quizzesCompleted: 0,
      });

      currentMonday = new Date(Date.UTC(mY, mM - 1, mD + 7));
    }
  }

  // 5. Query Aktivitas Belajar
  let totalTasksCompleted = 0;
  let totalQuizzesCompleted = 0;

  if (courseIds.length > 0 && buckets.length > 0) {
    const rangeStartUtc = buckets[0]!.startUtc;
    const rangeEndUtc = buckets[buckets.length - 1]!.endUtc;

    const [completedAssignments, submittedQuizzes] = await Promise.all([
      prisma.assignment.findMany({
        where: {
          userId,
          courseId: { in: courseIds },
          firstCompletedAt: {
            gte: rangeStartUtc,
            lte: rangeEndUtc,
          },
        },
        select: {
          id: true,
          firstCompletedAt: true,
        },
      }),
      prisma.quizAttempt.findMany({
        where: {
          userId,
          submittedAt: {
            gte: rangeStartUtc,
            lte: rangeEndUtc,
          },
          quiz: {
            material: {
              courseId: { in: courseIds },
            },
          },
        },
        select: {
          id: true,
          submittedAt: true,
        },
      }),
    ]);

    totalTasksCompleted = completedAssignments.length;
    totalQuizzesCompleted = submittedQuizzes.length;

    // Masukkan tugas ke bucket
    for (const asg of completedAssignments) {
      if (!asg.firstCompletedAt) continue;
      const t = asg.firstCompletedAt.getTime();
      const targetBucket = buckets.find(
        (b) => t >= b.startUtc.getTime() && t <= b.endUtc.getTime()
      );
      if (targetBucket) {
        targetBucket.tasksCompleted += 1;
      }
    }

    // Masukkan kuis ke bucket
    for (const attempt of submittedQuizzes) {
      if (!attempt.submittedAt) continue;
      const t = attempt.submittedAt.getTime();
      const targetBucket = buckets.find(
        (b) => t >= b.startUtc.getTime() && t <= b.endUtc.getTime()
      );
      if (targetBucket) {
        targetBucket.quizzesCompleted += 1;
      }
    }
  }

  const activityChartItems = buckets.map((b) => ({
    date: b.date,
    label: b.label,
    fullDateLabel: b.fullDateLabel,
    tasksCompleted: b.tasksCompleted,
    quizzesCompleted: b.quizzesCompleted,
  }));

  return {
    semesterId: targetSemester.id,
    semesterName: targetSemester.name,
    activityChart: {
      period,
      grouping,
      items: activityChartItems,
      totalTasksCompleted,
      totalQuizzesCompleted,
      historyNotice:
        'Satu tugas dihitung maksimal 1 kali pada penyelesaian pertama. Kuis dihitung per attempt yang telah diselesaikan (submit final).',
    },
    workloadChart: {
      items: workloadItems,
      totalPendingTasks,
    },
  };
}

