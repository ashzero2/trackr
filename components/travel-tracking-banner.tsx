import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { labelFont } from '@/constants/typography';
import { useAppColors } from '@/contexts/color-scheme-context';
import { useDatabase } from '@/contexts/database-context';
import { useUserProfile } from '@/contexts/user-profile-context';

export function TravelTrackingBanner() {
  const { colors } = useAppColors();
  const { travelModeEnabled, activeTripId } = useUserProfile();
  const { ready, trips } = useDatabase();
  const [tripName, setTripName] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !trips || !activeTripId) {
      setTripName(null);
      return;
    }
    let alive = true;
    trips.getById(activeTripId).then((t) => {
      if (alive) setTripName(t?.name ?? null);
    });
    return () => {
      alive = false;
    };
  }, [ready, trips, activeTripId]);

  if (!travelModeEnabled) {
    return null;
  }

  const message = activeTripId
    ? tripName
      ? `Currently tracking: ${tripName}`
      : 'Currently tracking: …'
    : 'Travel mode on — choose or create an active trip in Settings.';

  return (
    <View style={[styles.wrap, { backgroundColor: colors.secondaryContainer }]}>
      <Text style={[styles.text, { color: colors.onSecondaryContainer, fontFamily: labelFont }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
