import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useAppColors } from '@/contexts/color-scheme-context';
import { bodyFont, labelFont } from '@/constants/typography';

import type { SpendingTrendChartProps } from '@/components/spending-trend-chart-svg';

function buildStrokePath(values: number[], w: number, h: number, scale: number): ReturnType<typeof Skia.Path.Make> {
  const p = Skia.Path.Make();
  if (values.length === 0) return p;
  const max = Math.max(...values, 1);
  const padY = h * 0.12;
  const innerH = h - padY * 2;
  const n = values.length;
  for (let i = 0; i < n; i++) {
    const v = values[i]! * scale;
    const x = (i / Math.max(n - 1, 1)) * w;
    const y = h - padY - (v / max) * innerH;
    if (i === 0) {
      p.moveTo(x, y);
    } else {
      p.lineTo(x, y);
    }
  }
  return p;
}

export function SpendingTrendChartSkia({
  values,
  labels,
  height = 120,
  subtitle,
  peakLabel,
}: SpendingTrendChartProps) {
  const { colors } = useAppColors();
  const { width: screenW } = useWindowDimensions();
  const width = Math.max(200, Math.min(320, screenW - 88));

  const ghostPath = useMemo(
    () => buildStrokePath(values, width, height, 0.82),
    [values, width, height],
  );
  const mainPath = useMemo(() => buildStrokePath(values, width, height, 1), [values, width, height]);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surfaceContainerLowest }]}>
      <View style={styles.headerBlock}>
        <View style={styles.headerTitles}>
          <Text style={[styles.title, { color: colors.primary, fontFamily: labelFont }]}>
            Spending trend
          </Text>
          {subtitle ? (
            <Text style={[styles.sub, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {peakLabel ? (
          <Text
            style={[styles.peakText, { color: colors.chartPeakLabel, fontFamily: labelFont }]}
            numberOfLines={2}>
            {peakLabel}
          </Text>
        ) : null}
      </View>
      <Canvas style={{ width, height }}>
        <Path
          path={ghostPath}
          style="stroke"
          strokeWidth={3}
          color={colors.primaryContainer}
          opacity={0.45}
        />
        <Path path={mainPath} style="stroke" strokeWidth={4} color={colors.primary} />
      </Canvas>
      <View style={styles.labels}>
        {labels.map((lb) => (
          <Text
            key={lb}
            style={[styles.axis, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>
            {lb}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 24,
    padding: 20,
    gap: 8,
  },
  headerBlock: {
    marginBottom: 4,
    gap: 6,
  },
  headerTitles: {
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  sub: {
    fontSize: 12,
    marginTop: 2,
  },
  peakText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    alignSelf: 'stretch',
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  axis: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
