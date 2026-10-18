// @vitest-environment happy-dom
import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BookOpen } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

describe('EmptyState Behavioral Component Tests', () => {
  it('1. Merender judul dan deskripsi dengan benar', () => {
    render(
      <EmptyState
        title="Belum ada data mata kuliah"
        description="Silakan tambahkan mata kuliah untuk semester aktif ini."
      />
    );

    // Judul dirender dalam heading semantik default (h3)
    const heading = screen.getByRole('heading', { level: 3, name: 'Belum ada data mata kuliah' });
    expect(heading).toBeDefined();

    // Deskripsi dirender dan dapat dibaca pengguna
    const description = screen.getByText('Silakan tambahkan mata kuliah untuk semester aktif ini.');
    expect(description).toBeDefined();
  });

  it('2. Mendukung heading semantik kustom via prop headingAs', () => {
    const { rerender } = render(
      <EmptyState
        headingAs="h2"
        title="Heading Level 2"
      />
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Heading Level 2' })).toBeDefined();

    rerender(
      <EmptyState
        headingAs="h4"
        title="Heading Level 4"
      />
    );
    expect(screen.getByRole('heading', { level: 4, name: 'Heading Level 4' })).toBeDefined();

    rerender(
      <EmptyState
        headingAs="p"
        title="Judul Sebagai Paragraf"
      />
    );
    // Tidak lagi terdaftar sebagai role 'heading' karena menggunakan tag <p>
    expect(screen.queryByRole('heading')).toBeNull();
    const paragraph = screen.getByText('Judul Sebagai Paragraf');
    expect(paragraph.tagName).toBe('P');
  });

  it('3. Menerapkan styling variant dashed dan plain secara akurat', () => {
    const { container: dashedContainer, rerender } = render(
      <EmptyState
        variant="dashed"
        title="Dashed Variant"
      />
    );
    const dashedEl = dashedContainer.firstElementChild as HTMLElement;
    expect(dashedEl.className).toContain('border-dashed');
    expect(dashedEl.className).toContain('border-border');
    expect(dashedEl.className).toContain('bg-card/40');

    rerender(
      <EmptyState
        variant="plain"
        title="Plain Variant"
      />
    );
    const plainEl = dashedContainer.firstElementChild as HTMLElement;
    expect(plainEl.className).not.toContain('border-dashed');
    expect(plainEl.className).toContain('text-center');
  });

  it('4. Menerapkan ukuran size default dan sm dengan benar', () => {
    const { container, rerender } = render(
      <EmptyState
        size="default"
        title="Default Size"
        icon={BookOpen}
      />
    );
    const defaultEl = container.firstElementChild as HTMLElement;
    expect(defaultEl.className).toContain('p-8');
    expect(defaultEl.className).toContain('sm:p-10');

    rerender(
      <EmptyState
        size="sm"
        title="Compact Size"
        icon={BookOpen}
      />
    );
    const compactEl = container.firstElementChild as HTMLElement;
    expect(compactEl.className).toContain('p-6');
    expect(compactEl.className).toContain('rounded-lg');
  });

  it('5. Merender elemen aksi dan memanggil callback ketika diklik', () => {
    const handleClick = vi.fn();

    render(
      <EmptyState
        title="Daftar Kosong"
        description="Klik tombol untuk menambah data."
        action={
          <button type="button" onClick={handleClick}>
            Tambah Data Pertama
          </button>
        }
      />
    );

    const button = screen.getByRole('button', { name: 'Tambah Data Pertama' });
    expect(button).toBeDefined();

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('6. Tidak merender container aksi ketika prop action bernilai falsy', () => {
    render(
      <EmptyState
        title="Mode Baca Saja"
        action={false}
      />
    );

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('7. Memastikan ikon dekoratif memiliki atribut aria-hidden="true"', () => {
    const { container } = render(
      <EmptyState
        icon={BookOpen}
        title="Data Tidak Tersedia"
      />
    );

    const svgIcon = container.querySelector('svg');
    expect(svgIcon).not.toBeNull();
    expect(svgIcon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('8. Memastikan atribut aksesibilitas container role="status" terpasang', () => {
    render(
      <EmptyState
        title="Pemberitahuan Status"
      />
    );

    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeDefined();
    expect(statusEl.getAttribute('aria-label')).toBe('Pemberitahuan Status');
  });

  it('9. Merender children tambahan jika diberikan', () => {
    render(
      <EmptyState title="Konten Fleksibel">
        <span data-testid="custom-child">Tambahan Footer Kustom</span>
      </EmptyState>
    );

    expect(screen.getByTestId('custom-child').textContent).toBe('Tambahan Footer Kustom');
  });
});
