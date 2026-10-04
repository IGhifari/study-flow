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
