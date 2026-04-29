import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { displayFont, labelFont } from '@/constants/typography';
import { lightImpact } from '@/lib/haptics';
import type { SemanticColors } from '@/constants/design-tokens';

type SideAction = {
  /** Unique key for the action */
  key: string;
  /** Icon name from MaterialIcons */
  icon: keyof typeof MaterialIcons.glyphMap;
  /** Short label below the icon */
  label: string;
  /** Whether the action is currently active/selected */
  active?: boolean;
  /** Callback when pressed */
  onPress: () => void;
};

type NumberPadProps = {
  onDigit: (digit: string) => void;
  onDecimal: () => void;
  onBackspace: () => void;
  /** Optional callback for calculator operators (+, −). If provided, operator keys are shown in the side column. */
  onOperator?: (op: '+' | '−') => void;
  /** Currently active operator (highlighted) */
  activeOperator?: '+' | '−' | null;
  /** Optional side actions rendered as a 4th column next to the digit grid.
   *  Each action occupies one row. Max 3 actions (rows 1-3); row 4 is always [. 0 ⌫]. */
  sideActions?: [SideAction?, SideAction?, SideAction?];
  /** Accent color for active states */
  accentColor?: string;
  colors: SemanticColors;
  style?: import('react-native').ViewStyle;
};

const DIGIT_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '00'],
];

export function NumberPad({
  onDigit,
  onDecimal,
  onBackspace,
  onOperator,
  activeOperator,
  sideActions,
  accentColor,
  colors,
  style,
}: NumberPadProps) {
  const handlePress = (key: string) => {
    lightImpact();
    if (key === '.') {
      onDecimal();
    } else if (key === '00') {
      onDigit('0');
      onDigit('0');
    } else {
      onDigit(key);
    }
  };

  const hasSideColumn = Boolean(sideActions?.some(Boolean) || onOperator);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.grid}>
        {/* ── Digit columns (3 wide) ── */}
        <View style={styles.digitGrid}>
          {DIGIT_ROWS.map((row, ri) => (
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
                  {key === '00' ? (
                    <Text
                      style={[
                        styles.keyText,
                        { color: colors.onSurface, fontFamily: displayFont, fontSize: 18 },
                      ]}>
                      00
                    </Text>
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

        {/* ── Side action column (4th column) ── */}
        {hasSideColumn ? (
          <View style={styles.sideColumn}>
            {/* Row 1: side action (e.g. Card/Cash) */}
            {sideActions?.[0] ? (
              <SideActionButton action={sideActions[0]} colors={colors} accentColor={accentColor} />
            ) : (
              <View style={styles.sideKeyEmpty} />
            )}

            {/* Row 2: side action (e.g. Date) */}
            {sideActions?.[1] ? (
              <SideActionButton action={sideActions[1]} colors={colors} accentColor={accentColor} />
            ) : (
              <View style={styles.sideKeyEmpty} />
            )}

            {/* Row 3: calculator operators (+/−) or side action */}
            {onOperator ? (
              <View style={styles.operatorRow}>
                {(['+', '−'] as const).map((op) => {
                  const active = activeOperator === op;
                  return (
                    <Pressable
                      key={op}
                      accessibilityRole="button"
                      accessibilityLabel={op === '+' ? 'Add' : 'Subtract'}
                      accessibilityState={{ selected: active }}
                      onPress={() => { lightImpact(); onOperator(op); }}
                      style={[
                        styles.operatorKey,
                        {
                          backgroundColor: active
                            ? (accentColor ?? colors.primaryContainer)
                            : colors.surfaceContainerLow,
                        },
                      ]}>
                      <Text style={[
                        styles.operatorText,
                        { color: active ? '#FFFFFF' : colors.onSurfaceVariant },
                      ]}>
                        {op}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : sideActions?.[2] ? (
              <SideActionButton action={sideActions[2]} colors={colors} accentColor={accentColor} />
            ) : (
              <View style={styles.sideKeyEmpty} />
            )}

            {/* Row 4: Backspace button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete"
              onPress={() => { lightImpact(); onBackspace(); }}
              style={({ pressed }) => [
                styles.sideKey,
                {
                  backgroundColor: pressed
                    ? colors.surfaceContainerHigh
                    : colors.surfaceContainerLow,
                },
              ]}>
              <MaterialIcons name="backspace" size={20} color={colors.onSurface} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SideActionButton({
  action,
  colors,
  accentColor,
}: {
  action: SideAction;
  colors: SemanticColors;
  accentColor?: string;
}) {
  const bg = action.active
    ? (accentColor ?? colors.primaryContainer)
    : colors.surfaceContainerLow;
  const fg = action.active ? '#FFFFFF' : colors.onSurfaceVariant;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ selected: action.active }}
      onPress={() => { lightImpact(); action.onPress(); }}
      style={({ pressed }) => [
        styles.sideKey,
        {
          backgroundColor: pressed ? colors.surfaceContainerHigh : bg,
        },
      ]}>
      <MaterialIcons name={action.icon} size={20} color={fg} />
      <Text style={[styles.sideLabel, { color: fg, fontFamily: labelFont }]} numberOfLines={1}>
        {action.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  grid: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  digitGrid: {
    flex: 3,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    flex: 1,
    gap: 6,
  },
  key: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  keyText: {
    fontSize: 22,
    fontWeight: '700',
  },
  sideColumn: {
    flex: 1.1,
    gap: 6,
  },
  sideKey: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 44,
  },
  sideKeyEmpty: {
    flex: 1,
    minHeight: 44,
  },
  sideLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  operatorRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 44,
  },
  operatorKey: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorText: {
    fontSize: 20,
    fontWeight: '800',
  },
});
