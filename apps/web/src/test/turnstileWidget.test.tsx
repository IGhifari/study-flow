// @vitest-environment happy-dom
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

let mockResolvedTheme: string | undefined = undefined;

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: mockResolvedTheme }),
}));

import { TurnstileWidget } from '../components/auth/turnstile-widget';

describe('TurnstileWidget Lifecycle Tests', () => {
  const renderSpy = vi.fn();
  const removeSpy = vi.fn();
  const resetSpy = vi.fn();
  let capturedCallbacks: {
    callback?: (token: string) => void;
    'expired-callback'?: () => void;
    'error-callback'?: (code: string) => void;
  } = {};

  beforeEach(() => {
    mockResolvedTheme = undefined;
    renderSpy.mockReset();
    removeSpy.mockReset();
    resetSpy.mockReset();
    capturedCallbacks = {};

    renderSpy.mockImplementation((_el: HTMLElement, opts: typeof capturedCallbacks) => {
      capturedCallbacks = opts;
      return 'widget-1';
    });

    window.turnstile = {
      render: renderSpy,
      reset: resetSpy,
      remove: removeSpy,
    };

    const existingScript = document.getElementById('cf-turnstile-script');
    if (existingScript) {
      existingScript.remove();
    }
    const stubScript = document.createElement('script');
    stubScript.id = 'cf-turnstile-script';
    document.head.appendChild(stubScript);
  });

  afterEach(() => {
    cleanup();
    delete window.turnstile;
    document.getElementById('cf-turnstile-script')?.remove();
    vi.restoreAllMocks();
  });

  it('tidak me-render lalu langsung menghapus widget saat resolvedTheme masih undefined di awal hidrasi', () => {
    const onVerify = vi.fn();
    const { rerender } = render(
      <TurnstileWidget
        siteKey="0x4AAAAAAF7bcWY_zVxAcJWr"
        action="register"
        onVerify={onVerify}
      />
    );

    expect(renderSpy).not.toHaveBeenCalled();
    expect(removeSpy).not.toHaveBeenCalled();

    mockResolvedTheme = 'light';
    rerender(
      <TurnstileWidget
        siteKey="0x4AAAAAAF7bcWY_zVxAcJWr"
        action="register"
        onVerify={onVerify}
      />
    );

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).not.toHaveBeenCalled();
    expect(renderSpy.mock.calls[0]?.[1]).toMatchObject({
      sitekey: '0x4AAAAAAF7bcWY_zVxAcJWr',
      theme: 'light',
      action: 'register',
    });
  });

  it('membersihkan token via onExpire dan memberi tahu onError saat widget memicu error-callback', () => {
    mockResolvedTheme = 'dark';
    const onVerify = vi.fn();
    const onExpire = vi.fn();
    const onError = vi.fn();

    const { unmount } = render(
      <TurnstileWidget
        siteKey="0x4AAAAAAF7bcWY_zVxAcJWr"
        action="register"
        onVerify={onVerify}
        onExpire={onExpire}
        onError={onError}
      />
    );

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(renderSpy.mock.calls[0]?.[1]).toMatchObject({
      theme: 'dark',
    });

    vi.spyOn(console, 'warn').mockImplementation(() => {});

    act(() => {
      capturedCallbacks.callback?.('tok-123');
    });
    expect(onVerify).toHaveBeenCalledWith('tok-123');

    act(() => {
      capturedCallbacks['error-callback']?.('600010');
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('widget-1');
  });
});
