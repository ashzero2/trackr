import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { NavigationThemeRoot } from '@/components/navigation-theme-root';
import { ColorSchemeProvider } from '@/contexts/color-scheme-context';
import { DatabaseProvider, useDatabase } from '@/contexts/database-context';
import { UserProfileProvider } from '@/contexts/user-profile-context';
import { useAppFonts } from '@/hooks/use-app-fonts';
import { checkBudgetAlerts } from '@/lib/budget-alert';
import { checkAndProcessRecurring } from '@/lib/recurrence-checker';
import { requestNotificationPermission } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

/** Requests notification permission once on first launch. */
function NotificationPermissionRequester() {
  const { ready } = useDatabase();
  const requested = useRef(false);

  useEffect(() => {
    if (!ready || requested.current) return;
    requested.current = true;
    void requestNotificationPermission();
  }, [ready]);

  return null;
}

/**
 * Watches `dataVersion` and fires budget alerts whenever a transaction is written.
 * This avoids passing repo references through the TransactionRepository constructor.
 */
function BudgetAlertWatcher() {
  const { dataVersion, transactions, budgets } = useDatabase();
  const prevVersion = useRef(dataVersion);

  useEffect(() => {
    if (dataVersion === prevVersion.current) return;
    prevVersion.current = dataVersion;
    if (transactions && budgets) {
      const now = new Date();
      void checkBudgetAlerts(
        { transactions, budgets },
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
      );
    }
  }, [dataVersion, transactions, budgets]);

  return null;
}

/** Runs the recurrence checker whenever the app comes to the foreground. */
function RecurrenceAppStateListener() {
  const { recurring, transactions, ready } = useDatabase();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!ready) return;
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        if (recurring && transactions) {
          void checkAndProcessRecurring({ recurring, transactions });
        }
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [ready, recurring, transactions]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ColorSchemeProvider>
      <UserProfileProvider>
        <DatabaseProvider>
          <NotificationPermissionRequester />
          <BudgetAlertWatcher />
          <RecurrenceAppStateListener />
          <NavigationThemeRoot>
            <Stack initialRouteName="index">
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="add-transaction"
                options={{ presentation: 'modal', title: 'Add transaction' }}
              />
              <Stack.Screen name="manage-categories" options={{ title: 'Categories' }} />
              <Stack.Screen name="manage-budgets" options={{ title: 'Budgets' }} />
              <Stack.Screen name="manage-trips" options={{ title: 'Trips', headerShown: false }} />
              <Stack.Screen name="trip-detail" options={{ title: 'Trip' }} />
              <Stack.Screen name="manage-recurring" options={{ title: 'Recurring', headerShown: false }} />
              <Stack.Screen
                name="add-recurring"
                options={{ presentation: 'modal', title: 'New recurring rule' }}
              />
              <Stack.Screen name="notification-settings" options={{ title: 'Notifications', headerShown: false }} />
            </Stack>
          </NavigationThemeRoot>
        </DatabaseProvider>
      </UserProfileProvider>
    </ColorSchemeProvider>
    </GestureHandlerRootView>
  );
}
