import * as Haptics from 'expo-haptics';

/** Light tap feedback (iOS). Safe no-op elsewhere unless Expo adds Android parity. */
export function lightImpact(): void {
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}
