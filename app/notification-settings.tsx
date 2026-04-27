import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { bodyFont, headlineFont, labelFont } from '@/constants/typography';
import { useAppColors } from '@/contexts/color-scheme-context';
import {
  NOTIF_KEY,
  cancelNotification,
  requestNotificationPermission,
  scheduleDailySummary,
  scheduleWeeklySummary,
} from '@/lib/notifications';

type NotifSetting = {
  key: keyof typeof NOTIF_KEY;
  label: string;
  subtitle: string;
  defaultValue: boolean;
};

const SETTINGS: NotifSetting[] = [
  {
    key: 'budgetAlert',
    label: 'Budget alerts',
    subtitle: 'Notify when a category budget reaches 80% or 100%',
    defaultValue: true,
  },
  {
    key: 'recurringReminder',
    label: 'Recurring reminders',
    subtitle: 'Notify when a recurring transaction is due for confirmation',
    defaultValue: true,
  },
  {
    key: 'weeklySummary',
    label: 'Weekly summary',
    subtitle: 'Every Sunday at 9:00 AM — open Trackr to review the week',
    defaultValue: true,
  },
  {
    key: 'dailySummary',
    label: 'Daily summary',
    subtitle: 'Every evening at 9:00 PM — quick daily check-in',
    defaultValue: false,
  },
];

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { colors } = useAppColors();
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      const result: Record<string, boolean> = {};
      for (const s of SETTINGS) {
        const stored = await AsyncStorage.getItem(NOTIF_KEY[s.key]);
        result[s.key] = stored === null ? s.defaultValue : stored !== 'false';
      }
      setValues(result);
      setLoading(false);
    };
    void load();
  }, []);

  const onToggle = async (key: keyof typeof NOTIF_KEY, next: boolean) => {
    // Request permission when user enables any notification type
    if (next) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          'Permission required',
          'Enable notifications in your device settings to receive alerts from Trackr.',
        );
        return;
      }
    }

    await AsyncStorage.setItem(NOTIF_KEY[key], next ? 'true' : 'false');
    setValues((prev) => ({ ...prev, [key]: next }));

    // Handle scheduled summary notifications
    if (key === 'weeklySummary') {
      if (next) {
        await scheduleWeeklySummary();
      } else {
        await cancelNotification('trackr-weekly-summary');
      }
    }
    if (key === 'dailySummary') {
      if (next) {
        await scheduleDailySummary();
      } else {
        await cancelNotification('trackr-daily-summary');
      }
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backRow}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontFamily: labelFont, fontWeight: '700' }}>Back</Text>
        </Pressable>

        <Text style={[styles.title, { color: colors.primary, fontFamily: headlineFont }]}>
          Notifications
        </Text>
        <Text style={[styles.hint, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
          All notifications are local — no data leaves your device. Toggling off stops future alerts
          but does not revoke system permission.
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <View style={styles.list}>
            {SETTINGS.map((s) => (
              <View
                key={s.key}
                style={[styles.row, { backgroundColor: colors.surfaceContainerLow }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: bodyFont, fontWeight: '700', color: colors.onSurface, fontSize: 15 }}>
                    {s.label}
                  </Text>
                  <Text style={{ fontFamily: bodyFont, color: colors.onSurfaceVariant, fontSize: 12, marginTop: 2, lineHeight: 17 }}>
                    {s.subtitle}
                  </Text>
                </View>
                <Switch
                  value={values[s.key] ?? s.defaultValue}
                  onValueChange={(v) => void onToggle(s.key, v)}
                  trackColor={{ false: colors.outlineVariant, true: colors.primaryContainer }}
                  thumbColor={values[s.key] ? colors.primary : colors.surfaceContainerLowest}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 80, paddingTop: 8, gap: 16 },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: MIN_TOUCH_TARGET,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    padding: 16,
  },
});