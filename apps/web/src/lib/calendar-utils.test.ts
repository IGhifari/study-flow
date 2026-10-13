import { describe, it, expect } from 'vitest';
import {
  getMonthGridRange,
  getWeekRange,
  formatMonthHeader,
  formatWeekHeader,
  groupEventsByDate,
  formatAgendaDateHeader,
} from './calendar-utils';
import { CalendarEvent } from '@studyflow/shared';

describe('Calendar Client Utilities', () => {
  it('menghasilkan grid bulanan Oktober 2026 yang dimulai dari hari Senin dan berakhir Minggu', () => {
    // Oktober 2026: 1 Okt = Kamis (iso 4). Senin awal grid = 28 Sep 2026.
    // 31 Okt = Sabtu (iso 6). Minggu akhir grid = 1 Nov 2026.
    const { startDate, endDate, days } = getMonthGridRange(2026, 10);

    expect(startDate).toBe('2026-09-28');
    expect(endDate).toBe('2026-11-02'); // eksklusif
    expect(days[0]).toBe('2026-09-28');
    expect(days[days.length - 1]).toBe('2026-11-01');
    expect(days.length).toBe(35); // 5 minggu x 7 hari = 35 hari
  });

  it('menghasilkan rentang mingguan 7 hari (Senin s/d Minggu)', () => {
    // Rabu 14 Okt 2026 -> Senin 12 Okt s/d Minggu 18 Okt
    const { startDate, endDate, days } = getWeekRange('2026-10-14');

    expect(startDate).toBe('2026-10-12');
    expect(endDate).toBe('2026-10-19'); // eksklusif
    expect(days).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ]);
  });

  it('memformat header bulan dan rentang minggu dengan benar dalam Bahasa Indonesia', () => {
    expect(formatMonthHeader(2026, 10)).toBe('Oktober 2026');
    expect(formatWeekHeader('2026-10-12', '2026-10-18')).toBe('12 – 18 Okt 2026');
    expect(formatAgendaDateHeader('2026-10-14')).toBe('Rabu, 14 Oktober 2026');
  });

  it('mengelompokkan events berdasarkan tanggal dengan tepat', () => {
    const mockEvents: CalendarEvent[] = [
      {
        id: 'ev-1',
        type: 'SCHEDULE',
        title: 'Kalkulus I',
        courseId: 'c-1',
        courseName: 'Kalkulus I',
        courseCode: 'CS101',
        date: '2026-10-14',
        startTime: '08:00',
        endTime: '10:00',
      },
      {
        id: 'ev-2',
        type: 'ASSIGNMENT',
        title: 'Tugas Deret',
        courseId: 'c-1',
        courseName: 'Kalkulus I',
        courseCode: 'CS101',
        date: '2026-10-14',
        dueTime: '23:59',
      },
      {
        id: 'ev-3',
        type: 'SCHEDULE',
        title: 'Fisika Dasar',
        courseId: 'c-2',
        courseName: 'Fisika Dasar',
        courseCode: 'PHYS101',
        date: '2026-10-15',
        startTime: '13:00',
        endTime: '15:00',
      },
    ];

    const grouped = groupEventsByDate(mockEvents);
    expect(Object.keys(grouped)).toEqual(['2026-10-14', '2026-10-15']);
    expect(grouped['2026-10-14']).toHaveLength(2);
    expect(grouped['2026-10-15']).toHaveLength(1);
  });
});
