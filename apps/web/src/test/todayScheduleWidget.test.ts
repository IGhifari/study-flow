import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getScheduleTimeStatus,
  getNowInTimezone,
} from '../components/dashboard/today-schedule-widget';

describe('Today Schedule Widget Unit Tests', () => {
  describe('1. getScheduleTimeStatus (Perhitungan Status Waktu Sesi)', () => {
    it('mengembalikan "UPCOMING" jika waktu saat ini sebelum waktu mulai (currentTime < startTime)', () => {
      expect(getScheduleTimeStatus('08:00', '09:40', '07:59')).toBe('UPCOMING');
      expect(getScheduleTimeStatus('08:00', '09:40', '00:00')).toBe('UPCOMING');
      expect(getScheduleTimeStatus('14:00', '15:40', '13:59')).toBe('UPCOMING');
    });

    it('mengembalikan "ONGOING" jika tepat pada waktu mulai (currentTime === startTime)', () => {
      expect(getScheduleTimeStatus('08:00', '09:40', '08:00')).toBe('ONGOING');
      expect(getScheduleTimeStatus('13:30', '15:10', '13:30')).toBe('ONGOING');
    });

    it('mengembalikan "ONGOING" jika di antara waktu mulai dan selesai (startTime < currentTime < endTime)', () => {
      expect(getScheduleTimeStatus('08:00', '09:40', '08:01')).toBe('ONGOING');
      expect(getScheduleTimeStatus('08:00', '09:40', '09:00')).toBe('ONGOING');
      expect(getScheduleTimeStatus('08:00', '09:40', '09:39')).toBe('ONGOING');
    });

    it('mengembalikan "COMPLETED" jika tepat pada waktu selesai (currentTime === endTime)', () => {
      expect(getScheduleTimeStatus('08:00', '09:40', '09:40')).toBe('COMPLETED');
    });

    it('mengembalikan "COMPLETED" jika setelah waktu selesai (currentTime > endTime)', () => {
      expect(getScheduleTimeStatus('08:00', '09:40', '09:41')).toBe('COMPLETED');
      expect(getScheduleTimeStatus('08:00', '09:40', '12:00')).toBe('COMPLETED');
      expect(getScheduleTimeStatus('08:00', '09:40', '23:59')).toBe('COMPLETED');
    });

    it('tidak menganggap status COMPLETED sebagai bukti kehadiran fisik', () => {
      // Status murni representasi temporal fase jam lokal
      const status = getScheduleTimeStatus('07:00', '08:30', '10:00');
      expect(status).toBe('COMPLETED');
    });
  });

  describe('2. getNowInTimezone (Resolusi Waktu dan Hari Berbasis Timezone Profil)', () => {
    beforeEach(() => {
      // Mock tanggal tetap: 2026-10-12 01:30:00 UTC
      // Pada UTC: 2026-10-12 (Senin / Monday = 1) pukul 01:30
      // Pada Asia/Jakarta (UTC+7): 2026-10-12 (Senin / Monday = 1) pukul 08:30
      // Pada America/New_York (UTC-4 EDT): 2026-10-11 (Minggu / Sunday = 7) pukul 21:30
      // Pada Asia/Tokyo (UTC+9): 2026-10-12 (Senin / Monday = 1) pukul 10:30
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-12T01:30:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('menghitung hari dan jam lokal yang tepat untuk Asia/Jakarta (WIB)', () => {
      const res = getNowInTimezone('Asia/Jakarta');
      expect(res.dayOfWeek).toBe(1); // Senin
      expect(res.currentTime).toBe('08:30');
      expect(res.dateKey).toBe('2026-10-12');
    });

    it('menghitung hari yang berbeda untuk zona waktu barat (America/New_York)', () => {
      const res = getNowInTimezone('America/New_York');
      expect(res.dayOfWeek).toBe(7); // Minggu (karena masih tanggal 11 malam)
      expect(res.currentTime).toBe('21:30');
      expect(res.dateKey).toBe('2026-10-11');
    });

    it('menghitung jam lokal tanpa menggeser representasi waktu menjadi UTC', () => {
      const resWib = getNowInTimezone('Asia/Jakarta');
      const resWit = getNowInTimezone('Asia/Jayapura'); // UTC+9 -> 10:30
      expect(resWib.currentTime).toBe('08:30');
      expect(resWit.currentTime).toBe('10:30');
      expect(resWit.dayOfWeek).toBe(1);
    });

    it('jatuh ke fallback aman jika string timezone tidak valid tanpa throwing exception', () => {
      const res = getNowInTimezone('Invalid/Timezone_Name');
      expect(res).toBeDefined();
      expect(res.dayOfWeek).toBeGreaterThanOrEqual(1);
      expect(res.dayOfWeek).toBeLessThanOrEqual(7);
      expect(typeof res.currentTime).toBe('string');
      expect(res.currentTime).toMatch(/^\d{2}:\d{2}$/);
      expect(typeof res.dateKey).toBe('string');
    });
  });
});
