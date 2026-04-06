/**
 * Loaded via expo-font / Google Fonts — keys must match useAppFonts().
 */
export const FontFamily = {
  manropeRegular: 'Manrope_400Regular',
  manropeSemiBold: 'Manrope_600SemiBold',
  manropeBold: 'Manrope_700Bold',
  manropeExtraBold: 'Manrope_800ExtraBold',
  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
} as const;

/** Display & large currency (Manrope) */
export const displayFont = FontFamily.manropeExtraBold;
/** Section titles */
export const headlineFont = FontFamily.manropeBold;
/** Body copy */
export const bodyFont = FontFamily.interRegular;
export const bodyMediumFont = FontFamily.interMedium;
/** Labels, chips */
export const labelFont = FontFamily.interSemiBold;
