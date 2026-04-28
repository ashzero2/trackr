import * as Haptics from 'expo-haptics';

/** Light tap feedback (iOS). Safe no-op elsewhere unless Expo adds Android parity. */
export function lightImpact(): void {
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

/** Warning haptic for destructive action confirmations (iOS). */
export function warningHaptic(): void {
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
}

/** Error haptic for failed operations or critical alerts (iOS). */
export function errorHaptic(): void {
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
}
