import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppColors } from '@/contexts/color-scheme-context';
import { useRepositories } from '@/contexts/database-context';
import type { CategoryWithUsage } from '@/data/category-repository';
import type { SemanticColors } from '@/constants/design-tokens';
import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { bodyFont, headlineFont, labelFont } from '@/constants/typography';
import { CATEGORY_ICON_KEYS, materialIconNameForCategory } from '@/lib/category-icons';
import { lightImpact } from '@/lib/haptics';
import * as Haptics from 'expo-haptics';
import type { EntryType } from '@/types/finance';

type ModalState =
  | null
  | { mode: 'add' }
  | { mode: 'edit'; category: CategoryWithUsage };

export default function ManageCategoriesScreen() {
  const { colors } = useAppColors();
  const { categories } = useRepositories();
  const [items, setItems] = useState<CategoryWithUsage[]>([]);
  const [modal, setModal] = useState<ModalState>(null);

  const load = useCallback(() => {
    categories.listWithUsage().then(setItems);
  }, [categories]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const sections = useMemo(() => {
    const expense = items.filter((c) => c.type === 'expense');
    const income = items.filter((c) => c.type === 'income');
    return [
      { title: 'Expenses', data: expense },
      { title: 'Income', data: income },
    ];
  }, [items]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={['bottom']}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add category"
        onPress={() => setModal({ mode: 'add' })}
        style={[styles.addBtn, { backgroundColor: colors.primary }]}>
        <MaterialIcons name="add" size={22} color={colors.onPrimary} importantForAccessibility="no" />
        <Text style={{ color: colors.onPrimary, fontFamily: labelFont, fontWeight: '700' }}>
          Add category
        </Text>
      </Pressable>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={[styles.sectionHdr, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>
            {title.toUpperCase()}
          </Text>
        )}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${item.type}, ${item.transactionCount} transactions`}
            onPress={() => setModal({ mode: 'edit', category: item })}
            style={[styles.row, { backgroundColor: colors.surfaceContainerLow }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.surfaceContainerLowest }]}>
              <MaterialIcons name={materialIconNameForCategory(item.iconKey)} size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface, fontFamily: bodyFont }]}>{item.name}</Text>
              <Text style={[styles.rowMeta, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
                {item.transactionCount} transaction{item.transactionCount === 1 ? '' : 's'}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.onSurfaceVariant} />
          </Pressable>
        )}
      />

      <CategoryEditorModal
        key={modal?.mode === 'edit' ? modal.category.id : 'add'}
        visible={modal !== null}
        state={modal}
        onClose={() => {
          setModal(null);
          load();
        }}
        colors={colors}
      />
    </SafeAreaView>
  );
}

function CategoryEditorModal({
  visible,
  state,
  onClose,
  colors,
}: {
  visible: boolean;
  state: ModalState;
  onClose: () => void;
  colors: SemanticColors;
}) {
  const { categories } = useRepositories();
  const editing = state && state.mode === 'edit' ? state.category : null;
  const isAdd = state?.mode === 'add';

  const [name, setName] = useState('');
  const [type, setType] = useState<EntryType>('expense');
  const [iconKey, setIconKey] = useState<string>('category');

  useEffect(() => {
    if (!visible || !state) return;
    if (state.mode === 'edit') {
      setName(state.category.name);
      setType(state.category.type);
      setIconKey(state.category.iconKey);
    } else {
      setName('');
      setType('expense');
      setIconKey('category');
    }
  }, [visible, state]);

  const canChangeType = isAdd || (editing && editing.transactionCount === 0);
  const canDelete = editing && editing.transactionCount === 0;

  const onSave = async () => {
    const n = name.trim();
    if (!n) {
      Alert.alert('Name required', 'Please enter a category name.');
      return;
    }
    try {
      if (isAdd) {
        await categories.insert({ name: n, type, iconKey });
      } else if (editing) {
        await categories.update(editing.id, { name: n, type: canChangeType ? type : undefined, iconKey });
      }
      lightImpact();
      onClose();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save');
    }
  };

  const onDelete = () => {
    if (!editing) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      `Delete "${editing.name}"?`,
      `This category will be permanently removed. This action cannot be undone.\n\n${
        editing.transactionCount > 0
          ? `⚠️ This category has ${editing.transactionCount} transaction${editing.transactionCount === 1 ? '' : 's'} — you must reassign or delete them first.`
          : 'No transactions use this category, so it is safe to delete.'
      }`,
      editing.transactionCount > 0
        ? [{ text: 'OK', style: 'cancel' }]
        : [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete permanently',
              style: 'destructive',
              onPress: async () => {
                const r = await categories.deleteIfUnused(editing.id);
                if (!r.ok) {
                  Alert.alert('Cannot delete', 'This category still has transactions. Reassign or delete them first.');
                  return;
                }
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onClose();
              },
            },
          ],
    );
  };

  if (!state) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[styles.sheet, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Text style={[styles.sheetTitle, { color: colors.primary, fontFamily: headlineFont }]}>
            {isAdd ? 'New category' : 'Edit category'}
          </Text>

          <Text style={[styles.lbl, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Coffee"
            placeholderTextColor={colors.onSurfaceVariant}
            style={[
              styles.input,
              { color: colors.onSurface, backgroundColor: colors.surfaceContainerLow, fontFamily: bodyFont },
            ]}
          />

          <Text style={[styles.lbl, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>Type</Text>
          <View style={[styles.segment, { backgroundColor: colors.surfaceContainerHighest }]}>
            {(['expense', 'income'] as const).map((t) => (
              <Pressable
                key={t}
                accessibilityRole="button"
                accessibilityState={{ selected: type === t, disabled: !canChangeType }}
                accessibilityLabel={t === 'expense' ? 'Expense' : 'Income'}
                disabled={!canChangeType}
                onPress={() => setType(t)}
                style={[
                  styles.seg,
                  type === t && { backgroundColor: colors.primary },
                  !canChangeType && { opacity: 0.45 },
                ]}>
                <Text
                  style={{
                    fontFamily: labelFont,
                    fontWeight: '600',
                    color: type === t ? colors.onPrimary : colors.onSurface,
                  }}>
                  {t === 'expense' ? 'Expense' : 'Income'}
                </Text>
              </Pressable>
            ))}
          </View>
          {!canChangeType && editing ? (
            <Text style={[styles.hint, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
              Type is locked while this category has transactions.
            </Text>
          ) : null}

          <Text style={[styles.lbl, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>Icon</Text>
          <FlatList
            horizontal
            data={[...CATEGORY_ICON_KEYS]}
            keyExtractor={(k) => k}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.iconScroll}
            renderItem={({ item: key }) => {
              const sel = iconKey === key;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={`Icon ${key.replace(/-/g, ' ')}`}
                  onPress={() => setIconKey(key)}
                  style={[
                    styles.iconPick,
                    {
                      borderColor: sel ? colors.primary : colors.outlineVariant,
                      backgroundColor: sel ? colors.secondaryContainer : colors.surfaceContainerLow,
                    },
                  ]}>
                  <MaterialIcons
                    name={materialIconNameForCategory(key)}
                    size={26}
                    color={colors.primary}
                    importantForAccessibility="no"
                  />
                </Pressable>
              );
            }}
          />

          <View style={styles.actions}>
            {canDelete ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete category"
                onPress={onDelete}
                style={styles.delBtn}>
                <Text style={{ color: colors.error, fontFamily: labelFont, fontWeight: '700' }}>Delete</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={onClose}
                style={[styles.ghostBtn, { borderColor: colors.outlineVariant }]}>
                <Text style={{ color: colors.onSurface, fontFamily: labelFont }}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save category"
                onPress={onSave}
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.onPrimary, fontFamily: labelFont, fontWeight: '700' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 14,
    borderRadius: 999,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 8,
  },
  sectionHdr: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    marginBottom: 8,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  rowMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
  },
  lbl: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  seg: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  hint: {
    fontSize: 12,
    marginTop: 8,
  },
  iconScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  iconPick: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 22,
  },
  delBtn: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingVertical: 10,
    paddingRight: 12,
  },
  ghostBtn: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  saveBtn: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
});
