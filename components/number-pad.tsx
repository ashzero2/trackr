import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { displayFont } from '@/constants/typography';
import { lightImpact } from '@/lib/haptics';
import type { SemanticColors } from '@/constants/design-tokens';

type NumberPadProps = {
  onDigit: (digit: string) => void;
  onDecimal: () => void;
  onBackspace: () => void;
  colors: SemanticColors;
  style?: import('react-native').ViewStyle;
};

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
];

export function NumberPad({ onDigit, onDecimal, onBackspace, colors, style }: NumberPadProps) {
  const handlePress = (key: string) => {
    lightImpact();
    if (key === '⌫') {
      onBackspace();
    } else if (key === '.') {
      onDecimal();
    } else {
      onDigit(key);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {ROWS.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={key === '⌫' ? 'Delete' : key === '.' ? 'Decimal point' : key}
              onPress={() => handlePress(key)}
              style={({ pressed }) => [
                styles.key,
                {
                  backgroundColor: pressed
                    ? colors.surfaceContainerHigh
                    : colors.surfaceContainerLow,
                },
              ]}>
              {key === '⌫' ? (
                <MaterialIcons name="backspace" size={24} color={colors.onSurface} />
              ) : (
                <Text
                  style={[
                    styles.keyText,
                    { color: colors.onSurface, fontFamily: displayFont },
                  ]}>
                  {key}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 5,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    flex: 1,
    gap: 5,
  },
  key: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 22,
    fontWeight: '700',
  },
});