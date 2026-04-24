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
  DEFAULT_GEMINI_MODEL,
  getGeminiApiKey,
  getGeminiModelId,
  setGeminiApiKey,
  setGeminiModelId,
} from '@/lib/ai-settings';
import { geminiGenerateContent } from '@/lib/gemini-client';
import {
  importTransactionRows,
  parseTransactionImportJson,
  readDocumentPickerAssetAsText,
  serializeTransactionsJson,
} from '@/lib/transaction-json';

export default function SettingsScreen() {
  const { colors, scheme, setThemePreference } = useAppColors();
  const { displayName, currencyCode, setProfile, travelModeEnabled, activeTripId } = useUserProfile();
  const { ready, error, db, categories, transactions, trips } = useDatabase();
  const [busy, setBusy] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [geminiKeyDraft, setGeminiKeyDraft] = useState('');
  const [geminiHasKey, setGeminiHasKey] = useState(false);
  const [geminiModelDraft, setGeminiModelDraft] = useState(DEFAULT_GEMINI_MODEL);
  const [exbotSectionOpen, setExbotSectionOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const k = await getGeminiApiKey();
        setGeminiHasKey(Boolean(k?.trim()));
        setGeminiKeyDraft('');
        setGeminiModelDraft(await getGeminiModelId());
      })();
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
    if (!transactions || !trips) return;
    setBusy(true);
    try {
      const [rows, tripList] = await Promise.all([transactions.listAllWithCategory(), trips.listAll()]);
      const json = serializeTransactionsJson(tripList, rows, currencyCode);
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
    if (!db || !categories || !transactions || !trips) return;
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
                await importTransactionRows(db, categories, trips, transactions, parsed.trips, parsed.rows);
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

  if (!ready || !transactions || !db || !categories || !trips) {
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

      <Section title="Account & display">
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
          <ThemeRow />
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

      <Section title="Travel">
        <Card divided>
          <Row
            icon="flight"
            iconBg={colors.surfaceContainerLowest}
            title="Travel mode"
            subtitle={
              activeTripId
                ? 'Banner shows which trip receives quick-add defaults when the trip is ACTIVE.'
                : 'Turn on to show trip tracking banner and trip analytics sections.'
            }
            right={
              <Switch
                value={travelModeEnabled}
                onValueChange={(v) => void setProfile({ travelModeEnabled: v })}
                trackColor={{ false: colors.outlineVariant, true: colors.primaryContainer }}
                thumbColor={travelModeEnabled ? colors.primary : colors.surfaceContainerLowest}
              />
            }
          />
          <PressableRow
            icon="map"
            title="Manage trips"
            subtitle="Lifecycle, active trip, daily budgets"
            onPress={() => router.push('/manage-trips' as unknown as Href)}
          />
          <PressableRow
            icon="build"
            title="Repair trip summaries"
            subtitle="Rebuild cached totals if anything looks off"
            onPress={async () => {
              setBusy(true);
              try {
                await trips.recomputeAllTripSummaries();
                Alert.alert('Done', 'Trip summaries were recalculated.');
              } catch (e) {
                Alert.alert('Error', e instanceof Error ? e.message : 'Unknown error');
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
          />
        </Card>
      </Section>

      <Section title="Exbot">
        <Card divided>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: exbotSectionOpen }}
            accessibilityLabel="Exbot Gemini settings"
            onPress={() => setExbotSectionOpen((o) => !o)}
            style={({ pressed }) => [
              styles.exbotHeaderRow,
              { backgroundColor: pressed ? colors.surfaceContainerHigh : 'transparent' },
            ]}>
            <View style={[styles.rowIcon, { backgroundColor: colors.surfaceContainerLowest }]}>
              <MaterialIcons name="auto-awesome" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface, fontFamily: bodyFont }]}>Google Gemini</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
                {geminiHasKey ? 'API key saved on this device' : 'Not configured — tap to add a key'}
              </Text>
            </View>
            <MaterialIcons
              name={exbotSectionOpen ? 'expand-less' : 'expand-more'}
              size={28}
              color={colors.onSurfaceVariant}
            />
          </Pressable>
          {exbotSectionOpen ? (
          <View style={styles.geminiBlock}>
            <Text style={[styles.geminiHint, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
              Exbot uses your key from Google AI Studio. Chat and smart import send prompts and file snippets to
              Google’s Gemini API. The key stays on this device.
            </Text>
            <Text style={[styles.profileCurrencyLbl, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>
              API key
            </Text>
            <Text style={[styles.geminiKeyStatus, { color: colors.onSurface, fontFamily: bodyFont }]}>
              {geminiHasKey ? 'A key is saved. Paste a new one to replace it.' : 'No key saved yet.'}
            </Text>
            <TextInput
              value={geminiKeyDraft}
              onChangeText={setGeminiKeyDraft}
              placeholder="Paste Gemini API key"
              placeholderTextColor={colors.onSurfaceVariant}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.nameInput,
                { color: colors.onSurface, backgroundColor: colors.surfaceContainerLow, fontFamily: bodyFont },
              ]}
            />
            <Text style={[styles.profileCurrencyLbl, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>
              Model id
            </Text>
            <TextInput
              value={geminiModelDraft}
              onChangeText={setGeminiModelDraft}
              placeholder={DEFAULT_GEMINI_MODEL}
              placeholderTextColor={colors.onSurfaceVariant}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.nameInput,
                { color: colors.onSurface, backgroundColor: colors.surfaceContainerLow, fontFamily: bodyFont },
              ]}
            />
            <Text style={[styles.geminiModelHint, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
              Use {DEFAULT_GEMINI_MODEL} if you see quota errors with other model names.
            </Text>
            <View style={styles.geminiActions}>
              <Pressable
                onPress={async () => {
                  try {
                    if (geminiKeyDraft.trim()) {
                      await setGeminiApiKey(geminiKeyDraft.trim());
                      setGeminiHasKey(true);
                      setGeminiKeyDraft('');
                    }
                    await setGeminiModelId(geminiModelDraft.trim() || DEFAULT_GEMINI_MODEL);
                    Alert.alert('Saved', 'Gemini settings were updated.');
                  } catch (e) {
                    Alert.alert('Error', e instanceof Error ? e.message : 'Could not save.');
                  }
                }}
                style={[styles.nameSave, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.onPrimary, fontFamily: labelFont, fontWeight: '700' }}>Save</Text>
              </Pressable>
              {geminiHasKey ? (
                <>
                  <Pressable
                    onPress={async () => {
                      const key = await getGeminiApiKey();
                      const model = await getGeminiModelId();
                      if (!key?.trim()) {
                        Alert.alert('No key saved', 'Paste and save a key first.');
                        return;
                      }
                      setBusy(true);
                      try {
                        const result = await geminiGenerateContent(key, model, {
                          contents: [{ role: 'user', parts: [{ text: 'Reply with just the word: ok' }] }],
                        });
                        if (result.ok) {
                          Alert.alert('Connected ✓', `Model "${model}" responded successfully.`);
                        } else {
                          Alert.alert('Connection failed', result.error);
                        }
                      } catch (e) {
                        Alert.alert('Connection failed', e instanceof Error ? e.message : 'Unknown error');
                      } finally {
                        setBusy(false);
                      }
                    }}
                    disabled={busy}
                    style={[styles.nameGhost, { borderColor: colors.outlineVariant, opacity: busy ? 0.5 : 1 }]}>
                    <Text style={{ color: colors.primary, fontFamily: labelFont }}>Test connection</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Alert.alert('Remove API key?', 'Exbot will stay disabled until you add a key again.', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await setGeminiApiKey(null);
                              setGeminiHasKey(false);
                            } catch (e) {
                              Alert.alert('Error', e instanceof Error ? e.message : 'Could not remove.');
                            }
                          },
                        },
                      ]);
                    }}
                    style={[styles.nameGhost, { borderColor: colors.outlineVariant }]}>
                    <Text style={{ color: colors.error, fontFamily: labelFont }}>Remove key</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>
          ) : null}
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

