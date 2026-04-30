import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';

// Cache the reduce-motion preference at module level to avoid async checks on every haptic.
let _reduceMotionEnabled = false;

// Listen for changes to the reduce-motion system setting.
AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
  _reduceMotionEnabled = enabled;
});
AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
  _reduceMotionEnabled = enabled;
});

/** Light tap feedback (iOS). Respects system reduce-motion setting. */
export function lightImpact(): void {
  if (_reduceMotionEnabled) return;
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

/** Warning haptic for destructive action confirmations (iOS). Respects system reduce-motion setting. */
export function warningHaptic(): void {
  if (_reduceMotionEnabled) return;
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
}

/** Error haptic for failed operations or critical alerts (iOS). Respects system reduce-motion setting. */
export function errorHaptic(): void {
  if (_reduceMotionEnabled) return;
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
}
