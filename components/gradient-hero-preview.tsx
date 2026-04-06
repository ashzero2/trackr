import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { useAppColors } from '@/contexts/color-scheme-context';
import { bodyFont, displayFont, labelFont } from '@/constants/typography';
import { useFormatMoney } from '@/hooks/use-format-money';

type DashboardHeroCardProps = {
  monthlyExpenseCents: number;
  monthlyIncomeCents: number;
  loading?: boolean;
  /** vs previous month expense; null hides trend chip */
  vsLastMonthPercent: number | null;
};

export function DashboardHeroCard({
  monthlyExpenseCents,
  monthlyIncomeCents,
  loading,
  vsLastMonthPercent,
}: DashboardHeroCardProps) {
  const { colors } = useAppColors();
  const { format } = useFormatMoney();
  const savingsCents = Math.max(0, monthlyIncomeCents - monthlyExpenseCents);

  const spendLabel = loading ? '…' : format(monthlyExpenseCents);
  const incomeLabel = loading ? '…' : format(monthlyIncomeCents);
  const savingsLabel = loading ? '…' : format(savingsCents);

  const trendUp = vsLastMonthPercent !== null && vsLastMonthPercent >= 0;
  const trendLabel =
    vsLastMonthPercent === null
      ? null
      : `${Math.abs(vsLastMonthPercent)}% vs last month`;

  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryContainer]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}>
      <Text style={[styles.kicker, { color: colors.primaryFixedDim, fontFamily: labelFont }]}>
        MONTHLY SPEND
      </Text>
      <View style={styles.amountRow}>
        <Text style={[styles.amount, { color: colors.onPrimary, fontFamily: displayFont }]}>
          {spendLabel}
        </Text>
        {trendLabel ? (
          <View style={styles.trendChip}>
            <MaterialIcons
              name={trendUp ? 'trending-up' : 'trending-down'}
              size={14}
              color={colors.primaryFixed}
            />
            <Text style={[styles.trendText, { color: colors.primaryFixed, fontFamily: labelFont }]}>
              {trendLabel}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.hint, { color: colors.primaryFixed, fontFamily: bodyFont }]}>
        This calendar month (UTC)
      </Text>
      <View style={styles.grid}>
        <View style={styles.mini}>
          <Text style={[styles.miniLabel, { color: colors.onPrimary }, styles.miniLabelOpacity]}>
            Income
          </Text>
          <Text style={[styles.miniValue, { color: colors.onPrimary, fontFamily: displayFont }]}>
            {incomeLabel}
          </Text>
        </View>
        <View style={styles.mini}>
          <Text style={[styles.miniLabel, { color: colors.onPrimary }, styles.miniLabelOpacity]}>
            Savings
          </Text>
          <Text style={[styles.miniValue, { color: colors.onPrimary, fontFamily: displayFont }]}>
            {savingsLabel}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 32,
    padding: 28,
    gap: 8,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 10,
  },
  amount: {
    fontSize: 40,
    letterSpacing: -1,
  },
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    marginTop: 4,
    opacity: 0.95,
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  mini: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  miniLabel: {
    fontSize: 11,
  },
  miniLabelOpacity: {
    opacity: 0.65,
  },
  miniValue: {
    fontSize: 18,
    fontWeight: '700',
  },
});