const THEME_OPTIONS: { label: string; value: import('@/contexts/color-scheme-context').ThemePreference }[] = [
  { label: 'Light', value: 'light' },
  { label: 'System', value: 'system' },
  { label: 'Dark', value: 'dark' },
];

function ThemeRow() {
  const { colors, themePreference, setThemePreference } = useAppColors();
  return (
    <View style={styles.rowInner}>
      <View style={[styles.rowIcon, { backgroundColor: colors.surfaceContainerLowest }]}>
        <MaterialIcons name="palette" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.onSurface, fontFamily: bodyFont }]}>Color mode</Text>
        <Text style={[styles.rowSub, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
          Light, system default, or dark
        </Text>
      </View>
      <View style={[styles.themeSegment, { backgroundColor: colors.surfaceContainerHighest }]}>
        {THEME_OPTIONS.map((opt) => {
          const active = themePreference === opt.value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${opt.label} theme`}
              onPress={() => void setThemePreference(opt.value)}
              style={[styles.themeChip, active && { backgroundColor: colors.primary }]}>
              <Text
                style={{
                  fontFamily: labelFont,
                  fontSize: 11,
                  fontWeight: '700',
                  color: active ? colors.onPrimary : colors.onSurfaceVariant,
                }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
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
  exbotHeaderRow: {
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
  geminiBlock: {
    padding: 20,
    gap: 10,
  },
  geminiHint: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  geminiKeyStatus: {
    fontSize: 13,
  },
  geminiModelHint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: -4,
  },
  geminiActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  themeSegment: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  themeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    minWidth: 44,
    alignItems: 'center',
  },
});
