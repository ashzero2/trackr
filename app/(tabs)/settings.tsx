import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as DocumentPicker from 'expo-document-picker';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CurrencyPickerField } from '@/components/currency-picker-field';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { useAppColors } from '@/contexts/color-scheme-context';
import { useDatabase } from '@/contexts/database-context';
import { useUserProfile } from '@/contexts/user-profile-context';
import { bodyFont, headlineFont, labelFont } from '@/constants/typography';
import { transactionsToCsv } from '@/lib/export-csv';
import {
  importTransactionRows,
  parseTransactionImportJson,
  readDocumentPickerAssetAsText,
  serializeTransactionsJson,
} from '@/lib/transaction-json';

export default function SettingsScreen() {
  const { colors, scheme, setThemePreference } = useAppColors();
  const { displayName, currencyCode, setProfile } = useUserProfile();
  const { ready, error, db, categories, transactions } = useDatabase();
  const [busy, setBusy] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [draftName, setDraftName] = useState('');

  useFocusEffect(
    useCallback(() => {
      // no-op: tab focus
    }, []),
  );

  const onExportCsv = async () => {
    if (!transactions) return;
    setBusy(true);
    try {
      const rows = await transactions.listAllWithCategory();
      const csv = transactionsToCsv(rows);
      await Share.share({
        message: csv,
        title: 'Trackr export',
      });
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const onExportJson = async () => {
    if (!transactions) return;
    setBusy(true);
    try {
      const rows = await transactions.listAllWithCategory();
      const json = serializeTransactionsJson(rows, currencyCode);
      await Share.share({
        message: json,
        title: 'Trackr backup',
      });
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const onImportJson = async () => {
    if (!db || !categories || !transactions) return;
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain'],
        copyToCacheDirectory: true,
      });
      if (pick.canceled || !pick.assets?.[0]) return;
      const asset = pick.assets[0];
      const text = await readDocumentPickerAssetAsText(asset);
      const parsed = parseTransactionImportJson(text);
      if (!parsed.ok) {
        Alert.alert('Invalid file', parsed.error);
        return;
      }
      if (parsed.rows.length === 0) {
        Alert.alert('Nothing to import', 'The file contains no transactions.');
        return;
      }
      const n = parsed.rows.length;
      Alert.alert(
        'Import transactions?',
        `Add ${n} transaction(s). Missing categories will be created. This does not remove existing data.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            onPress: async () => {
              setBusy(true);
              try {
                await importTransactionRows(db, categories, transactions, parsed.rows);
                Alert.alert('Done', `Imported ${n} transaction(s).`);
              } catch (e) {
                Alert.alert('Import failed', e instanceof Error ? e.message : 'Unknown error');
              } finally {
                setBusy(false);
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const onClear = () => {
    if (!transactions) return;
    Alert.alert(
      'Clear all transactions?',
      'This removes every transaction. Categories and budgets stay in place.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await transactions.deleteAll();
              Alert.alert('Done', 'All transactions were deleted.');
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Unknown error');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  if (error) {
    return (
      <ScreenScaffold subtitle="Configure your financial workspace">
        <Text style={{ fontFamily: bodyFont, color: colors.error }}>{error.message}</Text>
      </ScreenScaffold>
    );
  }

  if (!ready || !transactions || !db || !categories) {
    return (
      <ScreenScaffold subtitle="Configure your financial workspace">
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold subtitle="Configure your financial workspace">
      <Text style={[styles.pageTitle, { color: colors.primary, fontFamily: headlineFont }]}>Settings</Text>

      <Section title="Profile">
        <Card divided>
          <PressableRow
            icon="person"
            title="Display name"
            subtitle={displayName.trim() ? displayName : 'Tap to set'}
            onPress={() => {
              setDraftName(displayName);
              setNameModalOpen(true);
            }}
          />
          <View style={styles.profileCurrency}>
            <Text style={[styles.profileCurrencyLbl, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>
              Primary currency
            </Text>
            <Text style={[styles.profileCurrencyHint, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
              Amounts are not converted when you change this—only how they are labeled.
            </Text>
            <CurrencyPickerField
              value={currencyCode}
              onChange={(code) => {
                if (code === currencyCode) return;
                Alert.alert(
                  'Change currency?',
                  'Existing numbers stay the same; only the symbol and grouping change. Use this if your data is already in the new currency.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Change', onPress: () => void setProfile({ currencyCode: code }) },
                  ],
                );
              }}
              colors={colors}
            />
          </View>
        </Card>
      </Section>

      <Modal visible={nameModalOpen} transparent animationType="fade">
        <Pressable style={styles.nameBackdrop} onPress={() => setNameModalOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.nameSheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.nameSheetTitle, { color: colors.primary, fontFamily: headlineFont }]}>
              Display name
            </Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Your name"
              placeholderTextColor={colors.onSurfaceVariant}
              autoCapitalize="words"
              style={[
                styles.nameInput,
                { color: colors.onSurface, backgroundColor: colors.surfaceContainerLow, fontFamily: bodyFont },
              ]}
            />
            <View style={styles.nameActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={() => setNameModalOpen(false)}
                style={[styles.nameGhost, { borderColor: colors.outlineVariant }]}>
                <Text style={{ color: colors.onSurface, fontFamily: labelFont }}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save name"
                onPress={async () => {
                  const n = draftName.trim();
                  if (!n) {
                    Alert.alert('Name required', 'Please enter a display name.');
                    return;
                  }
                  await setProfile({ displayName: n });
                  setNameModalOpen(false);
                }}
                style={[styles.nameSave, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.onPrimary, fontFamily: labelFont, fontWeight: '700' }}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Section title="Appearance">
        <Card>
          <Row
            icon="palette"
            iconBg={colors.surfaceContainerLowest}
            title="Color mode"
            subtitle="Switch between light and dark themes"
            right={
              <Switch
                value={scheme === 'dark'}
                onValueChange={(v) => setThemePreference(v ? 'dark' : 'light')}
                trackColor={{ false: colors.outlineVariant, true: colors.primaryContainer }}
                thumbColor={scheme === 'dark' ? colors.primary : colors.surfaceContainerLowest}
              />
            }
          />
        </Card>
      </Section>

      <Section title="Customization">
        <Card divided>
          <PressableRow
            icon="category"
            title="Custom categories"
            subtitle="Manage expense and income tags"
            onPress={() => router.push('/manage-categories' as unknown as Href)}
          />
          <PressableRow
            icon="account-balance-wallet"
            title="Custom budgets"
            subtitle="Set limits for specific spending areas"
            onPress={() => router.push('/manage-budgets' as unknown as Href)}
          />
        </Card>
      </Section>

      <Section title="Data management">
        <Card divided>
          <PressableRow
            icon="import-export"
            title="Export as CSV"
            subtitle="Share transactions as a spreadsheet"
            onPress={onExportCsv}
            disabled={busy}
          />
          <PressableRow
            icon="backup"
            title="Export as JSON"
            subtitle="Backup you can re-import in this app"
            onPress={onExportJson}
            disabled={busy}
          />
          <PressableRow
            icon="upload-file"
            title="Import from JSON"
            subtitle="Append transactions from a backup"
            onPress={onImportJson}
            disabled={busy}
          />
          <PressableRow
            icon="delete-forever"
            title="Clear data"
            subtitle="Wipe all transactions"
            destructive
            onPress={onClear}
            disabled={busy}
          />
        </Card>
      </Section>
    </ScreenScaffold>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useAppColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>{title}</Text>
      {children}
    </View>
  );
}

function Card({ children, divided }: { children: React.ReactNode; divided?: boolean }) {
  const { colors } = useAppColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surfaceContainerLow },
        divided && { overflow: 'hidden' },
      ]}>
      {children}
    </View>
  );
}

function Row({
  icon,
  iconBg,
  title,
  subtitle,
  right,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconBg: string;
  title: string;
  subtitle: string;
  right: React.ReactNode;
}) {
  const { colors } = useAppColors();
  return (
    <View style={styles.rowInner}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <MaterialIcons name={icon} size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.onSurface, fontFamily: bodyFont }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>{subtitle}</Text>
      </View>
      {right}
    </View>
  );
}

function PressableRow({
  icon,
  title,
  subtitle,
  onPress,
  destructive,
  disabled,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useAppColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pressRow,
        { backgroundColor: pressed ? colors.surfaceContainerHigh : 'transparent' },
        disabled && { opacity: 0.5 },
      ]}>
      <View style={[styles.rowIcon, { backgroundColor: destructive ? colors.errorContainer : colors.surfaceContainerLowest }]}>
        <MaterialIcons name={icon} size={22} color={destructive ? colors.error : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.rowTitle,
            { color: destructive ? colors.error : colors.onSurface, fontFamily: bodyFont },
          ]}>
          {title}
        </Text>
        <Text style={[styles.rowSub, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>{subtitle}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={destructive ? colors.error : colors.onSurfaceVariant} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loader: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 20,
  },
  section: {
    marginBottom: 22,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
  },
  card: {
    borderRadius: 24,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 20,
  },
  pressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 20,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowSub: {
    fontSize: 12,
    marginTop: 2,
  },
  profileCurrency: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 8,
  },
  profileCurrencyLbl: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  profileCurrencyHint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  nameBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  nameSheet: {
    borderRadius: 24,
    padding: 22,
    gap: 14,
  },
  nameSheetTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  nameInput: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
  },
  nameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  nameGhost: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  nameSave: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
});
