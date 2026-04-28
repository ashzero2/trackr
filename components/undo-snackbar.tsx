import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { bodyFont, labelFont } from '@/constants/typography';
import { useAppColors } from '@/contexts/color-scheme-context';

const UNDO_DURATION_MS = 5_000;

type UndoSnackbarProps = {
  /** Message shown in the snackbar, e.g. "Transaction deleted" */
  message: string;
  /** Called when the undo window expires without user action */
  onExpire: () => void;
  /** Called when the user taps "Undo" */
  onUndo: () => void;
  /** Unique key to reset the timer when a new deletion occurs */
  id: string;
};

export function UndoSnackbar({ message, onExpire, onUndo, id }: UndoSnackbarProps) {
  const { colors } = useAppColors();
  const translateY = useRef(new Animated.Value(100)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Slide in
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();

    // Start expiry countdown
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Slide out then expire
      Animated.timing(translateY, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }).start(() => onExpire());
    }, UNDO_DURATION_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [id]); // reset on new deletion

  const handleUndo = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(translateY, {
      toValue: 100,
      duration: 150,
      useNativeDriver: true,
    }).start(() => onUndo());
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.inverseSurface, transform: [{ translateY }] },
      ]}>
      <View style={styles.content}>
        <MaterialIcons name="delete-outline" size={18} color={colors.inverseOnSurface} />
        <Text
          style={[styles.message, { color: colors.inverseOnSurface, fontFamily: bodyFont }]}
          numberOfLines={1}>
          {message}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Undo delete"
          onPress={handleUndo}
          style={({ pressed }) => [styles.undoBtn, pressed && { opacity: 0.7 }]}>
          <Text style={[styles.undoText, { color: colors.inversePrimary, fontFamily: labelFont }]}>
            Undo
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100, // above tab bar
    left: 16,
    right: 16,
    borderRadius: 14,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    zIndex: 50,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  message: {
    flex: 1,
    fontSize: 14,
  },
  undoBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  undoText: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});