import { useEffect } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';

import { useAppColors } from '@/contexts/color-scheme-context';

type SkeletonProps = {
  /** Width of the placeholder. Can be number or percentage string. */
  width: number | `${number}%`;
  /** Height of the placeholder. */
  height: number;
  /** Border radius. Default 12. */
  borderRadius?: number;
  /** Extra style overrides. */
  style?: ViewStyle;
};

/**
 * A shimmer skeleton placeholder using react-native-reanimated.
 * Pulses opacity between 0.3 and 1.0 to simulate loading content.
 */
export function Skeleton({ width, height, borderRadius = 12, style }: SkeletonProps) {
  const { colors } = useAppColors();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1, // infinite
      true, // reverse
    );
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.3, 0.7]),
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.surfaceContainerHighest,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** A row-shaped skeleton mimicking a transaction row. */
export function SkeletonTransactionRow() {
  return (
    <Animated.View style={skeletonStyles.row}>
      <Skeleton width={48} height={48} borderRadius={16} />
      <Animated.View style={skeletonStyles.mid}>
        <Skeleton width="70%" height={14} borderRadius={7} />
        <Skeleton width="40%" height={10} borderRadius={5} />
      </Animated.View>
      <Animated.View style={skeletonStyles.right}>
        <Skeleton width={60} height={14} borderRadius={7} />
        <Skeleton width={40} height={10} borderRadius={5} />
      </Animated.View>
    </Animated.View>
  );
}

/** A card-shaped skeleton for bento/summary cards. */
export function SkeletonCard({ width = '100%' as number | `${number}%`, height = 100 }: { width?: number | `${number}%`; height?: number }) {
  return <Skeleton width={width} height={height} borderRadius={24} />;
}

const skeletonStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  mid: {
    flex: 1,
    gap: 6,
  },
  right: {
    alignItems: 'flex-end',
    gap: 6,
  },
});