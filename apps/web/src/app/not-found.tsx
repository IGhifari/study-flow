import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound(): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="text-6xl font-bold tracking-tight text-foreground">404</h1>
      <h2 className="mt-4 text-2xl font-semibold text-foreground">Halaman Tidak Ditemukan</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Halaman yang Anda cari tidak tersedia atau telah dipindahkan.
      </p>
      <div className="mt-6">
        <Link href="/">
          <Button variant="default">Kembali ke Beranda</Button>
        </Link>
      </div>
    </div>
  );
}
