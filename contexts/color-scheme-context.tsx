import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import {
  getSemanticColors,
  type ColorSchemeName,
  type SemanticColors,
  type ThemeName,
  THEME_NAMES,
} from '@/constants/design-tokens';

const PREF_KEY  = '@trackr/theme-preference';
const THEME_KEY = '@trackr/theme-name';
const LEGACY_PREF_KEY = '@moneymanager/theme-preference';

export type ThemePreference = 'light' | 'dark' | 'system';

type ColorSchemeContextValue = {
  scheme: ColorSchemeName;
  colors: SemanticColors;
  themePreference: ThemePreference;
  setThemePreference: (p: ThemePreference) => Promise<void>;
  themeName: ThemeName;
  setThemeName: (t: ThemeName) => Promise<void>;
  preferenceHydrated: boolean;
};

const ColorSchemeContext = createContext<ColorSchemeContextValue | null>(null);

export function ColorSchemeProvider({ children }: { children: React.ReactNode }) {
  const system = useRNColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [themeName, setThemeNameState] = useState<ThemeName>('veridian');
  const [preferenceHydrated, setPreferenceHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      // --- hydrate scheme preference ---
      let raw = await AsyncStorage.getItem(PREF_KEY);
      if (raw !== 'light' && raw !== 'dark' && raw !== 'system') {
        const legacy = await AsyncStorage.getItem(LEGACY_PREF_KEY);
        if (legacy === 'light' || legacy === 'dark' || legacy === 'system') {
          raw = legacy;
          await AsyncStorage.setItem(PREF_KEY, legacy);
          await AsyncStorage.removeItem(LEGACY_PREF_KEY);
        }
      }
      if (raw === 'light' || raw === 'dark' || raw === 'system') {
        setPreference(raw);
      }

      // --- hydrate theme name ---
      const savedTheme = await AsyncStorage.getItem(THEME_KEY);
      if (savedTheme && (THEME_NAMES as string[]).includes(savedTheme)) {
        setThemeNameState(savedTheme as ThemeName);
      }

      setPreferenceHydrated(true);
    })();
  }, []);

  const scheme: ColorSchemeName =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const setThemePreference = useCallback(async (next: ThemePreference) => {
    setPreference(next);
    await AsyncStorage.setItem(PREF_KEY, next);
  }, []);

  const setThemeName = useCallback(async (next: ThemeName) => {
    setThemeNameState(next);
    await AsyncStorage.setItem(THEME_KEY, next);
  }, []);

  const value = useMemo(
    () => ({
      scheme,
      colors: getSemanticColors(scheme, themeName),
      themePreference: preference,
      setThemePreference,
      themeName,
      setThemeName,
      preferenceHydrated,
    }),
    [scheme, themeName, preference, setThemePreference, setThemeName, preferenceHydrated],
  );

  return <ColorSchemeContext.Provider value={value}>{children}</ColorSchemeContext.Provider>;
}

export function useAppColors() {
  const ctx = useContext(ColorSchemeContext);
  if (!ctx) {
    throw new Error('useAppColors must be used within ColorSchemeProvider');
  }
  return ctx;
}
