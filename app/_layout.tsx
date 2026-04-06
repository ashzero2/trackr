import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { NavigationThemeRoot } from '@/components/navigation-theme-root';
import { ColorSchemeProvider } from '@/contexts/color-scheme-context';
import { DatabaseProvider } from '@/contexts/database-context';
import { UserProfileProvider } from '@/contexts/user-profile-context';
import { useAppFonts } from '@/hooks/use-app-fonts';

SplashScreen.preventAutoHideAsync();

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
    <ColorSchemeProvider>
      <UserProfileProvider>
        <DatabaseProvider>
          <NavigationThemeRoot>
            <Stack initialRouteName="index">
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="add-transaction"
              options={{
                presentation: 'modal',
                title: 'Add transaction',
              }}
            />
            <Stack.Screen name="manage-categories" options={{ title: 'Categories' }} />
            <Stack.Screen name="manage-budgets" options={{ title: 'Budgets' }} />
            </Stack>
          </NavigationThemeRoot>
        </DatabaseProvider>
      </UserProfileProvider>
    </ColorSchemeProvider>
  );
}
