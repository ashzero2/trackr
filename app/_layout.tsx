import { Stack } from 'expo-router';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AppLockScreen } from '@/components/app-lock-screen';
import { NavigationThemeRoot } from '@/components/navigation-theme-root';
import { AppLockProvider, useAppLock } from '@/contexts/app-lock-context';
import { ColorSchemeProvider, useAppColors } from '@/contexts/color-scheme-context';
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

/** Stack navigator with theme-aware contentStyle to prevent white flash on pop transitions. */
function ThemedStack() {
  const { colors } = useAppColors();

  return (
    <Stack
      initialRouteName="index"
      screenOptions={{
        animation: 'slide_from_right',
        animationDuration: 250,
        contentStyle: { backgroundColor: colors.surface },
      } as NativeStackNavigationOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="add-transaction"
        options={{
          presentation: 'modal',
          title: 'Add transaction',
          animation: 'slide_from_bottom',
          contentStyle: { backgroundColor: colors.surface },
        } as NativeStackNavigationOptions}
      />
      <Stack.Screen name="manage-categories" options={{ title: 'Categories', contentStyle: { backgroundColor: colors.surface } } as NativeStackNavigationOptions} />
      <Stack.Screen name="manage-budgets" options={{ title: 'Budgets', contentStyle: { backgroundColor: colors.surface } } as NativeStackNavigationOptions} />
      <Stack.Screen name="manage-trips" options={{ title: 'Trips', headerShown: false, contentStyle: { backgroundColor: colors.surface } } as NativeStackNavigationOptions} />
      <Stack.Screen name="trip-detail" options={{ title: 'Trip', contentStyle: { backgroundColor: colors.surface } } as NativeStackNavigationOptions} />
      <Stack.Screen name="manage-recurring" options={{ title: 'Recurring', headerShown: false, contentStyle: { backgroundColor: colors.surface } } as NativeStackNavigationOptions} />
      <Stack.Screen
        name="add-recurring"
        options={{
          presentation: 'modal',
          title: 'New recurring rule',
          animation: 'slide_from_bottom',
          contentStyle: { backgroundColor: colors.surface },
        } as NativeStackNavigationOptions}
      />
      <Stack.Screen name="notification-settings" options={{ title: 'Notifications', headerShown: false, contentStyle: { backgroundColor: colors.surface } } as NativeStackNavigationOptions} />
      <Stack.Screen name="setup-app-lock" options={{ title: 'App Lock', headerShown: true, contentStyle: { backgroundColor: colors.surface } } as NativeStackNavigationOptions} />
      <Stack.Screen name="exbot-settings" options={{ title: 'Exbot Settings', headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.surface } } as NativeStackNavigationOptions} />
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
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ColorSchemeProvider>
      <UserProfileProvider>
        <AppLockProvider>
          <AppLockGate>
            <DatabaseProvider>
              <NotificationPermissionRequester />
              <BudgetAlertWatcher />
              <RecurrenceAppStateListener />
              <NavigationThemeRoot>
                <ThemedStack />
              </NavigationThemeRoot>
            </DatabaseProvider>
          </AppLockGate>
        </AppLockProvider>
      </UserProfileProvider>
    </ColorSchemeProvider>
    </GestureHandlerRootView>
  );
}
