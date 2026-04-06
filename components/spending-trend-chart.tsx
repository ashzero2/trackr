import { Platform } from 'react-native';

import { SpendingTrendChartSkia } from '@/components/spending-trend-chart-skia';
import { SpendingTrendChartSvg, type SpendingTrendChartProps } from '@/components/spending-trend-chart-svg';

export type { SpendingTrendChartProps };

/**
 * Native: Skia strokes. Web: react-native-svg (Skia web is not the default target here).
 */
export function SpendingTrendChart(props: SpendingTrendChartProps) {
  if (Platform.OS === 'web') {
    return <SpendingTrendChartSvg {...props} />;
  }
  return <SpendingTrendChartSkia {...props} />;
}
