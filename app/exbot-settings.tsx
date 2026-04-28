import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { bodyFont, headlineFont, labelFont } from '@/constants/typography';
import { useAppColors } from '@/contexts/color-scheme-context';
import {
  DEFAULT_GEMINI_MODEL,
  getGeminiApiKey,
  getGeminiModelId,
  setGeminiApiKey,
  setGeminiModelId,
} from '@/lib/ai-settings';
import { geminiGenerateContent } from '@/lib/gemini-client';

export default function ExbotSettingsScreen() {
  const router = useRouter();
  const { colors } = useAppColors();
  const [busy, setBusy] = useState(false);
  const [geminiKeyDraft, setGeminiKeyDraft] = useState('');
  const [geminiHasKey, setGeminiHasKey] = useState(false);
  const [geminiModelDraft, setGeminiModelDraft] = useState(DEFAULT_GEMINI_MODEL);
  const [showKey, setShowKey] = useState(false);

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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backRow}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontFamily: labelFont, fontWeight: '700' }}>Back</Text>
        </Pressable>

        <Text style={[styles.title, { color: colors.primary, fontFamily: headlineFont }]}>
          Exbot — Gemini AI
        </Text>
        <Text style={[styles.hint, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
          Exbot uses your key from Google AI Studio. Chat and smart import send prompts and file
          snippets to Google's Gemini API. The key stays on this device.
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow }]}>
          {/* API Key */}
          <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>
            API KEY
          </Text>
          <Text style={[styles.fieldStatus, { color: colors.onSurface, fontFamily: bodyFont }]}>
            {geminiHasKey ? 'A key is saved. Paste a new one to replace it.' : 'No key saved yet.'}
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              value={geminiKeyDraft}
              onChangeText={setGeminiKeyDraft}
              placeholder="Paste Gemini API key"
              placeholderTextColor={colors.onSurfaceVariant}
              secureTextEntry={!showKey}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,
                styles.inputFlex,
                { color: colors.onSurface, backgroundColor: colors.surfaceContainerLowest, fontFamily: bodyFont },
              ]}
            />
            <Pressable
              onPress={() => setShowKey((v) => !v)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showKey ? 'Hide API key' : 'Show API key'}
              style={[styles.eyeBtn, { backgroundColor: colors.surfaceContainerLowest }]}>
              <MaterialIcons
                name={showKey ? 'visibility-off' : 'visibility'}
                size={20}
                color={colors.onSurfaceVariant}
              />
            </Pressable>
          </View>

          {/* Model ID */}
          <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant, fontFamily: labelFont, marginTop: 16 }]}>
            MODEL ID
          </Text>
          <TextInput
            value={geminiModelDraft}
            onChangeText={setGeminiModelDraft}
            placeholder={DEFAULT_GEMINI_MODEL}
            placeholderTextColor={colors.onSurfaceVariant}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              { color: colors.onSurface, backgroundColor: colors.surfaceContainerLowest, fontFamily: bodyFont },
            ]}
          />
          <Text style={[styles.modelHint, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
            Use {DEFAULT_GEMINI_MODEL} if you see quota errors with other model names.
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save Gemini settings"
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
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
            <Text style={{ color: colors.onPrimary, fontFamily: labelFont, fontWeight: '700' }}>Save</Text>
          </Pressable>

          {geminiHasKey ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Test Gemini connection"
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
                style={[styles.ghostBtn, { borderColor: colors.outlineVariant, opacity: busy ? 0.5 : 1 }]}>
                <Text style={{ color: colors.primary, fontFamily: labelFont }}>Test connection</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove API key"
                accessibilityHint="This is a destructive action"
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
                style={[styles.ghostBtn, { borderColor: colors.outlineVariant }]}>
                <Text style={{ color: colors.error, fontFamily: labelFont }}>Remove key</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 80, paddingTop: 8, gap: 16 },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: MIN_TOUCH_TARGET,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  fieldStatus: {
    fontSize: 13,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
  },
  inputFlex: {
    flex: 1,
  },
  eyeBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelHint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: -2,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
  },
  primaryBtn: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
  ghostBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
});