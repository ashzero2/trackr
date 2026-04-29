import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AppLockScreen } from '@/components/app-lock-screen';
import { ErrorBoundary } from '@/components/error-boundary';
import { NavigationThemeRoot } from '@/components/navigation-theme-root';
import { AppLockProvider, useAppLock } from '@/contexts/app-lock-context';
import { ColorSchemeProvider, useAppColors } from '@/contexts/color-scheme-context';
import { DatabaseProvider, useDatabase } from '@/contexts/database-context';
import { UserProfileProvider } from '@/contexts/user-profile-context';
import { useAppFonts } from '@/hooks/use-app-fonts';
import { checkBudgetAlerts, cleanupStaleBudgetAlertKeys } from '@/lib/budget-alert';
import { checkAndProcessRecurring } from '@/lib/recurrence-checker';
import { requestNotificationPermission } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

/** Requests notification permission once on first launch and cleans up stale alert keys. */
function NotificationPermissionRequester() {
  const { ready } = useDatabase();
  const requested = useRef(false);

  useEffect(() => {
    if (!ready || requested.current) return;
    requested.current = true;
    void requestNotificationPermission();
    void cleanupStaleBudgetAlertKeys();
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

/**
 * Renders the full-screen lock overlay when the app is locked.
 * Must be inside AppLockProvider, ColorSchemeProvider, and UserProfileProvider.
 */
function AppLockGate({ children }: { children: React.ReactNode }) {
  const { isLocked, ready } = useAppLock();
  // While the lock context is loading, render nothing (splash screen is still showing)
  if (!ready) return null;
  if (isLocked) return <AppLockScreen />;
  return <>{children}</>;
}

/**
 * GestureHandlerRootView with theme-aware background so no white bleeds
 * through during screen transitions.
 */
function ThemedGestureRoot({ children }: { children: React.ReactNode }) {
  const { colors } = useAppColors();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      {children}
    </GestureHandlerRootView>
  );
}

/** Stack navigator with theme-aware contentStyle to prevent white flashes during transitions. */
function AppStack() {
  const { colors } = useAppColors();

  const screenOptions = useMemo(
    () => ({
      contentStyle: { backgroundColor: colors.surface },
      animation: 'ios_from_right' as const,
    }),
    [colors.surface],
  );

  const modalOptions = useMemo(
    () => ({
      presentation: 'modal' as const,
      animation: 'slide_from_bottom' as const,
      contentStyle: { backgroundColor: colors.surface },
    }),
    [colors.surface],
  );

  return (
    <Stack initialRouteName="index" screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="add-transaction"
        options={{ ...modalOptions, title: 'Add transaction' }}
      />
      <Stack.Screen name="manage-categories" options={{ title: 'Categories' }} />
      <Stack.Screen name="manage-budgets" options={{ title: 'Budgets' }} />
      <Stack.Screen name="manage-trips" options={{ title: 'Trips', headerShown: false }} />
      <Stack.Screen name="trip-detail" options={{ title: 'Trip' }} />
      <Stack.Screen name="manage-recurring" options={{ title: 'Recurring', headerShown: false }} />
      <Stack.Screen
        name="add-recurring"
        options={{ ...modalOptions, title: 'New recurring rule' }}
      />
      <Stack.Screen name="notification-settings" options={{ title: 'Notifications', headerShown: false }} />
      <Stack.Screen name="setup-app-lock" options={{ title: 'App Lock', headerShown: true }} />
      <Stack.Screen name="exbot-settings" options={{ title: 'Exbot Settings', headerShown: false }} />
    </Stack>
  );
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
    <ErrorBoundary>
      <ColorSchemeProvider>
        <ThemedGestureRoot>
          <UserProfileProvider>
            <AppLockProvider>
              <AppLockGate>
                <DatabaseProvider>
                  <NotificationPermissionRequester />
                  <BudgetAlertWatcher />
                  <RecurrenceAppStateListener />
                  <NavigationThemeRoot>
                    <AppStack />
                  </NavigationThemeRoot>
                </DatabaseProvider>
              </AppLockGate>
            </AppLockProvider>
          </UserProfileProvider>
        </ThemedGestureRoot>
      </ColorSchemeProvider>
    </ErrorBoundary>
  );
}
