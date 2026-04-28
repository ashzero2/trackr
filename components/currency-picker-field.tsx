import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { bodyFont, headlineFont, labelFont } from '@/constants/typography';
import type { SemanticColors } from '@/constants/design-tokens';
import { SUPPORTED_CURRENCIES } from '@/lib/currencies';

const RECENTS_KEY = '@currency_recents';
const MAX_RECENTS = 5;

async function loadRecentCurrencies(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveRecentCurrency(code: string): Promise<void> {
  try {
    const prev = await loadRecentCurrencies();
    const next = [code, ...prev.filter((c) => c !== code)].slice(0, MAX_RECENTS);
    await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Silently ignore storage errors
  }
}

type CurrencyPickerFieldProps = {
  value: string;
  onChange: (code: string) => void;
  colors: SemanticColors;
};

export function CurrencyPickerField({ value, onChange, colors }: CurrencyPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [recentCodes, setRecentCodes] = useState<string[]>([]);

  const refreshRecents = useCallback(async () => {
    const codes = await loadRecentCurrencies();
    setRecentCodes(codes);
  }, []);

  useEffect(() => {
    if (open) void refreshRecents();
  }, [open, refreshRecents]);

  const label = useMemo(() => {
    const row = SUPPORTED_CURRENCIES.find((c) => c.code === value);
    return row ? `${row.label} (${row.code})` : value;
  }, [value]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [...SUPPORTED_CURRENCIES];
    return SUPPORTED_CURRENCIES.filter(
      (c) => c.code.toLowerCase().includes(s) || c.label.toLowerCase().includes(s),
    );
  }, [q]);

  const recentItems = useMemo(() => {
    if (q.trim()) return []; // Hide recents during search
    return recentCodes
      .map((code) => SUPPORTED_CURRENCIES.find((c) => c.code === code))
      .filter(Boolean) as typeof SUPPORTED_CURRENCIES;
  }, [recentCodes, q]);

  const handleSelect = useCallback((code: string) => {
    void saveRecentCurrency(code);
    onChange(code);
    setOpen(false);
    setQ('');
  }, [onChange]);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Primary currency, ${label}`}
        onPress={() => setOpen(true)}
        style={[
          styles.trigger,
          { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
        ]}>
        <Text style={{ color: colors.onSurface, fontFamily: bodyFont, flex: 1 }}>{label}</Text>
        <MaterialIcons name="expand-more" size={22} color={colors.primary} importantForAccessibility="no" />
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalRoot, { backgroundColor: colors.surface }]} edges={['top']}>
          <View style={styles.modalHead}>
            <Text style={[styles.modalTitle, { color: colors.primary, fontFamily: headlineFont }]}>
              Select currency
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={() => setOpen(false)}
              style={{ minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' }}>
              <Text style={{ color: colors.primary, fontFamily: labelFont, fontWeight: '700' }}>Done</Text>
            </Pressable>
          </View>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search"
            placeholderTextColor={colors.onSurfaceVariant}
            style={[
              styles.search,
              {
                color: colors.onSurface,
                backgroundColor: colors.surfaceContainerLowest,
                fontFamily: bodyFont,
              },
            ]}
          />
          {recentItems.length > 0 ? (
            <View style={styles.recentsSection}>
              <Text style={[styles.sectionHeader, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>
                RECENTLY USED
              </Text>
              {recentItems.map((item) => {
                const sel = item.code === value;
                return (
                  <Pressable
                    key={`recent-${item.code}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sel }}
                    accessibilityLabel={`Recent: ${item.label}, ${item.code}`}
                    onPress={() => handleSelect(item.code)}
                    style={[
                      styles.row,
                      { borderBottomColor: colors.outlineVariant },
                      sel && { backgroundColor: colors.surfaceContainerLow },
                    ]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <MaterialIcons name="history" size={16} color={colors.onSurfaceVariant} />
                      <Text style={{ color: colors.onSurface, fontFamily: bodyFont, fontSize: 16 }}>
                        {item.label}
                      </Text>
                    </View>
                    <Text style={{ color: colors.onSurfaceVariant, fontFamily: labelFont }}>{item.code}</Text>
                  </Pressable>
                );
              })}
              <Text style={[styles.sectionHeader, { color: colors.onSurfaceVariant, fontFamily: labelFont, marginTop: 8 }]}>
                ALL CURRENCIES
              </Text>
            </View>
          ) : null}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const sel = item.code === value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={`${item.label}, ${item.code}`}
                  onPress={() => handleSelect(item.code)}
                  style={[
                    styles.row,
                    { borderBottomColor: colors.outlineVariant },
                    sel && { backgroundColor: colors.surfaceContainerLow },
                  ]}>
                  <Text style={{ color: colors.onSurface, fontFamily: bodyFont, fontSize: 16 }}>
                    {item.label}
                  </Text>
                  <Text style={{ color: colors.onSurfaceVariant, fontFamily: labelFont }}>{item.code}</Text>
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  modalRoot: {
    flex: 1,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentsSection: {
    paddingHorizontal: 0,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
});
