'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Laptop } from 'lucide-react';

export function ThemeToggle(): React.JSX.Element {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="inline-flex h-11 items-center rounded-lg border border-border bg-card p-1 text-muted-foreground"
        aria-hidden="true"
      >
        <div className="h-9 w-9 rounded-md" />
        <div className="h-9 w-9 rounded-md" />
        <div className="h-9 w-9 rounded-md" />
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Pilih tema tampilan"
      className="inline-flex h-11 items-center rounded-lg border border-border bg-card p-1 text-muted-foreground shadow-xs"
    >
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'system'}
        onClick={() => setTheme('system')}
        className={`inline-flex h-9 min-w-[2.75rem] items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
          theme === 'system'
            ? 'bg-accent text-accent-foreground font-semibold'
            : 'hover:text-foreground hover:bg-muted/50'
        }`}
        title="Ikuti tema sistem perangkat"
      >
        <Laptop className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Sistem</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={theme === 'light'}
        onClick={() => setTheme('light')}
        className={`inline-flex h-9 min-w-[2.75rem] items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
          theme === 'light'
            ? 'bg-accent text-accent-foreground font-semibold'
            : 'hover:text-foreground hover:bg-muted/50'
        }`}
        title="Gunakan tema terang"
      >
        <Sun className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Terang</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={theme === 'dark'}
        onClick={() => setTheme('dark')}
        className={`inline-flex h-9 min-w-[2.75rem] items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
          theme === 'dark'
            ? 'bg-accent text-accent-foreground font-semibold'
            : 'hover:text-foreground hover:bg-muted/50'
        }`}
        title="Gunakan tema gelap"
      >
        <Moon className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Gelap</span>
      </button>
    </div>
  );
}
