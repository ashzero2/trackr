import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { useAppColors } from '@/contexts/color-scheme-context';
import { bodyFont } from '@/constants/typography';
import { TransactionRow } from '@/components/transaction-row';
import type { TransactionWithCategory } from '@/types/finance';

type Props = {
  transaction: TransactionWithCategory;
  subtitle: string;
  dense?: boolean;
  onDelete: (id: string) => void;
};

export function SwipeableTransactionRow({ transaction, subtitle, dense, onDelete }: Props) {
  const { colors } = useAppColors();
  const swipeRef = useRef<SwipeableMethods>(null);

  function close() {
    swipeRef.current?.close();
  }

  function confirmDelete() {
    close();
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onDelete(transaction.id);
        },
      },
    ]);
  }

  function handleEdit() {
    close();
    router.push({ pathname: '/add-transaction', params: { id: transaction.id } });
  }

  function handleDuplicate() {
    close();
    router.push({ pathname: '/add-transaction', params: { duplicate: transaction.id } });
  }

  function handleLongPress() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
          if (idx === 3) confirmDelete();
        },
      );
    } else {
      Alert.alert(transaction.note?.trim() || transaction.categoryName, undefined, [
        { text: 'Edit', onPress: handleEdit },
        { text: 'Duplicate', onPress: handleDuplicate },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  function renderRightActions() {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete transaction"
        onPress={confirmDelete}
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

  const swipeable = (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      overshootRight={false}
      overshootLeft={false}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}>
      <TransactionRow
        transaction={transaction}
        subtitle={subtitle}
        dense={dense}
        onPress={handleEdit}
        onLongPress={handleLongPress}
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
