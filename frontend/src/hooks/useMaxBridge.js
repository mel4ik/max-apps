import { useEffect, useState, useCallback } from 'react';

export function useMaxBridge() {
  const [ready, setReady] = useState(false);
  const [user, setUser]   = useState(null);

  useEffect(() => {
    const wa = window.WebApp;

    // Определяем тему: MAX SDK -> фон body -> CSS media -> fallback dark
    var cs = wa && wa.colorScheme;
    if (!cs) {
      // Проверяем фактический фон — MAX WebView может задать тёмный bg
      try {
        var bodyBg = window.getComputedStyle(document.body).backgroundColor;
        if (bodyBg) {
          var m = bodyBg.match(/\d+/g);
          if (m && m.length >= 3) {
            var brightness = (parseInt(m[0]) * 299 + parseInt(m[1]) * 587 + parseInt(m[2]) * 114) / 1000;
            cs = brightness < 128 ? 'dark' : 'light';
          }
        }
      } catch(e) {}
    }
    if (!cs) {
      try { cs = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch(e) {}
    }
    document.documentElement.setAttribute('data-theme', cs || 'dark');
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
