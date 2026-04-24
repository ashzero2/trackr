import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as DocumentPicker from 'expo-document-picker';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { useAppColors } from '@/contexts/color-scheme-context';
import type { Repositories } from '@/contexts/database-context';
import { useDatabase } from '@/contexts/database-context';
import { useUserProfile } from '@/contexts/user-profile-context';
import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { bodyFont, headlineFont, labelFont } from '@/constants/typography';
import { runGeminiChatTurn } from '@/lib/ai-agent';
import { tryExbotFastPath } from '@/lib/exbot-fast-path';
import { getGeminiApiKey, getGeminiModelId } from '@/lib/ai-settings';
import type { GeminiContent } from '@/lib/gemini-client';
import { mapCsvWithGemini } from '@/lib/gemini-csv-map';
import { tryParseBankOrWalletCsv } from '@/lib/import-csv';
import { importTransactionRows, readDocumentPickerAssetAsText, type ParsedImportRow } from '@/lib/transaction-json';

const TAB_BAR_EXTRA = 96;

const EXBOT_NAME = 'Exbot';

/** Shown above the composer while waiting for Gemini (always visible). */
const AI_LOADING_MESSAGES = [
  'Building your answer…',
  'Crunching the numbers…',
  'Putting thoughts in order…',
  'Almost there…',
  'Checking your data…',
  'Drafting a reply…',
  'Teaching the spreadsheet hamsters to run faster…',
  'Consulting a rubber duck about your cash flow…',
  'Counting virtual beans. Almost ethically sourced.',
  'Bribing the server with cookies (the HTTP kind)…',
  'Rounding up rogue cents with a tiny lasso…',
  'Negotiating with a VERY stubborn decimal…',
  'Herding categories into neat little piles…',
  'Reticulating finance splines…',
  'Asking the magic 8-ball — it said “ask again after tax season.”',
  'Polishing your pennies until they sparkle…',
  'Inflating thought balloons (eco-friendly, 100% hot air)…',
  'Double-checking we didn’t blow it all on fancy lattes…',
  'Syncing with the cloud (it’s fluffy today)…',
  'Waking up the abacus from a nap…',
];

function randomLoadingMessage(): string {
  return AI_LOADING_MESSAGES[Math.floor(Math.random() * AI_LOADING_MESSAGES.length)]!;
}

type ChatLine = { id: string; role: 'user' | 'assistant'; text: string };

