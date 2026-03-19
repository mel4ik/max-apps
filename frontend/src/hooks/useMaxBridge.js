import { useEffect, useState, useCallback } from 'react';

export function useMaxBridge() {
  const [ready, setReady] = useState(false);
  const [user, setUser]   = useState(null);

  useEffect(() => {
    const wa = window.WebApp;

    // MAX всегда тёмный — принудительно dark
    document.documentElement.setAttribute('data-theme', 'dark');
    if (!wa) { setReady(true); return; }
    wa.ready();
    setReady(true);
    if (wa.initDataUnsafe?.user) setUser(wa.initDataUnsafe.user);
  }, []);

  const haptic  = useCallback((s='light') => window.WebApp?.HapticFeedback?.impactOccurred(s), []);
  const success = useCallback(() => window.WebApp?.HapticFeedback?.notificationOccurred('success'), []);
  const error   = useCallback(() => window.WebApp?.HapticFeedback?.notificationOccurred('error'), []);
  const back    = useCallback((show, fn) => {
    const bb = window.WebApp?.BackButton;
    if (!bb) return () => {};
    if (show) { bb.show(); bb.onClick(fn); return () => { bb.offClick(fn); bb.hide(); }; }
    bb.hide(); return () => {};
  }, []);

  return { ready, user, haptic, success, error, back };
}
