'use client';

import * as React from 'react';

export function useDebouncedValue<T>(
  value: T,
  delayMs = 300,
  onChange?: (next: T, prev: T) => void
): T {
  const [debounced, setDebounced] = React.useState<T>(value);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced((prev) => {
        if (prev !== value) {
          onChangeRef.current?.(value, prev);
        }
        return value;
      });
    }, delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
