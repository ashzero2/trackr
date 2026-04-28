import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
  type Theme,
} from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { View } from 'react-native';

import { useAppColors } from '@/contexts/color-scheme-context';

export function NavigationThemeRoot({ children }: { children: React.ReactNode }) {
  const { scheme, colors } = useAppColors();

  const navigationTheme = useMemo<Theme>(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.surface,
        card: colors.surfaceContainerLowest,
        text: colors.onSurface,
        border: String(colors.outlineVariant),
        notification: colors.primary,
      },
    };
  }, [scheme, colors]);

  return (
    <ThemeProvider value={navigationTheme}>
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        {children}
      </View>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
