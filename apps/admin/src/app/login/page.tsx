import * as React from 'react';
import { LoginForm } from '@/components/login-form';
import { FadeIn } from '@/components/ui/motion';
import { StudyFlowLogo } from '@/components/brand/studyflow-logo';
import { ThemeToggle } from '@/components/theme-toggle';

export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col bg-muted/40 dark:bg-background">
      <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <StudyFlowLogo badge="Admin" size="md" />
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <FadeIn className="w-full max-w-md">
          <React.Suspense
            fallback={
              <div
                className="h-[430px] w-full animate-pulse rounded-xl border border-border bg-card"
                aria-hidden="true"
              />
            }
          >
            <LoginForm />
          </React.Suspense>
        </FadeIn>
      </main>

      <footer className="px-4 pb-6 text-center text-xs text-muted-foreground sm:px-6">
        &copy; {new Date().getFullYear()} StudyFlow · Portal internal administrator
      </footer>
    </div>
  );
}
