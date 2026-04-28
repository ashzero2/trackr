import { StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { labelFont } from '@/constants/typography';
import type { SemanticColors } from '@/constants/design-tokens';

type FxBadgeProps = {
  /** The foreign currency code (e.g. "EUR", "JPY"). */
  currencyCode: string;
  colors: SemanticColors;
};

/**
 * A small pill badge showing a currency-exchange icon and the foreign currency code.
 * Rendered inline next to the payment method chip on transaction rows.
 */
export function FxBadge({ currencyCode, colors }: FxBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: colors.tertiaryContainer }]}>
      <MaterialIcons name="currency-exchange" size={10} color={colors.onTertiaryContainer} />
      <Text style={[styles.text, { color: colors.onTertiaryContainer, fontFamily: labelFont }]}>
        {currencyCode}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  text: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});