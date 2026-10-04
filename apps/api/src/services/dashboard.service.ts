import { prisma } from '@studyflow/database';
import {
  DashboardSummary,
  getUserTodayRange,
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
    overdueCount,
    completedCount,
    totalAssignments,
    completionPercentage,
  };
}
