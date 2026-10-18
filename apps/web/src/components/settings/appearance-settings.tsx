'use client';

import * as React from 'react';
import { Palette } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';

export function AppearanceSettings(): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-primary font-semibold text-sm">
          <Palette className="h-4 w-4" />
          <span>Tampilan & Tema</span>
        </div>
        <CardTitle className="text-lg">Preferensi Antarmuka</CardTitle>
        <CardDescription>
          Pilih mode tema yang nyaman untuk membaca materi kuliah dalam jangka waktu lama.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-border p-4 bg-muted/20">
          <div>
            <p className="text-sm font-medium text-foreground">Mode Tema</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Mendukung tema Sistem otomatis, Terang (kertas bersih), dan Gelap (tinta lembut).
            </p>
          </div>
          <ThemeToggle />
        </div>
      </CardContent>
    </Card>
  );
}
