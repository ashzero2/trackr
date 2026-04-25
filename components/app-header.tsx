import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { headlineFont } from '@/constants/typography';
import { useAppColors } from '@/contexts/color-scheme-context';
import { useUserProfile } from '@/contexts/user-profile-context';
import { TravelTrackingBanner } from '@/components/travel-tracking-banner';
import { greetingForSession } from '@/lib/greetings';

type AppHeaderProps = {
  /** Override the greeting with a static title */
  title?: string;
  /** Slot rendered on the right side of the header row */
  right?: React.ReactNode;
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

export function AppHeader({ title, right }: AppHeaderProps) {
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

  const displayTitle = title ?? greeting;

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
            numberOfLines={1}>
            {displayTitle}
          </Text>
        </View>
        {right ? <View style={styles.rightSlot}>{right}</View> : null}
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
  rightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
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
});
