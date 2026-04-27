import { memo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { useAppColors } from '@/contexts/color-scheme-context';
import { bodyFont, labelFont } from '@/constants/typography';

export type SpendingTrendChartProps = {
  values: number[];
  labels: string[];
  height?: number;
  subtitle?: string;
  peakLabel?: string;
};

function buildPolylinePoints(values: number[], w: number, h: number): string {
  if (values.length === 0) return '';
  const max = Math.max(...values, 1);
  const padY = h * 0.12;
  const innerH = h - padY * 2;
  const n = values.length;
  return values
    .map((v, i) => {
      const x = (i / Math.max(n - 1, 1)) * w;
      const y = h - padY - (v / max) * innerH;
      return `${x},${y}`;
    })
    .join(' ');
}

/** SVG implementation — memoised so it only re-renders when values or labels change by value. */
function SpendingTrendChartSvgBase({
  values,
  labels,
  height = 120,
  subtitle,
  peakLabel,
}: SpendingTrendChartProps) {
  const { colors } = useAppColors();
  const { width: screenW } = useWindowDimensions();
  /** Scroll padding 48 + card horizontal padding 40 — keep chart inside screen */
  const width = Math.max(200, Math.min(320, screenW - 88));
  const ptsMain = buildPolylinePoints(values, width, height);
  const ptsGhost = buildPolylinePoints(
    values.map((v) => v * 0.82),
    width,
    height,
  );

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
      <Svg width={width} height={height}>
        <Polyline
          points={ptsGhost}
          fill="none"
          stroke={colors.primaryContainer}
          strokeOpacity={0.45}
          strokeWidth={3}
        />
        <Polyline points={ptsMain} fill="none" stroke={colors.primary} strokeWidth={4} />
      </Svg>
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

function arePropsEqual(prev: SpendingTrendChartProps, next: SpendingTrendChartProps): boolean {
  if (prev.height !== next.height) return false;
  if (prev.subtitle !== next.subtitle) return false;
  if (prev.peakLabel !== next.peakLabel) return false;
  if (prev.values.length !== next.values.length) return false;
  if (prev.labels.length !== next.labels.length) return false;
  for (let i = 0; i < prev.values.length; i++) {
    if (prev.values[i] !== next.values[i]) return false;
  }
  for (let i = 0; i < prev.labels.length; i++) {
    if (prev.labels[i] !== next.labels[i]) return false;
  }
  return true;
}

export const SpendingTrendChartSvg = memo(SpendingTrendChartSvgBase, arePropsEqual);

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
