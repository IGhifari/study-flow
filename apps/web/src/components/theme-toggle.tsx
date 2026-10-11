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
        className="inline-flex h-8 items-center rounded-lg border border-border bg-card p-0.5 text-muted-foreground"
        aria-hidden="true"
      >
        <div className="h-7 w-7 rounded-md" />
        <div className="h-7 w-7 rounded-md" />
        <div className="h-7 w-7 rounded-md" />
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Pilih tema tampilan"
      className="inline-flex h-8 items-center rounded-lg border border-border bg-card p-0.5 text-muted-foreground"
    >
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'system'}
        onClick={() => setTheme('system')}
        className={`inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
          theme === 'system'
            ? 'bg-accent text-accent-foreground font-semibold shadow-xs'
            : 'hover:text-foreground hover:bg-muted/50'
        }`}
        title="Ikuti tema sistem perangkat"
      >
        <Laptop className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Sistem</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={theme === 'light'}
        onClick={() => setTheme('light')}
        className={`inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
          theme === 'light'
            ? 'bg-accent text-accent-foreground font-semibold shadow-xs'
            : 'hover:text-foreground hover:bg-muted/50'
        }`}
        title="Gunakan tema terang"
      >
        <Sun className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Terang</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={theme === 'dark'}
        onClick={() => setTheme('dark')}
        className={`inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
          theme === 'dark'
            ? 'bg-accent text-accent-foreground font-semibold shadow-xs'
            : 'hover:text-foreground hover:bg-muted/50'
        }`}
        title="Gunakan tema gelap"
      >
        <Moon className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Gelap</span>
      </button>
    </div>
  );
}
