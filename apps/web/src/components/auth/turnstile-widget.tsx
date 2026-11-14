'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { useTurnstileSiteKey } from './turnstile-context';
import { CLOUDFLARE_TURNSTILE_TEST_SITE_KEY } from '@/lib/turnstile-config';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: (errorCode: string) => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
          action?: string;
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

export interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (error?: string) => void;
  siteKey?: string;
  action?: string;
  className?: string;
}

export interface TurnstileWidgetHandle {
  reset: () => void;
}

export const TurnstileWidget = React.forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  ({ onVerify, onExpire, onError, siteKey: propSiteKey, action, className }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const widgetIdRef = React.useRef<string | null>(null);
    const { resolvedTheme } = useTheme();
    const contextSiteKey = useTurnstileSiteKey();

    const siteKey =
      propSiteKey?.trim() ||
      contextSiteKey?.trim() ||
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ||
      // Cloudflare official always-pass testing key fallback
      CLOUDFLARE_TURNSTILE_TEST_SITE_KEY;

    // Store callbacks in ref to prevent stale closures and avoid re-rendering turnstile
    const onVerifyRef = React.useRef(onVerify);
    onVerifyRef.current = onVerify;

    const onExpireRef = React.useRef(onExpire);
    onExpireRef.current = onExpire;

    const onErrorRef = React.useRef(onError);
    onErrorRef.current = onError;

    const resetWidget = React.useCallback(() => {
      if (typeof window !== 'undefined' && window.turnstile && widgetIdRef.current) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch {
          // ignore reset error
        }
      }
    }, []);

    React.useImperativeHandle(
      ref,
      () => ({
        reset: resetWidget,
      }),
      [resetWidget]
    );

    React.useEffect(() => {
      let isMounted = true;

      const renderWidget = () => {
        if (!containerRef.current || !window.turnstile || !isMounted) return;

        // Clean up previous widget if exists
        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore
          }
          widgetIdRef.current = null;
        }

        try {
          const id = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme: resolvedTheme === 'dark' ? 'dark' : 'light',
            action,
            size: 'normal',
            callback: (token: string) => {
              if (isMounted) {
                onVerifyRef.current?.(token);
              }
            },
            'expired-callback': () => {
              if (isMounted) {
                onExpireRef.current?.();
              }
            },
            'error-callback': (errorCode: string) => {
              console.warn('[Turnstile Widget Error]', { errorCode });
              if (isMounted) {
                onErrorRef.current?.('Verifikasi keamanan gagal. Silakan coba lagi.');
              }
            },
          });
          widgetIdRef.current = id;
        } catch (e) {
          console.error('[Turnstile Render Error]', e);
        }
      };

      // Ensure Cloudflare Turnstile script is loaded
      const scriptId = 'cf-turnstile-script';
      let script = document.getElementById(scriptId) as HTMLScriptElement | null;

      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          if (isMounted) {
            renderWidget();
          }
        };
        document.head.appendChild(script);
      } else if (window.turnstile) {
        renderWidget();
      } else {
        script.addEventListener('load', renderWidget);
      }

      return () => {
        isMounted = false;
        if (typeof window !== 'undefined' && window.turnstile && widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore
          }
          widgetIdRef.current = null;
        }
      };
    }, [siteKey, resolvedTheme, action]);

    return (
      <div className={`flex justify-center items-center my-2 min-h-[65px] ${className || ''}`}>
        <div ref={containerRef} data-testid="turnstile-widget" />
      </div>
    );
  }
);

TurnstileWidget.displayName = 'TurnstileWidget';
