import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { bodyFont, labelFont } from '@/constants/typography';
import type { SemanticColors } from '@/constants/design-tokens';

type DatePickerFieldProps = {
  value: Date;
  onChange: (date: Date) => void;
  colors: SemanticColors;
  /** Optional accent color for the Done button. Defaults to colors.primary. */
  accentColor?: string;
  /** Icon name for the chip trigger. Default "event". */
  icon?: keyof typeof MaterialIcons.glyphMap;
  /** Label override. Defaults to formatted date. */
  label?: string;
  /** Date picker mode. Default "date". */
  mode?: 'date' | 'time' | 'datetime';
};

/**
 * A unified date picker field that provides:
 * - iOS: Opens a bottom-sheet modal with a spinner + Done button
 * - Android: Opens the native dialog picker
 *
 * Both platforms use the same chip trigger for visual consistency.
 */
export function DatePickerField({
  value,
  onChange,
  colors,
  accentColor,
  icon = 'event',
  label,
  mode = 'date',
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const accent = accentColor ?? colors.primary;

  const isToday = (() => {
    const n = new Date();
    return (
      value.getDate() === n.getDate() &&
      value.getMonth() === n.getMonth() &&
      value.getFullYear() === n.getFullYear()
    );
  })();

  const displayLabel =
    label ?? (isToday ? 'Today' : value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Date: ${displayLabel}. Tap to change.`}
        onPress={() => setOpen(true)}
        style={[styles.chip, { backgroundColor: colors.surfaceContainerHigh }]}>
        <MaterialIcons name={icon} size={16} color={colors.onSurfaceVariant} />
        <Text style={[styles.chipText, { color: colors.onSurface, fontFamily: labelFont }]}>
          {displayLabel}
        </Text>
      </Pressable>

      {/* Android: native dialog, auto-closes on pick */}
      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={value}
          mode={mode}
          display="default"
          onChange={(_, d) => {
            setOpen(false);
            if (d) onChange(d);
          }}
        />
      ) : null}

      {/* iOS: bottom-sheet with spinner + Done */}
      {open && Platform.OS === 'ios' ? (
        <Modal visible transparent animationType="fade">
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <View style={[styles.sheet, { backgroundColor: colors.surfaceContainerLowest }]}>
              <DateTimePicker
                value={value}
                mode={mode}
                display="spinner"
                onChange={(_, d) => {
                  if (d) onChange(d);
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Done"
                onPress={() => setOpen(false)}
                style={[styles.doneBtn, { backgroundColor: accent }]}>
                <Text style={{ color: '#FFFFFF', fontFamily: labelFont, fontWeight: '700' }}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  doneBtn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
});