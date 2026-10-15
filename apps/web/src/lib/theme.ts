import { useEffect, useState } from 'react';

export const THEMES = [
  'auto',
  'emerald',
  'nabawi',
  'iznik',
  'alhambra',
  'mushaf',
  'qiyam',
] as const;
export type Theme = (typeof THEMES)[number];

const root = () => document.documentElement;

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode: the choice just lasts for this visit
  }
}

/** The browser bar follows the chrome colour of whichever theme is showing. */
function syncThemeColor() {
  let meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  meta.content = getComputedStyle(root())
    .getPropertyValue('--color-chrome')
    .trim();
}

export function useTheme() {
  // index.html already applied the saved choice before first paint.
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = root().dataset.theme as Theme;
    return THEMES.includes(saved) ? saved : 'emerald';
  });
  const [pattern, setPatternState] = useState(
    () => root().dataset.pattern === 'on',
  );

  // "auto" flips with the device, so re-read the chrome colour when it does.
  useEffect(() => {
    syncThemeColor();
    const media = matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', syncThemeColor);
    return () => media.removeEventListener('change', syncThemeColor);
  }, [theme]);

  return {
    theme,
    pattern,
    setTheme(next: Theme) {
      root().dataset.theme = next;
      save('ribat.theme', next);
      setThemeState(next);
    },
    setPattern(on: boolean) {
      root().dataset.pattern = on ? 'on' : 'off';
      save('ribat.pattern', on ? 'on' : 'off');
      setPatternState(on);
    },
  };
}
