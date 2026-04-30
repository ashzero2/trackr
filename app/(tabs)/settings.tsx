import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { THEME_METADATA, THEME_NAMES, getSemanticColors } from '@/constants/design-tokens';

import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { SUPPORTED_CURRENCIES } from '@/lib/currencies';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { useAppLock } from '@/contexts/app-lock-context';
import { useAppColors } from '@/contexts/color-scheme-context';
import { useDatabase } from '@/contexts/database-context';
import { useUserProfile, type DashboardPrefs, type DashboardPrefValue } from '@/contexts/user-profile-context';
import { bodyFont, headlineFont, labelFont } from '@/constants/typography';
import { transactionsToCsv } from '@/lib/export-csv';
import { getGeminiApiKey } from '@/lib/ai-settings';
import { warningHaptic } from '@/lib/haptics';
import { SettingsSection } from '@/components/settings-section';
import {
  importTransactionRows,
  parseTransactionImportJson,
  readDocumentPickerAssetAsText,
  serializeTransactionsJson,
} from '@/lib/transaction-json';

export default function SettingsScreen() {
  const { colors } = useAppColors();
  const { displayName, currencyCode, setProfile, travelModeEnabled, activeTripId, dashboardPrefs } = useUserProfile();
  const { ready, error, db, categories, transactions, trips } = useDatabase();
  const {
    isEnabled: lockEnabled,
    biometricsEnabled,
    hasBiometrics,
    biometricsEnrolled,
    setBiometricsEnabled,
    lock,
  } = useAppLock();
  const [busy, setBusy] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [geminiHasKey, setGeminiHasKey] = useState(false);
  const [settingsQuery, setSettingsQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const k = await getGeminiApiKey();
        setGeminiHasKey(Boolean(k?.trim()));
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

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const onClear = () => {
    if (!transactions) return;
    Alert.alert(
      'Clear all transactions?',
      'This removes every transaction permanently. Categories and budgets stay in place. You will need to type DELETE to confirm.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            setDeleteConfirmText('');
            warningHaptic();
            setDeleteModalOpen(true);
          },
        },
      ],
    );
  };

  const onConfirmDelete = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') return;
    setBusy(true);
    setDeleteModalOpen(false);
    try {
      await transactions!.deleteAll();
      Alert.alert('Done', 'All transactions were deleted.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
      setDeleteConfirmText('');
    }
  };

  if (error) {
    return (
      <ScreenScaffold subtitle="Configure your financial workspace">
        <Text style={{ fontFamily: bodyFont, color: colors.error }}>{error.message}</Text>
      </ScreenScaffold>
    );
  }

  // ── Settings search helpers ─────────────────────────────────────────
  const SECTION_DATA: { title: string; keywords: string[] }[] = [
    { title: 'Profile', keywords: ['display name', 'primary currency', 'travel mode'] },
    { title: 'Dashboard', keywords: ['dashboard', 'velocity', 'budget card', 'insight', 'home screen', 'customize'] },
    { title: 'Appearance', keywords: ['color mode', 'light', 'dark', 'system', 'theme', 'palette'] },
    { title: 'Customization', keywords: ['notifications', 'recurring transactions', 'custom categories', 'custom budgets', 'budget alerts', 'subscriptions', 'bills'] },
    { title: 'Security', keywords: ['app lock', 'pin', 'biometric', 'face id', 'fingerprint', 'lock now'] },
    { title: 'Travel', keywords: ['travel mode', 'manage trips', 'trip summaries', 'repair'] },
    { title: 'Integrations', keywords: ['exbot', 'gemini', 'ai', 'api key'] },
    { title: 'Data & backup', keywords: ['export', 'csv', 'json', 'import', 'backup'] },
    { title: 'Danger zone', keywords: ['clear', 'delete', 'wipe', 'data'] },
    { title: 'About', keywords: ['version', 'trackr', 'info'] },
  ];

  const matchesSection = (sectionTitle: string, q: string): boolean => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    if (sectionTitle.toLowerCase().includes(s)) return true;
    const section = SECTION_DATA.find((d) => d.title === sectionTitle);
    return section?.keywords.some((kw) => kw.includes(s)) ?? false;
  };

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

      {/* ── Search ────────────────────────────────────────────────── */}
      <TextInput
        value={settingsQuery}
        onChangeText={setSettingsQuery}
        placeholder="Search settings…"
        placeholderTextColor={colors.onSurfaceVariant}
        style={[
          styles.settingsSearch,
          {
            color: colors.onSurface,
            backgroundColor: colors.surfaceContainerLowest,
            fontFamily: bodyFont,
          },
        ]}
      />

      {/* ── Profile ──────────────────────────────────────────────── */}
      {matchesSection('Profile', settingsQuery) ? <SettingsSection title="Profile" icon="person" defaultExpanded={!!settingsQuery.trim()}>
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
          <CurrencyRow
            currencyCode={currencyCode}
            onConfirm={(code) => void setProfile({ currencyCode: code })}
          />
          <Row
            icon="flight"
            iconBg={colors.surfaceContainerLowest}
            title="Travel mode"
            subtitle={travelModeEnabled ? 'On — new expenses go to your active trip' : 'Off — standard tracking'}
            right={
              <Switch
                value={travelModeEnabled}
                onValueChange={(v) => void setProfile({ travelModeEnabled: v })}
                trackColor={{ false: colors.outlineVariant, true: colors.primaryContainer }}
                thumbColor={travelModeEnabled ? colors.primary : colors.surfaceContainerLowest}
              />
            }
          />
        </Card>
      </SettingsSection> : null}

      {/* ── Dashboard ────────────────────────────────────────────── */}
      {matchesSection('Dashboard', settingsQuery) ? <SettingsSection title="Dashboard" icon="dashboard" defaultExpanded={!!settingsQuery.trim()}>
        <Card>
          <View style={styles.themeBlock}>
            <DashboardPrefRow
              icon="trending-up"
              title="Spending velocity"
              subtitle="Monthly projection based on spending pace"
              autoLabel="After day 3"
              value={dashboardPrefs.showVelocity}
              onChange={(v) => void setProfile({ dashboardPrefs: { ...dashboardPrefs, showVelocity: v } })}
            />
            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
            <DashboardPrefRow
              icon="account-balance-wallet"
              title="Budget card"
              subtitle="Active budget progress on dashboard"
              autoLabel="When configured"
              value={dashboardPrefs.showBudget}
              onChange={(v) => void setProfile({ dashboardPrefs: { ...dashboardPrefs, showBudget: v } })}
            />
            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
            <DashboardPrefRow
              icon="lightbulb-outline"
              title="Insights card"
              subtitle="Rotating spending insights and tips"
              autoLabel="When ≥5 txns"
              value={dashboardPrefs.showInsight}
              onChange={(v) => void setProfile({ dashboardPrefs: { ...dashboardPrefs, showInsight: v } })}
            />
          </View>
        </Card>
      </SettingsSection> : null}

      {/* ── Appearance ───────────────────────────────────────────── */}
      {matchesSection('Appearance', settingsQuery) ? <SettingsSection title="Appearance" icon="palette" defaultExpanded={!!settingsQuery.trim()}>
        <Card divided>
          <ThemeRow />
          <ThemeColorPicker />
        </Card>
      </SettingsSection> : null}

      <Modal visible={nameModalOpen} transparent animationType="fade" accessibilityViewIsModal>
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

      {/* ── Customization (moved up — most-used settings) ────────── */}
      {matchesSection('Customization', settingsQuery) ? <SettingsSection title="Customization" icon="tune" defaultExpanded={!!settingsQuery.trim()}>
        <Card divided>
          <PressableRow
            icon="notifications"
            title="Notifications"
            subtitle="Budget alerts, recurring reminders, weekly summaries"
            onPress={() => router.push('/notification-settings')}
          />
          <PressableRow
            icon="repeat"
            title="Recurring transactions"
            subtitle="Auto-log bills, subscriptions, and regular expenses"
            onPress={() => router.push('/manage-recurring')}
          />
          <PressableRow
            icon="category"
            title="Custom categories"
            subtitle="Manage expense and income tags"
            onPress={() => router.push('/manage-categories')}
          />
          <PressableRow
            icon="account-balance-wallet"
            title="Custom budgets"
            subtitle="Set limits for specific spending areas"
            onPress={() => router.push('/manage-budgets')}
          />
        </Card>
      </SettingsSection> : null}

      {/* ── Security ─────────────────────────────────────────────── */}
      {matchesSection('Security', settingsQuery) ? <SettingsSection title="Security" icon="lock" defaultExpanded={!!settingsQuery.trim()}>
        <Card divided>
          <PressableRow
            icon={lockEnabled ? 'lock' : 'lock-open'}
            title="App Lock"
            subtitle={lockEnabled ? 'PIN protection is active' : 'Disabled — anyone can open the app'}
            onPress={() =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              router.push(`/setup-app-lock?mode=${lockEnabled ? 'disable' : 'enable'}` as any)
            }
          />
          {lockEnabled ? (
            <>
              <PressableRow
                icon="password"
                title="Change PIN"
                subtitle="Replace your current 6-digit PIN"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onPress={() => router.push('/setup-app-lock?mode=change' as any)}
              />
              {hasBiometrics && biometricsEnrolled ? (
                <Row
                  icon="fingerprint"
                  iconBg={colors.surfaceContainerLowest}
                  title="Biometric unlock"
                  subtitle="Use Face ID or fingerprint instead of PIN"
                  right={
                    <Switch
                      value={biometricsEnabled}
                      onValueChange={(v) => void setBiometricsEnabled(v)}
                      trackColor={{ false: colors.outlineVariant, true: colors.primaryContainer }}
                      thumbColor={biometricsEnabled ? colors.primary : colors.surfaceContainerLowest}
                    />
                  }
                />
              ) : null}
              <PressableRow
                icon="exit-to-app"
                title="Lock now"
                subtitle="Immediately lock the app"
                onPress={lock}
              />
            </>
          ) : null}
        </Card>
      </SettingsSection> : null}

      {/* ── Travel ───────────────────────────────────────────────── */}
      {matchesSection('Travel', settingsQuery) ? <SettingsSection title="Travel" icon="flight" defaultExpanded={!!settingsQuery.trim()}>
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
            onPress={() => router.push('/manage-trips')}
          />
          <SecondaryRow
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
      </SettingsSection> : null}

      {/* ── Integrations ─────────────────────────────────────────── */}
      {matchesSection('Integrations', settingsQuery) ? <SettingsSection title="Integrations" icon="auto-awesome" defaultExpanded={!!settingsQuery.trim()}>
        <Card divided>
          <PressableRow
            icon="auto-awesome"
            title="Exbot — Gemini AI"
            subtitle={geminiHasKey ? 'API key saved on this device' : 'Not configured — tap to set up'}
            onPress={() => router.push('/exbot-settings')}
          />
        </Card>
      </SettingsSection> : null}

      {/* ── Data & backup ────────────────────────────────────────── */}
      {matchesSection('Data & backup', settingsQuery) ? <SettingsSection title="Data & backup" icon="backup" defaultExpanded={!!settingsQuery.trim()}>
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
        </Card>
      </SettingsSection> : null}

      {/* ── Danger zone ──────────────────────────────────────────── */}
      {matchesSection('Danger zone', settingsQuery) ? <SettingsSection title="Danger zone" icon="warning" defaultExpanded={settingsQuery.trim() ? true : false}>
        <View style={[styles.dangerBanner, { backgroundColor: colors.errorContainer }]}>
          <MaterialIcons name="warning" size={20} color={colors.error} />
          <Text style={[styles.dangerBannerText, { color: colors.onErrorContainer, fontFamily: bodyFont }]}>
            Actions in this section are irreversible. Deleted data cannot be recovered.
          </Text>
        </View>
        <Card>
          <PressableRow
            icon="delete-forever"
            title="Clear all data"
            subtitle="Permanently wipe every transaction — categories and budgets stay"
            destructive
            onPress={onClear}
            disabled={busy}
          />
        </Card>
      </SettingsSection> : null}

      {/* ── About ────────────────────────────────────────────────── */}
      {matchesSection('About', settingsQuery) ? <SettingsSection title="About" icon="info-outline" defaultExpanded={settingsQuery.trim() ? true : false}>
        <Card>
          <Row
            icon="info-outline"
            iconBg={colors.surfaceContainerLowest}
            title="Trackr"
            subtitle={`Version ${Constants.expoConfig?.version ?? '—'}`}
            right={null}
          />
        </Card>
      </SettingsSection> : null}

      {/* ── Delete confirmation modal ────────────────────────────── */}
      <Modal visible={deleteModalOpen} transparent animationType="fade" accessibilityViewIsModal>
        <Pressable style={styles.nameBackdrop} onPress={() => setDeleteModalOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.nameSheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.nameSheetTitle, { color: colors.error, fontFamily: headlineFont }]}>
              Confirm deletion
            </Text>
            <Text style={{ fontFamily: bodyFont, color: colors.onSurfaceVariant, lineHeight: 20 }}>
              This will permanently delete all transactions. Categories and budgets will remain.{'\n\n'}
              Type <Text style={{ fontWeight: '800', color: colors.error }}>DELETE</Text> below to confirm.
            </Text>
            <TextInput
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Type DELETE to confirm"
              placeholderTextColor={colors.onSurfaceVariant}
              autoCapitalize="characters"
              style={[
                styles.nameInput,
                { color: colors.onSurface, backgroundColor: colors.surfaceContainerLow, fontFamily: bodyFont },
              ]}
            />
            <View style={styles.nameActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={() => { setDeleteModalOpen(false); setDeleteConfirmText(''); }}
                style={[styles.nameGhost, { borderColor: colors.outlineVariant }]}>
                <Text style={{ color: colors.onSurface, fontFamily: labelFont }}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Confirm delete all data"
                onPress={() => void onConfirmDelete()}
                disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                style={[
                  styles.nameSave,
                  {
                    backgroundColor: deleteConfirmText.trim().toUpperCase() === 'DELETE' ? colors.error : colors.surfaceContainerHigh,
                  },
                ]}>
                <Text
                  style={{
                    color: deleteConfirmText.trim().toUpperCase() === 'DELETE' ? colors.onPrimary : colors.onSurfaceVariant,
                    fontFamily: labelFont,
                    fontWeight: '700',
                  }}>
                  Delete all
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  const kids = React.Children.toArray(children).filter(Boolean);
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surfaceContainerLow },
        divided && { overflow: 'hidden' },
      ]}>
      {divided
        ? kids.map((child, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />}
              {child}
            </React.Fragment>
          ))
        : children}
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
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      accessibilityHint={destructive ? 'This is a destructive action' : undefined}
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

