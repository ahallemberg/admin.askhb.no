import { useCallback, useState } from 'react';

// askhb.no renders in two themes and much of its palette is tuned per theme, so
// the preview panes can show either. The choice is remembered because it is a
// property of how the author works, not of the entry being edited: picking dark
// once should survive closing a dialog and opening the next one.
const STORAGE_KEY = 'previewTheme';

type PreviewTheme = 'light' | 'dark';

// Storage access throws outright in a few configurations rather than returning
// null, so both directions are guarded. A preview that cannot remember the
// choice is a small annoyance; one that takes the editor down with it is not.
const read = (): PreviewTheme => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

const write = (theme: PreviewTheme): void => {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Preference lost for this session only.
  }
};

// Read once per mount rather than subscribed to: two preview panes are never open
// at the same time, so there is nothing to keep in sync.
function usePreviewTheme(): [PreviewTheme, (theme: PreviewTheme) => void] {
  const [theme, setTheme] = useState<PreviewTheme>(read);

  const choose = useCallback((next: PreviewTheme) => {
    setTheme(next);
    write(next);
  }, []);

  return [theme, choose];
}

export { usePreviewTheme };
export type { PreviewTheme };
