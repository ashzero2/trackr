export type ThemeName = 'veridian' | 'midnight' | 'ocean' | 'rose' | 'sand' | 'amethyst';
export type ColorSchemeName = 'light' | 'dark';

export const THEME_NAMES: ThemeName[] = ['veridian', 'midnight', 'ocean', 'rose', 'sand', 'amethyst'];

export const THEME_METADATA: Record<ThemeName, { label: string; swatchLight: string; swatchDark: string }> = {
  veridian:  { label: 'Veridian',  swatchLight: '#00342b', swatchDark: '#34d399' },
  midnight:  { label: 'Midnight',  swatchLight: '#312e81', swatchDark: '#818cf8' },
  ocean:     { label: 'Ocean',     swatchLight: '#1e40af', swatchDark: '#60a5fa' },
  rose:      { label: 'Rose',      swatchLight: '#9f1239', swatchDark: '#fb7185' },
  sand:      { label: 'Sand',      swatchLight: '#92400e', swatchDark: '#fbbf24' },
  amethyst:  { label: 'Amethyst', swatchLight: '#4c1d95', swatchDark: '#a78bfa' },
};

// ---------------------------------------------------------------------------
// Shared tokens — same across all themes
// ---------------------------------------------------------------------------
const LIGHT_SHARED = {
  secondary: '#49607c', onSecondary: '#ffffff', secondaryContainer: '#c7dfff',
  onSecondaryContainer: '#4b637e', secondaryFixed: '#d1e4ff', secondaryFixedDim: '#b0c9e8',
  onSecondaryFixed: '#011d35', onSecondaryFixedVariant: '#314863',
  error: '#ba1a1a', onError: '#ffffff', errorContainer: '#ffdad6', onErrorContainer: '#93000a',
} as const;

const DARK_SHARED = {
  secondary: '#94a3b8', onSecondary: '#0f172a', secondaryContainer: '#1e3a5f',
  onSecondaryContainer: '#cbd5e1', secondaryFixed: '#334155', secondaryFixedDim: '#475569',
  onSecondaryFixed: '#e2e8f0', onSecondaryFixedVariant: '#cbd5e1',
  error: '#f87171', onError: '#0f172a', errorContainer: '#7f1d1d', onErrorContainer: '#fecaca',
} as const;

// ---------------------------------------------------------------------------
// Per-theme palette cores
// ---------------------------------------------------------------------------
type ThemeCore = {
  primary: string; onPrimary: string; primaryContainer: string; onPrimaryContainer: string;
  primaryFixed: string; primaryFixedDim: string; onPrimaryFixed: string; onPrimaryFixedVariant: string;
  inversePrimary: string; surfaceTint: string;
  surface: string; background: string; surfaceBright: string; surfaceDim: string;
  surfaceVariant: string; inverseSurface: string; inverseOnSurface: string;
  surfaceContainerLowest: string; surfaceContainerLow: string; surfaceContainer: string;
  surfaceContainerHigh: string; surfaceContainerHighest: string;
  onSurface: string; onBackground: string; onSurfaceVariant: string;
  outline: string; outlineVariant: string;
  tertiary: string; onTertiary: string; tertiaryContainer: string; onTertiaryContainer: string;
  tertiaryFixed: string; tertiaryFixedDim: string; onTertiaryFixed: string; onTertiaryFixedVariant: string;
  chartPeakLabel: string; insightCardTitle: string; insightCardBody: string; insightCardKicker: string;
  headerGlassFallback: string;
};

