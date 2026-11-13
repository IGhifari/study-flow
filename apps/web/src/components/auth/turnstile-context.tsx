'use client';

import * as React from 'react';

const TurnstileSiteKeyContext = React.createContext<string | null>(null);

export function TurnstileConfigProvider({
  siteKey,
  children,
}: {
  siteKey: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <TurnstileSiteKeyContext.Provider value={siteKey}>
      {children}
    </TurnstileSiteKeyContext.Provider>
  );
}

export function useTurnstileSiteKey(): string | null {
  return React.useContext(TurnstileSiteKeyContext);
}
