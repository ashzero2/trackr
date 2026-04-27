import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** AsyncStorage keys for per-type opt-in flags. */
export const NOTIF_KEY = {
  budgetAlert: '@trackr/notif-budget-alert',
  recurringReminder: '@trackr/notif-recurring-reminder',
  weeklySummary: '@trackr/notif-weekly-summary',
  dailySummary: '@trackr/notif-daily-summary',
} as const;

/**
 * Request notification permissions.
 * On Android 13+ this shows the system permission dialog.
 * Returns `true` if granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export type ScheduleLocalParams = {
  id: string;
  title: string;
  body: string;
  /** Fire immediately (default) or at a specific date. */
  triggerDate?: Date;
  /** Data payload passed to the notification handler. */
  data?: Record<string, unknown>;
};

/**
 * Schedule (or immediately display) a local notification.
 * If `triggerDate` is in the past or not provided, the notification fires immediately.
 */
export async function scheduleLocal(params: ScheduleLocalParams): Promise<void> {
  const trigger: Notifications.NotificationTriggerInput =
    params.triggerDate && params.triggerDate > new Date()
      ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: params.triggerDate }
      : null; // null = show immediately

  await Notifications.scheduleNotificationAsync({
    identifier: params.id,
    content: {
      title: params.title,
      body: params.body,
      data: params.data ?? {},
    },
    trigger,
  });
}

/** Cancel a specific scheduled notification by its identifier. */
export async function cancelNotification(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
}

/** Cancel all pending scheduled notifications. */
export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Schedule a weekly summary notification (every Sunday at 9:00 AM local time).
 * Uses a repeating weekly trigger.
 */
export async function scheduleWeeklySummary(): Promise<void> {
  // Cancel existing to avoid duplicates
  await cancelNotification('trackr-weekly-summary');

  await Notifications.scheduleNotificationAsync({
    identifier: 'trackr-weekly-summary',
    content: {
      title: '📊 Your weekly spending summary',
      body: 'Open Trackr to see where your money went this week.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // Sunday (expo-notifications: 1=Sunday)
      hour: 9,
      minute: 0,
    },
  });
}

/**
 * Schedule a daily summary notification at 9:00 PM local time.
 */
export async function scheduleDailySummary(): Promise<void> {
  await cancelNotification('trackr-daily-summary');

  await Notifications.scheduleNotificationAsync({
    identifier: 'trackr-daily-summary',
    content: {
      title: '💸 Daily spending check-in',
      body: 'Tap to review today\'s transactions.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 21,
      minute: 0,
    },
  });
}