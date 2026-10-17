'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FadeIn } from '@/components/ui/motion';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({
  error,
  reset,
}: GlobalErrorProps): React.JSX.Element {
  React.useEffect(() => {
    console.error('StudyFlow Web Runtime Error:', error);
  }, [error]);

  return (
    <div className="min-h-[80vh] w-full flex items-center justify-center p-4 sm:p-6">
      <FadeIn className="w-full max-w-md">
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-3">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>
            <CardTitle className="text-xl font-bold tracking-tight text-foreground">
              Terjadi Kendala Teknis
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Maaf, sistem mendeteksi kendala saat memproses permintaan Anda. Halaman tidak dapat dimuat dengan sempurna saat ini.
            </CardDescription>
          </CardHeader>

          {error.digest && (
            <CardContent className="pt-2 pb-4 text-center">
              <div className="rounded-lg bg-muted/50 p-2.5 border border-border/60">
                <p className="text-xs text-muted-foreground">
                  Kode Referensi Masalah:
                </p>
                <code className="text-xs font-mono font-medium text-foreground select-all mt-0.5 block">
                  {error.digest}
                </code>
              </div>
            </CardContent>
          )}

          <CardFooter className="flex flex-col sm:flex-row items-center gap-2 pt-2">
            <Button
              onClick={() => reset()}
              className="w-full sm:flex-1 gap-2"
              variant="default"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Coba Lagi</span>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full sm:flex-1 gap-2"
            >
              <Link href="/">
                <Home className="h-4 w-4" />
                <span>Kembali ke Beranda</span>
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </FadeIn>
    </div>
  );
}
