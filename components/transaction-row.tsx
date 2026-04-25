import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useAppColors } from '@/contexts/color-scheme-context';
import { bodyFont, labelFont } from '@/constants/typography';
import { useFormatMoney } from '@/hooks/use-format-money';
import { materialIconNameForCategory } from '@/lib/category-icons';
import { formatPaymentMethodLabel } from '@/lib/payment-method';
import type { TransactionWithCategory } from '@/types/finance';

type TransactionRowProps = {
  transaction: TransactionWithCategory;
  subtitle: string;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Flush rows inside a grouped card (no outer rounding per row) */
  dense?: boolean;
  /** Override the outer row container style (e.g. remove borderRadius when inside a clip wrapper) */
  rowStyle?: ViewStyle;
};

export function TransactionRow({ transaction, subtitle, onPress, onLongPress, dense, rowStyle }: TransactionRowProps) {
  const { colors } = useAppColors();
  const { format } = useFormatMoney();
  const iconName = materialIconNameForCategory(transaction.categoryIconKey);
  const sign = transaction.type === 'expense' ? '-' : '+';
  const amountColor = transaction.type === 'expense' ? colors.onSurface : colors.primary;

  const inner = (
    <>
      <View style={[styles.iconBox, { backgroundColor: colors.surfaceContainerLowest }]}>
        <MaterialIcons name={iconName} size={24} color={colors.primary} />
      </View>
      <View style={styles.mid}>
        <Text style={[styles.title, { color: colors.onSurface, fontFamily: bodyFont }]} numberOfLines={1}>
          {transaction.note?.trim() || transaction.categoryName}
        </Text>
        <Text style={[styles.sub, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: amountColor, fontFamily: labelFont }]}>
          {sign}
          {format(transaction.amountCents)}
        </Text>
        <View style={[styles.chip, { backgroundColor: colors.surfaceContainerHighest }]}>
          <Text style={[styles.chipText, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>
            {formatPaymentMethodLabel(transaction.paymentMethod)}
          </Text>
        </View>
      </View>
    </>
  );

  const rowBase = dense
    ? [styles.rowDense, { backgroundColor: 'transparent' as const }]
    : [styles.row, { backgroundColor: colors.surfaceContainerLow }, rowStyle];

  const a11yLabel = `${transaction.type === 'expense' ? 'Expense' : 'Income'}, ${transaction.note?.trim() || transaction.categoryName}, ${sign}${format(transaction.amountCents)}`;

  if (onPress || onLongPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={400}
        style={({ pressed }) => [
          ...rowBase,
          !dense && pressed && { backgroundColor: colors.surfaceContainerHighest },
          dense && pressed && { backgroundColor: colors.surfaceContainerLow },
        ]}>
        {inner}
      </Pressable>
    );
  }

  return <View style={rowBase}>{inner}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 14,
  },
  rowDense: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mid: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  sub: {
    fontSize: 12,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
