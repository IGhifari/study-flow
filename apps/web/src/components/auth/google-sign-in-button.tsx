'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getGoogleAuthStatus } from '@/lib/auth-client';

export function GoogleLogo({ className = 'h-4 w-4' }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

export interface GoogleSignInButtonProps {
  returnUrl?: string | null;
  disabled?: boolean;
}

export function GoogleSignInButton({
  returnUrl,
  disabled = false,
}: GoogleSignInButtonProps): React.JSX.Element | null {
  const [isConfigured, setIsConfigured] = React.useState<boolean | null>(null);
  const [isRedirecting, setIsRedirecting] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;
    getGoogleAuthStatus()
      .then((configured) => {
        if (isMounted) setIsConfigured(configured);
      })
      .catch(() => {
        if (isMounted) setIsConfigured(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // When Google auth is not configured, hide the button gracefully
  if (isConfigured === false) {
    return null;
  }

  const handleGoogleClick = () => {
    if (isRedirecting || disabled) return;
    setIsRedirecting(true);

    const targetUrl = new URL('/api/auth/google', window.location.origin);
    if (returnUrl) {
      targetUrl.searchParams.set('returnUrl', returnUrl);
    }

    window.location.href = targetUrl.toString();
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleGoogleClick}
      disabled={disabled || isRedirecting || isConfigured === null}
      className="w-full h-10 font-medium gap-2.5 bg-background hover:bg-muted/50 border-border text-foreground transition-colors"
      aria-label="Lanjutkan dengan Google"
    >
      {isRedirecting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>Menghubungkan ke Google...</span>
        </>
      ) : (
        <>
          <GoogleLogo />
          <span>Lanjutkan dengan Google</span>
        </>
      )}
    </Button>
  );
}