const CORES: Record<ThemeName, { light: ThemeCore; dark: ThemeCore }> = {
  // ----------------------------- Veridian -----------------------------------
  veridian: {
    light: {
      primary: '#00342b', onPrimary: '#ffffff', primaryContainer: '#004d40', onPrimaryContainer: '#7ebdac',
      primaryFixed: '#afefdd', primaryFixedDim: '#94d3c1', onPrimaryFixed: '#00201a', onPrimaryFixedVariant: '#065043',
      inversePrimary: '#94d3c1', surfaceTint: '#29695b',
      surface: '#f6fafe', background: '#f6fafe', surfaceBright: '#f6fafe', surfaceDim: '#d6dade',
      surfaceVariant: '#dfe3e7', inverseSurface: '#2c3134', inverseOnSurface: '#edf1f5',
      surfaceContainerLowest: '#ffffff', surfaceContainerLow: '#f0f4f8', surfaceContainer: '#eaeef2',
      surfaceContainerHigh: '#e4e9ed', surfaceContainerHighest: '#dfe3e7',
      onSurface: '#171c1f', onBackground: '#171c1f', onSurfaceVariant: '#3f4945',
      outline: '#707975', outlineVariant: '#bfc9c4',
      tertiary: '#472500', onTertiary: '#ffffff', tertiaryContainer: '#673800', onTertiaryContainer: '#fa9a35',
      tertiaryFixed: '#ffdcc0', tertiaryFixedDim: '#ffb876', onTertiaryFixed: '#2d1600', onTertiaryFixedVariant: '#6b3b00',
      chartPeakLabel: '#673800', insightCardTitle: '#472500', insightCardBody: '#472500', insightCardKicker: '#6b3b00',
      headerGlassFallback: 'rgba(246, 250, 254, 0.96)',
    },
    dark: {
      primary: '#34d399', onPrimary: '#022c22', primaryContainer: '#065f46', onPrimaryContainer: '#a7f3d0',
      primaryFixed: '#064e3b', primaryFixedDim: '#047857', onPrimaryFixed: '#ecfdf5', onPrimaryFixedVariant: '#6ee7b7',
      inversePrimary: '#065f46', surfaceTint: '#34d399',
      surface: '#0f172a', background: '#0f172a', surfaceBright: '#1e293b', surfaceDim: '#0f172a',
      surfaceVariant: '#334155', inverseSurface: '#e2e8f0', inverseOnSurface: '#0f172a',
      surfaceContainerLowest: '#1e293b', surfaceContainerLow: '#1e293b', surfaceContainer: '#1e293b',
      surfaceContainerHigh: '#334155', surfaceContainerHighest: '#475569',
      onSurface: '#f1f5f9', onBackground: '#f1f5f9', onSurfaceVariant: '#94a3b8',
      outline: '#64748b', outlineVariant: 'rgba(148, 163, 184, 0.35)',
      tertiary: '#fdba74', onTertiary: '#0f172a', tertiaryContainer: '#fb923c', onTertiaryContainer: '#fed7aa',
      tertiaryFixed: '#422006', tertiaryFixedDim: '#ea580c', onTertiaryFixed: '#1e293b', onTertiaryFixedVariant: '#fde68a',
      chartPeakLabel: '#34d399', insightCardTitle: '#fef3c7', insightCardBody: '#fde68a', insightCardKicker: '#fcd34d',
      headerGlassFallback: 'rgba(15, 23, 42, 0.94)',
    },
  },

  // ----------------------------- Midnight -----------------------------------
  midnight: {
    light: {
      primary: '#312e81', onPrimary: '#ffffff', primaryContainer: '#ede9fe', onPrimaryContainer: '#312e81',
      primaryFixed: '#ede9fe', primaryFixedDim: '#c4b5fd', onPrimaryFixed: '#1e1b4b', onPrimaryFixedVariant: '#4338ca',
      inversePrimary: '#a5b4fc', surfaceTint: '#6366f1',
      surface: '#fafafa', background: '#f8f8ff', surfaceBright: '#fafafa', surfaceDim: '#e4e4e8',
      surfaceVariant: '#e0e7ff', inverseSurface: '#1e1b4b', inverseOnSurface: '#f0eeff',
      surfaceContainerLowest: '#ffffff', surfaceContainerLow: '#f5f3ff', surfaceContainer: '#ede9fe',
      surfaceContainerHigh: '#ddd6fe', surfaceContainerHighest: '#c4b5fd',
      onSurface: '#0f0a1e', onBackground: '#0f0a1e', onSurfaceVariant: '#4c4a7a',
      outline: '#6d28d9', outlineVariant: 'rgba(109, 40, 217, 0.2)',
      tertiary: '#7c3aed', onTertiary: '#ffffff', tertiaryContainer: '#f5f3ff', onTertiaryContainer: '#4c1d95',
      tertiaryFixed: '#f5f3ff', tertiaryFixedDim: '#ddd6fe', onTertiaryFixed: '#1a0a2e', onTertiaryFixedVariant: '#5b21b6',
      chartPeakLabel: '#312e81', insightCardTitle: '#1e1b4b', insightCardBody: '#312e81', insightCardKicker: '#4338ca',
      headerGlassFallback: 'rgba(250, 250, 250, 0.96)',
    },
    dark: {
      primary: '#818cf8', onPrimary: '#1e1b4b', primaryContainer: '#3730a3', onPrimaryContainer: '#c7d2fe',
      primaryFixed: '#c7d2fe', primaryFixedDim: '#818cf8', onPrimaryFixed: '#1e1b4b', onPrimaryFixedVariant: '#4338ca',
      inversePrimary: '#3730a3', surfaceTint: '#818cf8',
      surface: '#09090b', background: '#09090b', surfaceBright: '#27272a', surfaceDim: '#09090b',
      surfaceVariant: '#27272a', inverseSurface: '#f4f4f5', inverseOnSurface: '#18181b',
      surfaceContainerLowest: '#18181b', surfaceContainerLow: '#27272a', surfaceContainer: '#3f3f46',
      surfaceContainerHigh: '#52525b', surfaceContainerHighest: '#71717a',
      onSurface: '#f4f4f5', onBackground: '#f4f4f5', onSurfaceVariant: '#a1a1aa',
      outline: '#52525b', outlineVariant: 'rgba(161, 161, 170, 0.2)',
      tertiary: '#a78bfa', onTertiary: '#2e1065', tertiaryContainer: '#3730a3', onTertiaryContainer: '#c7d2fe',
      tertiaryFixed: '#1a1338', tertiaryFixedDim: '#251a52', onTertiaryFixed: '#ddd6fe', onTertiaryFixedVariant: '#c4b5fd',
      chartPeakLabel: '#818cf8', insightCardTitle: '#ddd6fe', insightCardBody: '#c4b5fd', insightCardKicker: '#a78bfa',
      headerGlassFallback: 'rgba(9, 9, 11, 0.94)',
    },
  },

  // ----------------------------- Ocean --------------------------------------
  ocean: {
    light: {
      primary: '#1e40af', onPrimary: '#ffffff', primaryContainer: '#dbeafe', onPrimaryContainer: '#1e3a8a',
      primaryFixed: '#dbeafe', primaryFixedDim: '#93c5fd', onPrimaryFixed: '#0c1445', onPrimaryFixedVariant: '#1d4ed8',
      inversePrimary: '#93c5fd', surfaceTint: '#1e40af',
      surface: '#f0f9ff', background: '#f0f9ff', surfaceBright: '#ffffff', surfaceDim: '#cfe8f5',
      surfaceVariant: '#e0f2fe', inverseSurface: '#1e3a8a', inverseOnSurface: '#dbeafe',
      surfaceContainerLowest: '#ffffff', surfaceContainerLow: '#f0f9ff', surfaceContainer: '#e0f2fe',
      surfaceContainerHigh: '#e2e8f0', surfaceContainerHighest: '#cbd5e1',
      onSurface: '#0c1445', onBackground: '#0c1445', onSurfaceVariant: '#334155',
      outline: '#475569', outlineVariant: 'rgba(71, 85, 105, 0.25)',
      tertiary: '#0891b2', onTertiary: '#ffffff', tertiaryContainer: '#cffafe', onTertiaryContainer: '#0891b2',
      tertiaryFixed: '#cffafe', tertiaryFixedDim: '#22d3ee', onTertiaryFixed: '#0a4f5e', onTertiaryFixedVariant: '#0e7490',
      chartPeakLabel: '#1e40af', insightCardTitle: '#1e3a8a', insightCardBody: '#1e40af', insightCardKicker: '#1d4ed8',
      headerGlassFallback: 'rgba(240, 249, 255, 0.96)',
    },
    dark: {
      primary: '#60a5fa', onPrimary: '#1e3a8a', primaryContainer: '#1d4ed8', onPrimaryContainer: '#bfdbfe',
      primaryFixed: '#bfdbfe', primaryFixedDim: '#60a5fa', onPrimaryFixed: '#0c1445', onPrimaryFixedVariant: '#2563eb',
      inversePrimary: '#1e40af', surfaceTint: '#60a5fa',
      surface: '#0c1a2e', background: '#0c1a2e', surfaceBright: '#1e2d3e', surfaceDim: '#0c1a2e',
      surfaceVariant: '#1e2d3e', inverseSurface: '#e0f2fe', inverseOnSurface: '#0c1a2e',
      surfaceContainerLowest: '#0d1b2a', surfaceContainerLow: '#162232', surfaceContainer: '#1e2d3e',
      surfaceContainerHigh: '#283c52', surfaceContainerHighest: '#354d66',
      onSurface: '#e0f2fe', onBackground: '#e0f2fe', onSurfaceVariant: '#93c5fd',
      outline: '#2563eb', outlineVariant: 'rgba(96, 165, 250, 0.2)',
      tertiary: '#22d3ee', onTertiary: '#0a4f5e', tertiaryContainer: '#0891b2', onTertiaryContainer: '#cffafe',
      tertiaryFixed: '#072030', tertiaryFixedDim: '#0a2d42', onTertiaryFixed: '#a5f3fc', onTertiaryFixedVariant: '#67e8f9',
      chartPeakLabel: '#60a5fa', insightCardTitle: '#bfdbfe', insightCardBody: '#93c5fd', insightCardKicker: '#60a5fa',
      headerGlassFallback: 'rgba(12, 26, 46, 0.94)',
    },
  },

  // ----------------------------- Rose ---------------------------------------
  rose: {
    light: {
      primary: '#9f1239', onPrimary: '#ffffff', primaryContainer: '#ffe4e6', onPrimaryContainer: '#9f1239',
      primaryFixed: '#ffe4e6', primaryFixedDim: '#fda4af', onPrimaryFixed: '#4c0519', onPrimaryFixedVariant: '#be123c',
      inversePrimary: '#fda4af', surfaceTint: '#9f1239',
      surface: '#fff1f2', background: '#fff1f2', surfaceBright: '#ffffff', surfaceDim: '#f3d0d5',
      surfaceVariant: '#fce7f3', inverseSurface: '#4a0e1e', inverseOnSurface: '#ffe4e6',
      surfaceContainerLowest: '#ffffff', surfaceContainerLow: '#fff1f2', surfaceContainer: '#fce7f3',
      surfaceContainerHigh: '#f3f4f6', surfaceContainerHighest: '#e5e7eb',
      onSurface: '#1a0a0f', onBackground: '#1a0a0f', onSurfaceVariant: '#6b7280',
      outline: '#9ca3af', outlineVariant: 'rgba(156, 163, 175, 0.3)',
      tertiary: '#c026d3', onTertiary: '#ffffff', tertiaryContainer: '#fdf4ff', onTertiaryContainer: '#7e22ce',
      tertiaryFixed: '#fdf4ff', tertiaryFixedDim: '#e879f9', onTertiaryFixed: '#4a044e', onTertiaryFixedVariant: '#9d174d',
      chartPeakLabel: '#9f1239', insightCardTitle: '#4a0e1e', insightCardBody: '#9f1239', insightCardKicker: '#be123c',
      headerGlassFallback: 'rgba(255, 241, 242, 0.96)',
    },
    dark: {
      primary: '#fb7185', onPrimary: '#4c0519', primaryContainer: '#9f1239', onPrimaryContainer: '#fecdd3',
      primaryFixed: '#fecdd3', primaryFixedDim: '#fb7185', onPrimaryFixed: '#4c0519', onPrimaryFixedVariant: '#be123c',
      inversePrimary: '#9f1239', surfaceTint: '#fb7185',
      surface: '#1a0a0f', background: '#1a0a0f', surfaceBright: '#3d1621', surfaceDim: '#1a0a0f',
      surfaceVariant: '#3d1a2d', inverseSurface: '#fce7f3', inverseOnSurface: '#1a0a0f',
      surfaceContainerLowest: '#22101a', surfaceContainerLow: '#2d1521', surfaceContainer: '#3d1a2d',
      surfaceContainerHigh: '#51243d', surfaceContainerHighest: '#65304e',
      onSurface: '#fce7f3', onBackground: '#fce7f3', onSurfaceVariant: '#f9a8d4',
      outline: '#be185d', outlineVariant: 'rgba(251, 113, 133, 0.2)',
      tertiary: '#e879f9', onTertiary: '#4a044e', tertiaryContainer: '#7e22ce', onTertiaryContainer: '#fdf4ff',
      tertiaryFixed: '#2a0a18', tertiaryFixedDim: '#3d1028', onTertiaryFixed: '#f5d0fe', onTertiaryFixedVariant: '#e879f9',
      chartPeakLabel: '#fb7185', insightCardTitle: '#fecdd3', insightCardBody: '#fda4af', insightCardKicker: '#fb7185',
      headerGlassFallback: 'rgba(26, 10, 15, 0.94)',
    },
  },

  // ----------------------------- Sand ---------------------------------------
  sand: {
    light: {
      primary: '#92400e', onPrimary: '#ffffff', primaryContainer: '#fef3c7', onPrimaryContainer: '#78350f',
      primaryFixed: '#fef3c7', primaryFixedDim: '#fbbf24', onPrimaryFixed: '#451a03', onPrimaryFixedVariant: '#b45309',
      inversePrimary: '#fbbf24', surfaceTint: '#92400e',
      surface: '#fffbf0', background: '#fffbf0', surfaceBright: '#ffffff', surfaceDim: '#e8d9c0',
      surfaceVariant: '#fef9e7', inverseSurface: '#4a2e08', inverseOnSurface: '#fef3c7',
      surfaceContainerLowest: '#ffffff', surfaceContainerLow: '#fffbf0', surfaceContainer: '#fef9e7',
      surfaceContainerHigh: '#f3f0e6', surfaceContainerHighest: '#e5e0d5',
      onSurface: '#1c1401', onBackground: '#1c1401', onSurfaceVariant: '#6b5a3a',
      outline: '#92752e', outlineVariant: 'rgba(146, 117, 46, 0.25)',
      tertiary: '#065f46', onTertiary: '#ffffff', tertiaryContainer: '#d1fae5', onTertiaryContainer: '#065f46',
      tertiaryFixed: '#d1fae5', tertiaryFixedDim: '#34d399', onTertiaryFixed: '#022c22', onTertiaryFixedVariant: '#047857',
      chartPeakLabel: '#92400e', insightCardTitle: '#4a2e08', insightCardBody: '#78350f', insightCardKicker: '#92400e',
      headerGlassFallback: 'rgba(255, 251, 240, 0.96)',
    },
    dark: {
      primary: '#fbbf24', onPrimary: '#451a03', primaryContainer: '#92400e', onPrimaryContainer: '#fef3c7',
      primaryFixed: '#fef3c7', primaryFixedDim: '#fbbf24', onPrimaryFixed: '#451a03', onPrimaryFixedVariant: '#b45309',
      inversePrimary: '#92400e', surfaceTint: '#fbbf24',
      surface: '#1a1200', background: '#1a1200', surfaceBright: '#3d2c00', surfaceDim: '#1a1200',
      surfaceVariant: '#3d2c00', inverseSurface: '#fef3c7', inverseOnSurface: '#1a1200',
      surfaceContainerLowest: '#221800', surfaceContainerLow: '#2d2000', surfaceContainer: '#3d2c00',
      surfaceContainerHigh: '#504000', surfaceContainerHighest: '#665400',
      onSurface: '#fef3c7', onBackground: '#fef3c7', onSurfaceVariant: '#d97706',
      outline: '#b45309', outlineVariant: 'rgba(251, 191, 36, 0.2)',
      tertiary: '#34d399', onTertiary: '#022c22', tertiaryContainer: '#065f46', onTertiaryContainer: '#d1fae5',
      tertiaryFixed: '#1a1400', tertiaryFixedDim: '#2a2000', onTertiaryFixed: '#d1fae5', onTertiaryFixedVariant: '#6ee7b7',
      chartPeakLabel: '#fbbf24', insightCardTitle: '#fef3c7', insightCardBody: '#fde68a', insightCardKicker: '#fbbf24',
      headerGlassFallback: 'rgba(26, 18, 0, 0.94)',
    },
  },

  // ----------------------------- Amethyst ----------------------------------
  amethyst: {
    light: {
      primary: '#4c1d95', onPrimary: '#ffffff', primaryContainer: '#ede9fe', onPrimaryContainer: '#4c1d95',
      primaryFixed: '#ede9fe', primaryFixedDim: '#c4b5fd', onPrimaryFixed: '#1a0a2e', onPrimaryFixedVariant: '#6d28d9',
      inversePrimary: '#c4b5fd', surfaceTint: '#7c3aed',
      surface: '#faf5ff', background: '#faf5ff', surfaceBright: '#ffffff', surfaceDim: '#e8e0f5',
      surfaceVariant: '#ede9fe', inverseSurface: '#2e1065', inverseOnSurface: '#f5f3ff',
      surfaceContainerLowest: '#ffffff', surfaceContainerLow: '#f5f3ff', surfaceContainer: '#ede9fe',
      surfaceContainerHigh: '#e5e7eb', surfaceContainerHighest: '#d1d5db',
      onSurface: '#1a0a2e', onBackground: '#1a0a2e', onSurfaceVariant: '#5b5b7a',
      outline: '#7c3aed', outlineVariant: 'rgba(124, 58, 237, 0.2)',
      tertiary: '#db2777', onTertiary: '#ffffff', tertiaryContainer: '#fce7f3', onTertiaryContainer: '#9d174d',
      tertiaryFixed: '#fce7f3', tertiaryFixedDim: '#f9a8d4', onTertiaryFixed: '#4a0e1e', onTertiaryFixedVariant: '#be185d',
      chartPeakLabel: '#4c1d95', insightCardTitle: '#2e1065', insightCardBody: '#4c1d95', insightCardKicker: '#6d28d9',
      headerGlassFallback: 'rgba(250, 245, 255, 0.96)',
    },
    dark: {
      primary: '#a78bfa', onPrimary: '#2e1065', primaryContainer: '#5b21b6', onPrimaryContainer: '#ddd6fe',
      primaryFixed: '#ddd6fe', primaryFixedDim: '#a78bfa', onPrimaryFixed: '#1a0a2e', onPrimaryFixedVariant: '#6d28d9',
      inversePrimary: '#5b21b6', surfaceTint: '#a78bfa',
      surface: '#0f0a1e', background: '#0f0a1e', surfaceBright: '#261844', surfaceDim: '#0f0a1e',
      surfaceVariant: '#2e1b5f', inverseSurface: '#ede9fe', inverseOnSurface: '#0f0a1e',
      surfaceContainerLowest: '#180f33', surfaceContainerLow: '#21154a', surfaceContainer: '#2e1b5f',
      surfaceContainerHigh: '#3d2875', surfaceContainerHighest: '#4c3380',
      onSurface: '#ede9fe', onBackground: '#ede9fe', onSurfaceVariant: '#c4b5fd',
      outline: '#7c3aed', outlineVariant: 'rgba(167, 139, 250, 0.2)',
      tertiary: '#f472b6', onTertiary: '#5b0a3c', tertiaryContainer: '#9d174d', onTertiaryContainer: '#fce7f3',
      tertiaryFixed: '#1a0a2e', tertiaryFixedDim: '#2e1548', onTertiaryFixed: '#f5d0fe', onTertiaryFixedVariant: '#e879f9',
      chartPeakLabel: '#a78bfa', insightCardTitle: '#ddd6fe', insightCardBody: '#c4b5fd', insightCardKicker: '#a78bfa',
      headerGlassFallback: 'rgba(15, 10, 30, 0.94)',
    },
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function getSemanticColors(scheme: ColorSchemeName, theme: ThemeName = 'veridian') {
  const shared = scheme === 'dark' ? DARK_SHARED : LIGHT_SHARED;
  const core = CORES[theme][scheme];
  const p = { ...shared, ...core };
  return {
    ...p,
    chromeSurface: p.surfaceContainerLow,
    tabBarInactive: p.onSurfaceVariant,
    tabBarActiveBg: p.primary,
    tabBarActiveFg: p.onPrimary,
  };
}

export type SemanticColors = ReturnType<typeof getSemanticColors>;

// Legacy named exports (kept for backward compat — these are the veridian palettes)
export const palette = { ...LIGHT_SHARED, ...CORES.veridian.light };
export const paletteDark = { ...DARK_SHARED, ...CORES.veridian.dark };
