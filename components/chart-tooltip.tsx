import { StyleSheet, Text, View } from 'react-native';

import { useAppColors } from '@/contexts/color-scheme-context';
import { bodyFont, headlineFont, labelFont } from '@/constants/typography';

type ChartTooltipProps = {
  label: string;
  formattedValue: string;
};

/** Floating tooltip shown above the chart when a data point is tapped. */
export function ChartTooltip({ label, formattedValue }: ChartTooltipProps) {
  const { colors } = useAppColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.inverseSurface }]}>
      <Text style={[styles.label, { color: colors.inverseOnSurface, fontFamily: labelFont }]}>
        {label}
      </Text>
      <Text style={[styles.value, { color: colors.inverseOnSurface, fontFamily: headlineFont }]}>
        {formattedValue}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
  },
});