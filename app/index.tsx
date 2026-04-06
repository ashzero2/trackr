import { Redirect, type Href } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAppColors } from '@/contexts/color-scheme-context';
import { useUserProfile } from '@/contexts/user-profile-context';

export default function Index() {
  const { ready, onboardingComplete } = useUserProfile();
  const { colors } = useAppColors();

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!onboardingComplete) {
    return <Redirect href={'/onboarding' as unknown as Href} />;
  }

  return <Redirect href="/(tabs)" />;
}
