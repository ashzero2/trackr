import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import React, { useRef } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { useAppColors } from '@/contexts/color-scheme-context';
import { bodyFont } from '@/constants/typography';
import { TransactionRow } from '@/components/transaction-row';
import { warningHaptic } from '@/lib/haptics';
import type { TransactionWithCategory } from '@/types/finance';

type Props = {
  transaction: TransactionWithCategory;
  subtitle: string;
  dense?: boolean;
  onDelete: (id: string) => void;
  /** Shared ref that tracks the currently open swipeable row.
   *  When a row opens, it closes the previously open row automatically. */
  openRowRef?: React.MutableRefObject<SwipeableMethods | null>;
};

export function SwipeableTransactionRow({ transaction, subtitle, dense, onDelete, openRowRef }: Props) {
  const { colors } = useAppColors();
  const swipeRef = useRef<SwipeableMethods>(null);

  function close() {
    swipeRef.current?.close();
  }

  function triggerDelete() {
    close();
    warningHaptic();
    onDelete(transaction.id);
  }

  function handleEdit() {
    close();
    // Small delay to let the swipeable close animation finish before navigating
    setTimeout(() => {
      router.push({ pathname: '/add-transaction', params: { id: transaction.id } });
    }, 50);
  }

  function handleDuplicate() {
    close();
    setTimeout(() => {
      router.push({ pathname: '/add-transaction', params: { duplicate: transaction.id } });
    }, 50);
  }

  function handleLongPress() {
    warningHaptic();
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Edit', 'Duplicate', 'Delete'],
          destructiveButtonIndex: 3,
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) handleEdit();
          if (idx === 2) handleDuplicate();
          if (idx === 3) triggerDelete();
        },
      );
    } else {
      Alert.alert(transaction.note?.trim() || transaction.categoryName, undefined, [
        { text: 'Edit', onPress: handleEdit },
        { text: 'Duplicate', onPress: handleDuplicate },
        { text: 'Delete', style: 'destructive', onPress: triggerDelete },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  function renderRightActions() {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete transaction"
        onPress={triggerDelete}
        style={[styles.actionBtn, { backgroundColor: colors.error }]}>
        <MaterialIcons name="delete-outline" size={22} color="#fff" />
        <Text style={[styles.actionLabel, { fontFamily: bodyFont }]}>Delete</Text>
      </Pressable>
    );
  }

  function renderLeftActions() {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit transaction"
        onPress={handleEdit}
        style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
        <MaterialIcons name="edit" size={22} color="#fff" />
        <Text style={[styles.actionLabel, { fontFamily: bodyFont }]}>Edit</Text>
      </Pressable>
    );
  }

  const handleSwipeOpen = () => {
    // Close any previously open row before opening this one
    if (openRowRef?.current && openRowRef.current !== swipeRef.current) {
      openRowRef.current.close();
    }
    if (openRowRef) {
      openRowRef.current = swipeRef.current;
    }
  };

  const swipeable = (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      overshootRight={false}
      overshootLeft={false}
      onSwipeableWillOpen={handleSwipeOpen}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}>
      <TransactionRow
        transaction={transaction}
        subtitle={subtitle}
        dense={dense}
        onPress={handleEdit}
        onLongPress={handleLongPress}
        accessibilityHint="Swipe left to delete, swipe right to edit. Long press for more options."
        rowStyle={dense ? undefined : { borderRadius: 0 }}
      />
    </ReanimatedSwipeable>
  );

  // Non-dense rows have their own borderRadius on TransactionRow; clip the
  // swipeable so the action buttons respect the same rounded shape.
  if (!dense) {
    return (
      <View style={styles.clip}>
        {swipeable}
      </View>
    );
  }

  return swipeable;
}

const styles = StyleSheet.create({
  clip: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  actionBtn: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
