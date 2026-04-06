import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppColors } from '@/contexts/color-scheme-context';

const SIZE = 56;
const TAB_BAR_CLEARANCE = 88;

type FabGradientProps = {
  onPress: () => void;
  accessibilityLabel: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
};

export function FabGradient({
  onPress,
  accessibilityLabel,
  icon = 'add',
}: FabGradientProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppColors();
  const bottom = Math.max(insets.bottom, 12) + TAB_BAR_CLEARANCE;

  return (
    <View style={[styles.wrap, { bottom, right: 24 }]} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.pressed]}>
        <LinearGradient
          colors={[colors.primary, colors.primaryContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}>
          <MaterialIcons name={icon} size={30} color={colors.onPrimary} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 30,
  },
  gradient: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.96 }],
  },
});
