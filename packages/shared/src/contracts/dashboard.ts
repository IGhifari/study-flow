import { z } from 'zod';
import { SemesterSchema } from './semester.js';
import { CourseSchema } from './course.js';
import { AssignmentSchema } from './assignment.js';

import { MaterialListItemSchema } from './material.js';

export const DashboardSummarySchema = z.object({
  activeSemester: SemesterSchema.nullable(),
  totalCourses: z.number().int().nonnegative(),
  activeCourses: z.array(CourseSchema),
  assignmentsToday: z.array(AssignmentSchema),
  assignmentsUpcoming: z.array(AssignmentSchema),
  recentMaterials: z.array(MaterialListItemSchema).default([]),
  overdueCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  totalAssignments: z.number().int().nonnegative(),
  completionPercentage: z.number().min(0).max(100),
});
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;

export const DashboardChartPeriodSchema = z.enum(['7d', '30d', '3m']);
export type DashboardChartPeriod = z.infer<typeof DashboardChartPeriodSchema>;

export const ActivityBucketSchema = z.object({
  date: z.string(),
  label: z.string(),
  fullDateLabel: z.string(),
  tasksCompleted: z.number().int().nonnegative(),
  quizzesCompleted: z.number().int().nonnegative(),
});
export type ActivityBucket = z.infer<typeof ActivityBucketSchema>;

export const CourseWorkloadItemSchema = z.object({
  courseId: z.string(),
  courseName: z.string(),
  courseCode: z.string().nullable(),
  pendingTasks: z.number().int().nonnegative(),
});
export type CourseWorkloadItem = z.infer<typeof CourseWorkloadItemSchema>;

export const DashboardChartsResponseSchema = z.object({
  semesterId: z.string().nullable(),
  semesterName: z.string().nullable(),
  activityChart: z.object({
    period: DashboardChartPeriodSchema,
    grouping: z.enum(['daily', 'weekly']),
    items: z.array(ActivityBucketSchema),
    totalTasksCompleted: z.number().int().nonnegative(),
    totalQuizzesCompleted: z.number().int().nonnegative(),
    historyNotice: z.string().nullable(),
  }),
  workloadChart: z.object({
    items: z.array(CourseWorkloadItemSchema),
    totalPendingTasks: z.number().int().nonnegative(),
  }),
});
export type DashboardChartsResponse = z.infer<typeof DashboardChartsResponseSchema>;

export const DashboardPinnedQuerySchema = z.object({
  semesterId: z.string().optional(),
});
export type DashboardPinnedQuery = z.infer<typeof DashboardPinnedQuerySchema>;

export const DashboardChartsQuerySchema = z.object({
  period: DashboardChartPeriodSchema.default('30d'),
  semesterId: z.string().optional(),
});
export type DashboardChartsQuery = z.infer<typeof DashboardChartsQuerySchema>;

