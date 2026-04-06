import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { getSemanticColors, type ColorSchemeName, type SemanticColors } from '@/constants/design-tokens';

const STORAGE_KEY = '@trackr/theme-preference';
const LEGACY_THEME_KEY = '@moneymanager/theme-preference';

export type ThemePreference = 'light' | 'dark' | 'system';

type ColorSchemeContextValue = {
  scheme: ColorSchemeName;
  colors: SemanticColors;
  themePreference: ThemePreference;
  setThemePreference: (p: ThemePreference) => Promise<void>;
  preferenceHydrated: boolean;
};

const ColorSchemeContext = createContext<ColorSchemeContextValue | null>(null);

export function ColorSchemeProvider({ children }: { children: React.ReactNode }) {
  const system = useRNColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [preferenceHydrated, setPreferenceHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      let raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw !== 'light' && raw !== 'dark' && raw !== 'system') {
        const legacy = await AsyncStorage.getItem(LEGACY_THEME_KEY);
        if (legacy === 'light' || legacy === 'dark' || legacy === 'system') {
          raw = legacy;
          await AsyncStorage.setItem(STORAGE_KEY, legacy);
          await AsyncStorage.removeItem(LEGACY_THEME_KEY);
        }
      }
      if (raw === 'light' || raw === 'dark' || raw === 'system') {
        setPreference(raw);
      }
      setPreferenceHydrated(true);
    })();
  }, []);

  const scheme: ColorSchemeName =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const setThemePreference = useCallback(async (next: ThemePreference) => {
    setPreference(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({
      scheme,
      colors: getSemanticColors(scheme),
      themePreference: preference,
      setThemePreference,
      preferenceHydrated,
    }),
    [scheme, preference, setThemePreference, preferenceHydrated],
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
