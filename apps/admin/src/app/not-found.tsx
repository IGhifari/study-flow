import Link from 'next/link';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { FadeIn } from '@/components/ui/motion';

export default function NotFound(): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 text-center">
      <FadeIn className="w-full max-w-md">
        <Card className="max-w-md w-full shadow-xs border-border">
          <CardHeader className="space-y-2 pb-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileQuestion className="h-7 w-7" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              404 — Halaman Tidak Ditemukan
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Halaman admin yang Anda cari tidak tersedia atau telah dipindahkan.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-2">
            <p className="text-xs text-muted-foreground">
              Pastikan rute portal administrator yang Anda tuju sudah benar.
            </p>
          </CardContent>
          <CardFooter className="justify-center pt-4">
            <Button asChild variant="default" className="gap-2">
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4" />
                <span>Kembali ke Dashboard</span>
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </FadeIn>
    </div>
  );
}