function CurrencyRow({ currencyCode, onConfirm }: { currencyCode: string; onConfirm: (code: string) => void }) {
  const { colors } = useAppColors();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const label = useMemo(() => {
    const c = SUPPORTED_CURRENCIES.find((c) => c.code === currencyCode);
    return c ? `${c.label} (${c.code})` : currencyCode;
  }, [currencyCode]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [...SUPPORTED_CURRENCIES];
    return SUPPORTED_CURRENCIES.filter(
      (c) => c.code.toLowerCase().includes(s) || c.label.toLowerCase().includes(s),
    );
  }, [q]);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Primary currency, ${label}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.pressRow,
          { backgroundColor: pressed ? colors.surfaceContainerHigh : 'transparent' },
        ]}>
        <View style={[styles.rowIcon, { backgroundColor: colors.surfaceContainerLowest }]}>
          <MaterialIcons name="attach-money" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.onSurface, fontFamily: bodyFont }]}>Primary currency</Text>
          <Text style={[styles.rowSub, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>{label}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={colors.onSurfaceVariant} />
      </Pressable>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
          <View style={styles.pickerHead}>
            <Text style={[styles.pickerTitle, { color: colors.primary, fontFamily: headlineFont }]}>
              Select currency
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={() => { setOpen(false); setQ(''); }}
              style={{ minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' }}>
              <Text style={{ color: colors.primary, fontFamily: labelFont, fontWeight: '700' }}>Done</Text>
            </Pressable>
          </View>
          <Text style={[styles.pickerHint, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
            Existing amounts stay the same — only the symbol changes.
          </Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search"
            placeholderTextColor={colors.onSurfaceVariant}
            style={[styles.pickerSearch, { color: colors.onSurface, backgroundColor: colors.surfaceContainerLowest, fontFamily: bodyFont }]}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const sel = item.code === currencyCode;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  onPress={() => {
                    if (item.code !== currencyCode) {
                      Alert.alert(
                        'Change currency?',
                        `Switch to ${item.label} (${item.code})? Existing numbers stay the same.`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Change', onPress: () => { onConfirm(item.code); setOpen(false); setQ(''); } },
                        ],
                      );
                    } else {
                      setOpen(false);
                      setQ('');
                    }
                  }}
                  style={[
                    styles.pickerRow,
                    { borderBottomColor: colors.outlineVariant },
                    sel && { backgroundColor: colors.surfaceContainerLow },
                  ]}>
                  <Text style={{ color: colors.onSurface, fontFamily: bodyFont, fontSize: 16 }}>{item.label}</Text>
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

function SecondaryRow({
  icon, title, subtitle, onPress, disabled,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string; subtitle: string; onPress: () => void; disabled?: boolean;
}) {
  const { colors } = useAppColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.secondaryRow,
        { backgroundColor: pressed ? colors.surfaceContainerHigh : 'transparent' },
        disabled && { opacity: 0.5 },
      ]}>
      <MaterialIcons name={icon} size={18} color={colors.onSurfaceVariant} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.secondaryTitle, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const SCHEME_OPTIONS: { label: string; value: import('@/contexts/color-scheme-context').ThemePreference }[] = [
  { label: 'Light', value: 'light' },
  { label: 'System', value: 'system' },
  { label: 'Dark', value: 'dark' },
];

function ThemeRow() {
  const { colors, themePreference, setThemePreference } = useAppColors();
  return (
    <View style={styles.themeBlock}>
      <View style={styles.themeBlockHeader}>
        <View style={[styles.rowIcon, { backgroundColor: colors.surfaceContainerLowest }]}>
          <MaterialIcons name="contrast" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.rowTitle, { color: colors.onSurface, fontFamily: bodyFont }]}>Color mode</Text>
          <Text style={[styles.rowSub, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
            Light, system default, or dark
          </Text>
        </View>
      </View>
      <View style={[styles.themeSegmentFull, { backgroundColor: colors.surfaceContainerHighest }]}>
        {SCHEME_OPTIONS.map((opt) => {
          const active = themePreference === opt.value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${opt.label} mode`}
              onPress={() => void setThemePreference(opt.value)}
              style={[styles.themeChipFull, active && { backgroundColor: colors.primary }]}>
              <Text
                style={{
                  fontFamily: labelFont,
                  fontSize: 13,
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

function ThemeColorPicker() {
  const { colors, scheme, themeName, setThemeName } = useAppColors();
  const [previewName, setPreviewName] = useState<import('@/constants/design-tokens').ThemeName | null>(null);

  const previewTheme = previewName ?? themeName;
  const previewColors = useMemo(
    () => getSemanticColors(scheme, previewTheme),
    [scheme, previewTheme],
  );

  return (
    <View style={styles.themeBlock}>
      <View style={styles.themeBlockHeader}>
        <View style={[styles.rowIcon, { backgroundColor: colors.surfaceContainerLowest }]}>
          <MaterialIcons name="palette" size={22} color={colors.primary} />
        </View>
        <Text style={[styles.rowTitle, { color: colors.onSurface, fontFamily: bodyFont }]}>App theme</Text>
      </View>

      {/* Live preview strip */}
      <View style={[styles.themePreviewStrip, { backgroundColor: previewColors.surfaceContainerLow }]}>
        <View style={[styles.themePreviewDot, { backgroundColor: previewColors.primary }]} />
        <Text style={{ color: previewColors.onSurface, fontFamily: bodyFont, fontSize: 13, fontWeight: '600', flex: 1 }}>
          {THEME_METADATA[previewTheme].label}
        </Text>
        <Text style={{ color: previewColors.onSurfaceVariant, fontFamily: bodyFont, fontSize: 12 }}>
          Aa
        </Text>
        <View style={[styles.themePreviewDot, { backgroundColor: previewColors.tertiary }]} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.swatchScroll}>
        {THEME_NAMES.map((name) => {
          const meta = THEME_METADATA[name];
          const swatch = scheme === 'dark' ? meta.swatchDark : meta.swatchLight;
          const active = themeName === name;
          return (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${meta.label} theme`}
              onPress={() => { setPreviewName(null); void setThemeName(name); }}
              onPressIn={() => setPreviewName(name)}
              onPressOut={() => setPreviewName(null)}
              style={styles.swatchItem}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: swatch },
                  active && { borderWidth: 3, borderColor: colors.onSurface },
                ]}>
                {active ? <MaterialIcons name="check" size={20} color="#fff" /> : null}
              </View>
              <Text
                style={[
                  styles.swatchLabel,
                  { color: active ? colors.onSurface : colors.onSurfaceVariant, fontFamily: labelFont },
                ]}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const PREF_OPTIONS: { label: string; value: DashboardPrefValue }[] = [
  { label: 'Auto', value: 'auto' },
  { label: 'Always', value: 'on' },
  { label: 'Never', value: 'off' },
];

function DashboardPrefRow({
  icon,
  title,
  subtitle,
  autoLabel,
  value,
  onChange,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
  autoLabel: string;
  value: DashboardPrefValue;
  onChange: (v: DashboardPrefValue) => void;
}) {
  const { colors } = useAppColors();
  return (
    <View style={styles.dashPrefRow}>
      <View style={styles.dashPrefHeader}>
        <View style={[styles.rowIcon, { backgroundColor: colors.surfaceContainerLowest }]}>
          <MaterialIcons name={icon} size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.onSurface, fontFamily: bodyFont }]}>{title}</Text>
          <Text style={[styles.rowSub, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>{subtitle}</Text>
        </View>
      </View>
      <View style={[styles.themeSegmentFull, { backgroundColor: colors.surfaceContainerHighest }]}>
        {PREF_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${title}: ${opt.label}${opt.value === 'auto' ? ` (${autoLabel})` : ''}`}
              onPress={() => onChange(opt.value)}
              style={[styles.themeChipFull, active && { backgroundColor: colors.primary }]}>
              <Text
                style={{
                  fontFamily: labelFont,
                  fontSize: 12,
                  fontWeight: '700',
                  color: active ? colors.onPrimary : colors.onSurfaceVariant,
                }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {value === 'auto' ? (
        <Text style={[styles.dashPrefAutoHint, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
          Auto: {autoLabel}
        </Text>
      ) : null}
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
  settingsSearch: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
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
  themeBlock: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    gap: 14,
  },
  themeBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  themeSegmentFull: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    gap: 3,
  },
  themeChipFull: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 11,
    alignItems: 'center',
  },
  swatchScroll: {
    gap: 18,
    paddingTop: 2,
    paddingBottom: 2,
  },
  swatchItem: {
    alignItems: 'center',
    gap: 7,
  },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  themePreviewStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  themePreviewDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 74,
  },
  pickerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  pickerHint: {
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  pickerSearch: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  secondaryTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  dangerBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  dangerBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  dashPrefRow: {
    gap: 10,
  },
  dashPrefHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  dashPrefAutoHint: {
    fontSize: 11,
    fontStyle: 'italic',
    marginLeft: 54,
  },
});
