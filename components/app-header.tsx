import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { headlineFont } from '@/constants/typography';
import { useAppColors } from '@/contexts/color-scheme-context';
import { useUserProfile } from '@/contexts/user-profile-context';
import { TravelTrackingBanner } from '@/components/travel-tracking-banner';
import { greetingForSession } from '@/lib/greetings';

type AppHeaderProps = {
  onNotificationsPress?: () => void;
};

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function AppHeader({ onNotificationsPress }: AppHeaderProps) {
  const { colors } = useAppColors();
  const { displayName, petAvatarUrl } = useUserProfile();
  const titleColor = colors.primary;
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [petAvatarUrl]);

  const greeting = useMemo(() => greetingForSession(displayName), [displayName]);
  const initials = useMemo(() => initialsFromName(displayName), [displayName]);
  const showPet = Boolean(petAvatarUrl) && !avatarFailed;

  return (
    <View style={styles.wrapper}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.headerGlassFallback }]} />
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}>
            {showPet ? (
              <Image
                source={{ uri: petAvatarUrl! }}
                style={styles.avatarImage}
                contentFit="cover"
                accessibilityIgnoresInvertColors
                accessibilityLabel="Profile picture"
                onError={() => setAvatarFailed(true)}
              />
            ) : initials ? (
              <Text style={[styles.initials, { color: colors.onPrimary }, { fontFamily: headlineFont }]}>
                {initials}
              </Text>
            ) : (
              <MaterialIcons name="person" size={22} color={colors.onPrimary} />
            )}
          </View>
          <Text
            style={[styles.title, { color: titleColor }, { fontFamily: headlineFont }]}
            accessibilityRole="header"
            accessibilityLabel={greeting}
            numberOfLines={1}>
            {greeting}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          onPress={() => {
            void onNotificationsPress?.();
          }}
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}>
          <MaterialIcons name="notifications-none" size={24} color={titleColor} />
        </Pressable>
      </View>
      <TravelTrackingBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    zIndex: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  initials: {
    fontSize: 14,
    fontWeight: '800',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    flex: 1,
  },
  iconButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    padding: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
