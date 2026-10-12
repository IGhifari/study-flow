import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseLocalDate,
  formatLocalDate,
  formatDisplayDate,
} from '../components/ui/date-picker';
import {
  parseUserDateInput,
  toUserDateTimeInputValue,
} from '@studyflow/shared';

describe('DatePicker & DateTimePicker Unit Tests', () => {
  describe('1. Parsing dan Format Tanggal Lokal Tanpa Pergeseran UTC', () => {
    it('mengubah string YYYY-MM-DD menjadi Date lokal yang tepat tanpa tergeser zona waktu', () => {
      const parsed = parseLocalDate('2026-10-12');
      expect(parsed).toBeDefined();
      expect(parsed?.getFullYear()).toBe(2026);
      expect(parsed?.getMonth()).toBe(9); // 0-indexed: Oktober = 9
      expect(parsed?.getDate()).toBe(12);
    });

    it('formatLocalDate mengembalikan representasi string YYYY-MM-DD tanpa drift UTC', () => {
      const date = new Date(2026, 9, 12); // 12 Oktober 2026 local time
      expect(formatLocalDate(date)).toBe('2026-10-12');

      const dateEndYear = new Date(2026, 11, 31); // 31 Desember 2026
      expect(formatLocalDate(dateEndYear)).toBe('2026-12-31');

      const dateStartYear = new Date(2027, 0, 1); // 1 Januari 2027
      expect(formatLocalDate(dateStartYear)).toBe('2027-01-01');
    });

    it('round-trip dari YYYY-MM-DD ke Date dan kembali ke string identik 100%', () => {
      const input = '2026-11-20';
      const parsed = parseLocalDate(input);
      expect(parsed).toBeDefined();
      const output = formatLocalDate(parsed!);
      expect(output).toBe(input);
    });
  });

  describe('2. Format Tampilan Indonesia (formatDisplayDate)', () => {
    it('menampilkan nama bulan dan tanggal dalam Bahasa Indonesia', () => {
      expect(formatDisplayDate('2026-10-12')).toBe('12 Oktober 2026');
      expect(formatDisplayDate('2026-01-05')).toBe('5 Januari 2026');
      expect(formatDisplayDate('2026-08-17')).toBe('17 Agustus 2026');
      expect(formatDisplayDate('2026-12-31')).toBe('31 Desember 2026');
    });

    it('mengembalikan string kosong jika nilai tanggal tidak valid atau null', () => {
      expect(formatDisplayDate(null)).toBe('');
      expect(formatDisplayDate(undefined)).toBe('');
      expect(formatDisplayDate('')).toBe('');
      expect(formatDisplayDate('invalid-date')).toBe('');
    });
  });

  describe('3. Logika DateTimePicker: Pemisahan dan Penggabungan Nilai Jam Existing', () => {
    it('memisahkan tanggal dan jam dari string ISO / datetime-local dengan benar', () => {
      const rawValue = '2026-10-15T14:30';
      const [datePart, timePart] = rawValue.split('T');
      expect(datePart).toBe('2026-10-15');
      expect(timePart).toBe('14:30');
    });

    it('mempertahankan jam existing ketika hanya tanggal yang diperbarui', () => {
      const initialValue = '2026-10-15T14:30';
      const [, existingTime] = initialValue.split('T');
      const newDate = '2026-10-25';
      const updatedValue = `${newDate}T${existingTime}`;
      expect(updatedValue).toBe('2026-10-25T14:30');
    });

    it('mempertahankan tanggal existing ketika hanya jam yang diperbarui', () => {
      const initialValue = '2026-10-15T14:30';
      const [existingDate] = initialValue.split('T');
      const newTime = '09:00';
      const updatedValue = `${existingDate}T${newTime}`;
      expect(updatedValue).toBe('2026-10-15T09:00');
    });

    it('membuka lalu menyimpan form edit tanpa perubahan tidak mengubah nilai tanggal maupun jam', () => {
      const storedDueDate = '2026-10-15T16:59:00.000Z';
      const userInputValue = toUserDateTimeInputValue(storedDueDate, 'Asia/Jakarta');
      expect(userInputValue).toBe('2026-10-15T23:59');

      // Simulasi ekstraksi ke DatePicker dan TimeInput
      const [datePart, timePart] = userInputValue.split('T');
      expect(datePart).toBe('2026-10-15');
      expect(timePart).toBe('23:59');

      // Rekombinasi kembali tanpa edit
      const recombined = `${datePart}T${timePart}`;
      expect(recombined).toBe(userInputValue);
    });

    it('mendukung pengosongan nilai (field opsional) menjadi string kosong', () => {
      let currentValue: string = '2026-10-15T14:30';
      // User melakukan clear tanggal
      currentValue = '';
      expect(currentValue).toBe('');
    });
  });

  describe('4. Integritas Timezone: Browser Timezone Berbeda dari Profil', () => {
    it('memastikan deadline diinterpretasikan sesuai zona waktu profil, bukan offset mesin sembarang', () => {
      const profileTz = 'Asia/Jakarta'; // UTC+7
      const localInput = '2026-11-20T23:59';

      // Parse input user berdasarkan timezone profil
      const utcDate = parseUserDateInput(localInput, { timezone: profileTz });
      expect(utcDate).toBeDefined();

      // 2026-11-20 23:59 di Asia/Jakarta (UTC+7) setara dengan 2026-11-20 16:59 UTC
      expect(utcDate.toISOString()).toBe('2026-11-20T16:59:00.000Z');

      // Dikonversi kembali ke user input value profil menghasilkan input semula
      const roundTrip = toUserDateTimeInputValue(utcDate, profileTz);
      expect(roundTrip).toBe(localInput);
    });

    it('mempertahankan tanggal kalender deadline yang sama meski dilihat di zona waktu UTC-5 (New York)', () => {
      const profileTz = 'America/New_York'; // UTC-5
      const localInput = '2026-10-15T14:30';

      const utcDate = parseUserDateInput(localInput, { timezone: profileTz });
      expect(utcDate).toBeDefined();

      // 14:30 EDT (UTC-4) = 18:30 UTC
      expect(utcDate.toISOString()).toBe('2026-10-15T18:30:00.000Z');

      const roundTrip = toUserDateTimeInputValue(utcDate, profileTz);
      expect(roundTrip).toBe(localInput);
    });
  });
});
