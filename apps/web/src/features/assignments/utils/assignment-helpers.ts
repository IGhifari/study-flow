import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import {
  type Assignment,
  getUserTodayRange,
  PRIORITY_LABELS,
} from '@studyflow/shared';

export { PRIORITY_LABELS };

export interface DeadlineStatusInfo {
  type: 'DONE' | 'OVERDUE' | 'TODAY' | 'UPCOMING';
  label: string;
  icon: LucideIcon;
  badgeClass: string;
}

export function getDeadlineStatusInfo(
  asg: Assignment,
  timezone: string
): DeadlineStatusInfo {
  if (asg.status === 'DONE') {
    return {
      type: 'DONE',
      label: 'Selesai',
      icon: CheckCircle2,
      badgeClass:
        'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
    };
  }

  if (asg.isOverdue) {
    return {
      type: 'OVERDUE',
      label: 'Terlambat',
      icon: AlertTriangle,
      badgeClass:
        'bg-destructive/10 text-destructive border border-destructive/20 font-semibold',
    };
  }

  try {
    const { startOfToday, endOfToday } = getUserTodayRange(new Date(), timezone);
    const dueTime = new Date(asg.dueDate).getTime();
    if (dueTime >= startOfToday.getTime() && dueTime <= endOfToday.getTime()) {
      return {
        type: 'TODAY',
        label: 'Hari ini',
        icon: Clock,
        badgeClass:
          'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-medium',
      };
    }
  } catch {
    // fallback if calculation fails
  }

  return {
    type: 'UPCOMING',
    label: 'Mendatang',
    icon: Calendar,
    badgeClass: 'bg-muted/80 text-muted-foreground border border-border',
  };
}
