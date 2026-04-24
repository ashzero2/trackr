import { SpendingTrendChartSvg, type SpendingTrendChartProps } from '@/components/spending-trend-chart-svg';

export type { SpendingTrendChartProps };

/** Spending trend line via react-native-svg (all platforms). */
export function SpendingTrendChart(props: SpendingTrendChartProps) {
  return <SpendingTrendChartSvg {...props} />;
}