function buildSystemInstruction(currencyCode: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are ${EXBOT_NAME}, the only in-app assistant for Trackr (personal finance). Always speak as ${EXBOT_NAME} (first person optional: "I" as ${EXBOT_NAME}).

The user’s primary currency is ${currencyCode}. Today’s date (UTC) is ${today}.

STRICT SCOPE — you ONLY help with Trackr: saved transactions, categories, budgets, trips, spending/income summaries, trends, importing CSV or wallet-style files, and how to use ${EXBOT_NAME} in this app. Use the provided tools whenever the user asks about data that could be in their database.

OUT OF SCOPE — do NOT answer general knowledge, programming (e.g. Python, JavaScript), homework, news, other products, or medical/legal/financial advice beyond reflecting their own app data. Do NOT act as a broad chatbot. If asked anything outside Trackr, refuse briefly: say you’re ${EXBOT_NAME} and only handle money tracking in Trackr, then suggest 1–2 on-topic examples (e.g. "Summarize this month’s spending", "List my categories"). Keep refusals short and friendly.

RULES: Never invent balances or transactions. For bulk adds, use propose_transactions with valid rows; the user confirms in the app before saving. Keep on-topic replies concise.`;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function AiScreen() {
  const { colors } = useAppColors();
  const insets = useSafeAreaInsets();
  const { currencyCode } = useUserProfile();
  const { ready, error, db, categories, transactions, trips, budgets } = useDatabase();
  const repos = useMemo((): Repositories | null => {
    if (!categories || !transactions || !trips || !budgets) return null;
    return { categories, transactions, trips, budgets };
  }, [categories, transactions, trips, budgets]);

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [apiContents, setApiContents] = useState<GeminiContent[]>([]);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingQuip, setLoadingQuip] = useState<string | null>(null);
  const [importingFile, setImportingFile] = useState(false);
  const [pendingRows, setPendingRows] = useState<ParsedImportRow[] | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const listRef = useRef<FlatList<ChatLine>>(null);

  const listBottomPad = 16;
  const composerBottomPad = TAB_BAR_EXTRA + Math.max(insets.bottom, 8);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => {
      setKeyboardInset(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvt, () => {
      setKeyboardInset(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const refreshKey = useCallback(async () => {
    const [k, m] = await Promise.all([getGeminiApiKey(), getGeminiModelId()]);
    setApiKey(k?.trim() ? k : null);
    setModelId(m);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshKey();
    }, [refreshKey]),
  );

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [lines.length, sending, loadingQuip]);

  const sendMessage = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || sending) return;
    const r = repos;
    if (!r) {
      Alert.alert('Not ready', 'Database is still loading.');
      return;
    }

    const fastReply = await tryExbotFastPath(text, r);
    if (fastReply) {
      setInput('');
      setLines((prev) => [
        ...prev,
        { id: newId(), role: 'user', text },
        { id: newId(), role: 'assistant', text: fastReply },
      ]);
      setApiContents((prev) => [
        ...prev,
        { role: 'user', parts: [{ text }] },
        { role: 'model', parts: [{ text: fastReply }] },
      ]);
      return;
    }

    if (!apiKey || !modelId) {
      Alert.alert('Gemini API key', `Add your key under Settings → Exbot (Gemini) to use ${EXBOT_NAME}.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => router.push('/(tabs)/settings' as Href) },
      ]);
      return;
    }

    setInput('');
    setLines((prev) => [...prev, { id: newId(), role: 'user', text }]);
    setLoadingQuip(randomLoadingMessage());
    setSending(true);
    try {
      const result = await runGeminiChatTurn({
        apiKey,
        modelId,
        systemInstruction: buildSystemInstruction(currencyCode),
        priorContents: apiContents,
        userText: text,
        repos: r,
      });
      if (!result.ok) {
        let errMsg = result.error;
        if (/resource\s*exhausted|quota|exceeded|429/i.test(errMsg)) {
          errMsg += `\n\nIf curl works with gemini-flash-latest, set that as Model id in Settings → Exbot (Gemini) and save.`;
        }
        setLines((prev) => [...prev, { id: newId(), role: 'assistant', text: `Error: ${errMsg}` }]);
        return;
      }
      setApiContents(result.contents);
      setLines((prev) => [...prev, { id: newId(), role: 'assistant', text: result.assistantText }]);
      if (result.proposedRows.length > 0) {
        setPendingRows(result.proposedRows);
      }
    } catch (e) {
      setLines((prev) => [
        ...prev,
        { id: newId(), role: 'assistant', text: e instanceof Error ? e.message : 'Something went wrong.' },
      ]);
    } finally {
      setSending(false);
      setLoadingQuip(null);
    }
  };

  const onSend = () => void sendMessage(input);

  const confirmImport = (rows: ParsedImportRow[]) => {
    const r = repos;
    if (!r || !db) return;
    Alert.alert(
      'Import transactions?',
      `Add ${rows.length} transaction(s). Category "Imported" or others will be created if needed. Existing data is kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            try {
              await importTransactionRows(db, r.categories, r.trips, r.transactions, [], rows);
              setPendingRows(null);
              Alert.alert('Done', `Imported ${rows.length} transaction(s).`);
            } catch (e) {
              Alert.alert('Import failed', e instanceof Error ? e.message : 'Unknown error');
            }
          },
        },
      ],
    );
  };

  const onPickFile = async () => {
    if (!apiKey || !modelId) {
      Alert.alert('Gemini API key', 'Add your key under Settings to use smart CSV mapping when needed.', [
        { text: 'Settings', onPress: () => router.push('/(tabs)/settings' as Href) },
        { text: 'OK', style: 'cancel' },
      ]);
    }
    const r = repos;
    if (!r) {
      Alert.alert('Not ready', 'Database is still loading.');
      return;
    }
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: ['text/*', 'text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });
      if (pick.canceled || !pick.assets?.[0]) return;
      const asset = pick.assets[0];
      setImportingFile(true);
      const text = await readDocumentPickerAssetAsText(asset);
      const heuristic = tryParseBankOrWalletCsv(text);
      if (heuristic.ok) {
        setPendingRows(heuristic.rows);
        Alert.alert(
          'File parsed',
          `Found ${heuristic.rows.length} row(s) using built-in CSV rules. Review and import from the banner below.`,
        );
        setImportingFile(false);
        return;
      }
      const key = apiKey ?? (await getGeminiApiKey());
      const model = modelId ?? (await getGeminiModelId());
      if (!key?.trim()) {
        Alert.alert('Gemini required', 'Add an API key in Settings to map unknown CSV formats.');
        setImportingFile(false);
        return;
      }
      const mapped = await mapCsvWithGemini(key, model, text);
      if (!mapped.ok) {
        Alert.alert('Could not import', mapped.error);
        setImportingFile(false);
        return;
      }
      setPendingRows(mapped.rows);
      Alert.alert(
        'Mapped with Gemini',
        `${mapped.rows.length} row(s) were parsed. Review and import from the banner below.`,
      );
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setImportingFile(false);
    }
  };

  const suggested = ['Summarize spending for this calendar month.', 'List my categories.', 'What did I spend last week?'];

  if (error) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.surface }]} edges={['top']}>
        <AppHeader />
        <Text style={[styles.errorText, { color: colors.error, fontFamily: bodyFont }]}>{error.message}</Text>
      </SafeAreaView>
    );
  }

  if (!ready || !repos) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.surface }]} edges={['top']}>
        <AppHeader />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  /** iOS: lift composer by keyboard height. Android: `softwareKeyboardLayoutMode: resize` shrinks the window — avoid double offset. */
  const composerPadBottom = keyboardInset > 0 ? 12 : composerBottomPad;
  const composerLift = Platform.OS === 'ios' && keyboardInset > 0 ? keyboardInset : 0;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.surface }]} edges={['top']}>
      <View style={styles.root}>
      <AppHeader />
      <View style={styles.subtitleRow}>
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
          {EXBOT_NAME} — your spending and import helper (Trackr only).
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Import file"
          onPress={() => void onPickFile()}
          disabled={importingFile}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: pressed ? colors.surfaceContainerHigh : colors.surfaceContainerLow },
            importingFile && { opacity: 0.5 },
          ]}>
          {importingFile ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MaterialIcons name="upload-file" size={22} color={colors.primary} />
          )}
        </Pressable>
      </View>

      {!apiKey ? (
        <Pressable
          onPress={() => router.push('/(tabs)/settings' as Href)}
          style={[styles.keyBanner, { backgroundColor: colors.secondaryContainer }]}>
          <MaterialIcons name="key" size={20} color={colors.onSecondaryContainer} />
          <Text style={[styles.keyBannerText, { color: colors.onSecondaryContainer, fontFamily: bodyFont }]}>
            Add a Gemini API key in Settings to chat with {EXBOT_NAME} and use smart CSV mapping.
          </Text>
          <MaterialIcons name="chevron-right" size={22} color={colors.onSecondaryContainer} />
        </Pressable>
      ) : null}

      {pendingRows && pendingRows.length > 0 ? (
        <View style={[styles.pendingBar, { backgroundColor: colors.primaryContainer }]}>
          <Text style={{ color: colors.onPrimaryContainer, fontFamily: labelFont, flex: 1 }}>
            {pendingRows.length} transaction(s) ready
          </Text>
          <Pressable
            onPress={() => confirmImport(pendingRows)}
            style={[styles.pendingBtn, { backgroundColor: colors.primary }]}>
            <Text style={{ color: colors.onPrimary, fontFamily: labelFont, fontWeight: '700' }}>Import</Text>
          </Pressable>
          <Pressable onPress={() => setPendingRows(null)} style={styles.pendingDismiss}>
            <Text style={{ color: colors.onPrimaryContainer, fontFamily: labelFont }}>Dismiss</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.listWrap}>
        <FlatList
          ref={listRef}
          style={styles.list}
          data={lines}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPad }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: colors.primary, fontFamily: headlineFont }]}>{EXBOT_NAME}</Text>
              <Text style={[styles.emptyBody, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
                I only help with your Trackr data — spending, categories, imports, and trips. Tap a suggestion or type below.
              </Text>
              <View style={styles.chips}>
                {suggested.map((s) => (
                  <Pressable
                    key={s}
                    disabled={sending}
                    onPress={() => void sendMessage(s)}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        backgroundColor: pressed ? colors.surfaceContainerHigh : colors.surfaceContainerLow,
                        borderColor: colors.outlineVariant,
                      },
                      sending && { opacity: 0.5 },
                    ]}>
                    <Text style={{ color: colors.onSurface, fontFamily: bodyFont, fontSize: 13 }} numberOfLines={3}>
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubbleWrap,
              item.role === 'user' ? styles.bubbleWrapUser : styles.bubbleWrapAssistant,
            ]}>
            <View
              style={[
                styles.bubble,
                {
                  backgroundColor:
                    item.role === 'user' ? colors.primaryContainer : colors.surfaceContainerLow,
                },
              ]}>
              <Text
                style={[
                  styles.bubbleText,
                  {
                    color: item.role === 'user' ? colors.onPrimaryContainer : colors.onSurface,
                    fontFamily: bodyFont,
                  },
                ]}>
                {item.text}
              </Text>
            </View>
          </View>
        )}
        />
      </View>

      <View
        style={[
          styles.inputPanel,
          {
            marginBottom: composerLift,
            paddingBottom: composerPadBottom,
            borderTopColor: colors.outlineVariant,
            backgroundColor: colors.surfaceContainerLow,
          },
        ]}>
        {sending ? (
          <View style={[styles.loadingStripInner, { borderBottomColor: colors.outlineVariant }]}>
            <ActivityIndicator size="small" color={colors.primary} accessibilityLabel="Loading" />
            <Text
              style={[styles.loadingStripText, { color: colors.onSurface, fontFamily: bodyFont }]}
              numberOfLines={3}>
              {loadingQuip ?? 'Building your answer…'}
            </Text>
          </View>
        ) : null}
        <View style={styles.composerRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type a message…"
            placeholderTextColor={colors.onSurfaceVariant}
            multiline
            maxLength={8000}
            onFocus={() => {
              requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
            }}
            style={[
              styles.input,
              {
                color: colors.onSurface,
                backgroundColor: colors.surfaceContainerHighest,
                fontFamily: bodyFont,
                borderColor: colors.outlineVariant,
              },
            ]}
            editable={!sending}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            onPress={onSend}
            disabled={sending || !input.trim()}
            style={[
              styles.sendBtn,
              { backgroundColor: colors.primary },
              (!input.trim() || sending) && { opacity: 0.45 },
            ]}>
            {sending ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <MaterialIcons name="send" size={22} color={colors.onPrimary} />
            )}
          </Pressable>
        </View>
      </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  listWrap: {
    flex: 1,
    minHeight: 0,
  },
  list: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    padding: 24,
    fontSize: 15,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 8,
    gap: 12,
  },
  subtitle: {
    flex: 1,
    fontSize: 14,
  },
  iconBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
  },
  keyBannerText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  pendingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 12,
    borderRadius: 16,
  },
  pendingBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pendingDismiss: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    flexGrow: 1,
  },
  empty: {
    paddingTop: 24,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  chips: {
    gap: 10,
    marginTop: 8,
  },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleWrap: {
    marginBottom: 12,
    maxWidth: '100%',
  },
  bubbleWrapUser: {
    alignSelf: 'flex-end',
  },
  bubbleWrapAssistant: {
    alignSelf: 'flex-start',
  },
  bubble: {
    maxWidth: '92%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  inputPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  loadingStripInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  loadingStripText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingTop: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sendBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});
