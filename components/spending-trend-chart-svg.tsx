import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';

import { useAppColors } from '@/contexts/color-scheme-context';
import { bodyFont, labelFont } from '@/constants/typography';

export type SpendingTrendChartProps = {
  values: number[];
  labels: string[];
  height?: number;
  subtitle?: string;
  peakLabel?: string;
  onPointPress?: (index: number, value: number, label: string, x: number) => void;
  selectedIndex?: number | null;
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
  onPointPress,
  selectedIndex,
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

  // Build an accessible description of the chart data
  const a11yDescription = useMemo(() => {
    if (values.length === 0) return 'No spending data available.';
    const pairs = values.map((v, i) => `${labels[i] ?? `Point ${i + 1}`}: ${v.toLocaleString()}`);
    const total = values.reduce((s, v) => s + v, 0);
    const max = Math.max(...values);
    const maxIdx = values.indexOf(max);
    const peakInfo = labels[maxIdx] ? `Peak: ${labels[maxIdx]} at ${max.toLocaleString()}.` : '';
    return `Spending trend chart with ${values.length} data points. ${peakInfo} Total: ${total.toLocaleString()}. Data: ${pairs.join(', ')}.`;
  }, [values, labels]);

  // Pre-compute data point positions for touch targets and highlight
  const pointPositions = useMemo(() => {
    if (values.length === 0) return [];
    const max = Math.max(...values, 1);
    const padY = height * 0.12;
    const innerH = height - padY * 2;
    const n = values.length;
    return values.map((v, i) => ({
      x: (i / Math.max(n - 1, 1)) * width,
      y: height - padY - (v / max) * innerH,
    }));
  }, [values, width, height]);

  return (
    <View
      style={[styles.wrap, { backgroundColor: colors.surfaceContainerLowest }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Spending trend. ${subtitle ?? ''}`}
      accessibilityHint={a11yDescription}>
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
        {/* Selected point highlight */}
        {selectedIndex != null && pointPositions[selectedIndex] ? (
          <Circle
            cx={pointPositions[selectedIndex].x}
            cy={pointPositions[selectedIndex].y}
            r={7}
            fill={colors.primary}
            stroke={colors.surfaceContainerLowest}
            strokeWidth={3}
          />
        ) : null}
        {/* Invisible touch targets for each data point */}
        {onPointPress
          ? pointPositions.map((pt, i) => (
              <Rect
                key={i}
                x={pt.x - 20}
                y={0}
                width={40}
                height={height}
                fill="transparent"
                onPress={() => onPointPress(i, values[i], labels[i] ?? '', pt.x)}
              />
            ))
          : null}
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
  if (prev.selectedIndex !== next.selectedIndex) return false;
  if (prev.values.length !== next.values.length) return false;
  if (prev.labels.length !== next.labels.length) return false;
  for (let i = 0; i < prev.values.length; i++) {
    if (prev.values[i] !== next.values[i]) return false;
  }
  for (let i = 0; i < prev.labels.length; i++) {
    if (prev.labels[i] !== next.labels[i]) return false;
  }
  // onPointPress is a callback — skip identity check to avoid unnecessary re-renders
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
