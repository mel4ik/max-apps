import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * Применяет тему к DOM: data-theme, background, meta theme-color.
 */
function applyTheme(theme) {
  var t = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);

  var bg = t === 'dark' ? '#0F1729' : '#F4F6FA';
  document.documentElement.style.background = bg;
  if (document.body) document.body.style.background = bg;

  var mc = document.querySelector('meta[name="theme-color"]');
  if (mc) mc.setAttribute('content', bg);

  return t;
}

/**
 * Определяет текущую тему. Приоритет:
 *   1. WebApp.colorScheme (MAX SDK прямое значение)
 *   2. WebApp.themeParams.bg_color → эвристика яркости
 *   3. URL параметр ?theme=light/dark
 *   4. prefers-color-scheme (системная тема устройства)
 *   5. Fallback: 'dark'
 */
function detectTheme() {
  var wa = window.WebApp;

  // 1. MAX SDK colorScheme
  if (wa && (wa.colorScheme === 'light' || wa.colorScheme === 'dark')) {
    return wa.colorScheme;
  }

  // 2. themeParams.bg_color — яркость
  if (wa && wa.themeParams && wa.themeParams.bg_color) {
    var hex = wa.themeParams.bg_color.replace('#', '');
    if (hex.length === 6) {
      var r = parseInt(hex.substring(0, 2), 16);
      var g = parseInt(hex.substring(2, 4), 16);
      var b = parseInt(hex.substring(4, 6), 16);
      if ((r * 299 + g * 587 + b * 114) / 1000 > 128) return 'light';
      return 'dark';
    }
  }

  // 3. URL параметр
  try {
    var sp = new URLSearchParams(window.location.search);
    var urlTheme = sp.get('theme');
    if (urlTheme === 'light' || urlTheme === 'dark') return urlTheme;
  } catch (e) {}

  // 4. Системная тема устройства (prefers-color-scheme)
  if (window.matchMedia) {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  }

  // 5. Fallback
  return 'dark';
}

export function useMaxBridge() {
  const [ready, setReady] = useState(false);
  const [user, setUser]   = useState(null);
  const [theme, setTheme] = useState(() => {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  });
  const retryRef = useRef(null);

  useEffect(() => {
    const wa = window.WebApp;

    // Определяем и применяем тему
    function updateTheme() {
      var detected = detectTheme();
      var applied = applyTheme(detected);
      setTheme(applied);
      return applied;
    }

    updateTheme();

    if (!wa) { setReady(true); } else {
      wa.ready();
      setReady(true);
      if (wa.initDataUnsafe?.user) setUser(wa.initDataUnsafe.user);
    }

    // MAX SDK может инициализироваться с задержкой на iOS —
    // повторяем определение темы несколько раз
    var retries = [100, 300, 600, 1200];
    var timers = retries.map(function(ms) {
      return setTimeout(updateTheme, ms);
    });

    // Слушаем горячее переключение из MAX SDK
    function onThemeChanged() { updateTheme(); }
    if (wa && wa.onEvent) {
      wa.onEvent('themeChanged', onThemeChanged);
    }

    // Слушаем системную смену темы (iOS/Android settings toggle)
    var mql = null;
    function onSystemThemeChange(e) {
      // Только если MAX SDK не отдаёт свою тему напрямую
      var waCheck = window.WebApp;
      if (waCheck && (waCheck.colorScheme === 'light' || waCheck.colorScheme === 'dark')) return;
      updateTheme();
    }
    if (window.matchMedia) {
      mql = window.matchMedia('(prefers-color-scheme: dark)');
      if (mql.addEventListener) {
        mql.addEventListener('change', onSystemThemeChange);
      } else if (mql.addListener) {
        mql.addListener(onSystemThemeChange); // Safari < 14
      }
    }

    return () => {
      timers.forEach(clearTimeout);
      if (wa && wa.offEvent) wa.offEvent('themeChanged', onThemeChanged);
      if (mql) {
        if (mql.removeEventListener) mql.removeEventListener('change', onSystemThemeChange);
        else if (mql.removeListener) mql.removeListener(onSystemThemeChange);
      }
    };
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

  return { ready, user, theme, haptic, success, error, back };
}
