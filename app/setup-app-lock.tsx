/**
 * Setup App Lock screen — reachable from Settings → Security → App Lock
 *
 * Flows handled:
 *  1. enable  — create a new PIN (two-step: enter → confirm)
 *  2. disable — enter current PIN to turn lock off
 *  3. change  — enter current PIN → enter new PIN → confirm new PIN
 *
 * The active flow is determined by the `mode` route param:
 *   /setup-app-lock?mode=enable | disable | change
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppColors } from '@/contexts/color-scheme-context';
import { useAppLock } from '@/contexts/app-lock-context';
import { headlineFont, bodyFont } from '@/constants/typography';

type Mode = 'enable' | 'disable' | 'change';

// Which sub-step the user is on inside a flow
type SubStep =
  | 'enter_current'   // disable / change: verify existing PIN
  | 'enter_new'       // enable / change:  pick new PIN
  | 'confirm_new';    // enable / change:  confirm new PIN

const PIN_LENGTH = 6;

// Pad definition — 'empty' is a transparent spacer in the bottom-left slot
const PAD_KEYS: (number | 'back' | 'empty')[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  ['empty', 0, 'back'],
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function stepTitle(mode: Mode, subStep: SubStep): string {
  if (mode === 'disable') return 'Enter your current PIN';
  if (subStep === 'enter_current') return 'Enter your current PIN';
  if (subStep === 'enter_new') return 'Choose a 6-digit PIN';
  return 'Confirm your PIN';
}

function stepSubtitle(mode: Mode, subStep: SubStep): string {
  if (mode === 'disable') return 'Confirm your identity to remove the lock.';
  if (subStep === 'enter_current') return 'Verify your current PIN before making changes.';
  if (subStep === 'enter_new') return 'This PIN protects all your financial data.';
  return 'Re-enter the PIN to make sure you typed it correctly.';
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SetupAppLockScreen() {
  const { colors } = useAppColors();
  const { mode: rawMode } = useLocalSearchParams<{ mode: string }>();
  const mode: Mode =
    rawMode === 'disable' ? 'disable' : rawMode === 'change' ? 'change' : 'enable';

  const {
    enableLock,
    disableLock,
    changePIN,
    biometricsEnabled,
    hasBiometrics,
    biometricsEnrolled,
    setBiometricsEnabled,
  } = useAppLock();

  // Sub-step state
  const initialSubStep: SubStep =
    mode === 'enable' ? 'enter_new' : 'enter_current';
  const [subStep, setSubStep] = useState<SubStep>(initialSubStep);
  const [pin, setPin] = useState('');
  const [pendingPin, setPendingPin] = useState(''); // stored between enter_new → confirm_new
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const showBiometricToggle =
    mode === 'enable' && hasBiometrics && biometricsEnrolled;

  // ── Shake ───────────────────────────────────────────────────────────────
  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const showError = useCallback(
    (msg?: string) => {
      setError(true);
      triggerShake();
      setPin('');
      setTimeout(() => setError(false), 1200);
      if (msg) {
        setTimeout(() => Alert.alert('Error', msg), 300);
      }
    },
    [triggerShake],
  );

  // ── Submit logic ────────────────────────────────────────────────────────
  const submit = useCallback(
    async (candidate: string) => {
      setBusy(true);
      try {
        // ── DISABLE flow ──────────────────────────────────────────────
        if (mode === 'disable') {
          const ok = await disableLock(candidate);
          if (!ok) {
            showError();
          } else {
            setDone(true);
            setTimeout(() => router.back(), 800);
          }
          return;
        }

        // ── CHANGE flow ───────────────────────────────────────────────
        if (mode === 'change') {
          if (subStep === 'enter_current') {
            // We'll validate by attempting changePIN with a dummy new pin later;
            // For now store and move on — we actually need the current PIN for changePIN().
            // Store current PIN temporarily and move to enter_new.
            setPendingPin(candidate);
            setSubStep('enter_new');
            setPin('');
            return;
          }
          if (subStep === 'enter_new') {
            // Store the new PIN draft; move to confirm
            setPendingPin(candidate);
            setSubStep('confirm_new');
            setPin('');
            return;
          }
          // confirm_new
          if (candidate !== pendingPin) {
            showError("PINs don't match. Try again.");
            setSubStep('enter_new');
            setPendingPin('');
            return;
          }
          // We stored the current PIN in the first pass (enter_current → pendingPin)
          // But we used pendingPin for the new PIN in the second pass.
          // We need a separate ref for the current PIN.
          // NOTE: see currentPinRef below
          const currentPin = currentPinRef.current;
          const ok = await changePIN(currentPin, candidate);
          if (!ok) {
            showError('Current PIN was incorrect. Please try again.');
            setSubStep('enter_current');
            currentPinRef.current = '';
            setPendingPin('');
          } else {
            setDone(true);
            setTimeout(() => router.back(), 800);
          }
          return;
        }

        // ── ENABLE flow ───────────────────────────────────────────────
        if (subStep === 'enter_new') {
          setPendingPin(candidate);
          setSubStep('confirm_new');
          setPin('');
          return;
        }
        // confirm_new
        if (candidate !== pendingPin) {
          showError("PINs don't match. Try again.");
          setSubStep('enter_new');
          setPendingPin('');
          return;
        }
        await enableLock(candidate);
        setDone(true);
        setTimeout(() => router.back(), 800);
      } catch (e) {
        showError(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        setBusy(false);
      }
    },
    [mode, subStep, pendingPin, disableLock, changePIN, enableLock, showError],
  );

  // Ref to store current PIN across steps in the CHANGE flow
  const currentPinRef = useRef('');

  // ── Key handler ─────────────────────────────────────────────────────────
  const handleKey = useCallback(
    (key: number | 'back' | 'empty') => {
      if (key === 'empty') return;
      if (key === 'back') {
        setPin((p) => p.slice(0, -1));
        return;
      }
      setPin((p) => {
        const next = p.length < PIN_LENGTH ? p + String(key) : p;
        if (next.length === PIN_LENGTH) {
          // CHANGE flow: save current PIN to ref on first step
          if (mode === 'change' && subStep === 'enter_current') {
            currentPinRef.current = next;
          }
          setTimeout(() => void submit(next), 60);
        }
        return next;
      });
    },
    [submit, mode, subStep],
  );

  const title = stepTitle(mode, subStep);
  const subtitle = stepSubtitle(mode, subStep);

  // ── Success overlay ─────────────────────────────────────────────────────
  if (done) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.successContainer}>
          <View style={[styles.successCircle, { backgroundColor: colors.primaryContainer }]}>
            <MaterialIcons name="check" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.successTitle, { color: colors.primary, fontFamily: headlineFont }]}>
            {mode === 'disable' ? 'Lock removed' : mode === 'change' ? 'PIN changed' : 'Lock enabled'}
          </Text>
          <Text style={[styles.successSub, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
            {mode === 'disable'
              ? 'App lock has been turned off.'
              : mode === 'change'
              ? 'Your new PIN is active.'
              : 'Your financial data is now protected.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryContainer }]}>
            <MaterialIcons
              name={mode === 'disable' ? 'lock-open' : 'lock'}
              size={28}
              color={colors.primary}
            />
          </View>
          <Text style={[styles.title, { color: colors.onSurface, fontFamily: headlineFont }]}>
            {title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
            {subtitle}
          </Text>
        </View>

        {/* ── PIN dots ─────────────────────────────────────────────── */}
        <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => {
            const filled = i < pin.length;
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: filled
                      ? error ? colors.error : colors.primary
                      : colors.surfaceContainerHigh,
                    borderColor: filled
                      ? error ? colors.error : colors.primary
                      : colors.outlineVariant,
                  },
                ]}
              />
            );
          })}
        </Animated.View>

        {/* ── Error text ───────────────────────────────────────────── */}
        <View style={styles.errorRow}>
          {error ? (
            <Text style={[styles.errorText, { color: colors.error, fontFamily: bodyFont }]}>
              Incorrect PIN
            </Text>
          ) : null}
        </View>

        {/* ── Number pad ───────────────────────────────────────────── */}
        <View style={styles.pad}>
          {PAD_KEYS.map((row, ri) => (
            <View key={ri} style={styles.padRow}>
              {row.map((key, ki) => {
                if (key === 'empty') {
                  return <View key={`empty-${ki}`} style={styles.padKey} />;
                }
                const isBack = key === 'back';
                return (
                  <Pressable
                    key={String(key)}
                    accessibilityRole="button"
                    accessibilityLabel={isBack ? 'Delete' : String(key)}
                    onPress={() => handleKey(key)}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.padKey,
                      {
                        backgroundColor: isBack
                          ? pressed ? colors.surfaceContainerHigh : 'transparent'
                          : pressed ? colors.surfaceContainerHighest : colors.surfaceContainerLow,
                        opacity: busy ? 0.5 : 1,
                      },
                    ]}>
                    {isBack ? (
                      <MaterialIcons name="backspace" size={24} color={colors.onSurface} />
                    ) : (
                      <Text
                        style={[
                          styles.padKeyText,
                          { color: colors.onSurface, fontFamily: headlineFont },
                        ]}>
                        {key}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* ── Biometric toggle (only on enable flow) ───────────────── */}
        {showBiometricToggle ? (
          <View style={[styles.bioToggleCard, { backgroundColor: colors.surfaceContainerLow }]}>
            <View style={[styles.bioIconWrap, { backgroundColor: colors.surfaceContainerLowest }]}>
              <MaterialIcons name="fingerprint" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bioTitle, { color: colors.onSurface, fontFamily: bodyFont }]}>
                Biometric unlock
              </Text>
              <Text style={[styles.bioSub, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
                Use Face ID or fingerprint to unlock
              </Text>
            </View>
            <Switch
              value={biometricsEnabled}
              onValueChange={(v) => void setBiometricsEnabled(v)}
              trackColor={{ false: colors.outlineVariant, true: colors.primaryContainer }}
              thumbColor={biometricsEnabled ? colors.primary : colors.surfaceContainerLowest}
            />
          </View>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    padding: 24,
    gap: 4,
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 16,
    paddingBottom: 24,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  errorRow: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pad: {
    gap: 12,
  },
  padRow: {
    flexDirection: 'row',
    gap: 12,
  },
  padKey: {
    flex: 1,
    aspectRatio: 1.7,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  padKeyText: {
    fontSize: 26,
    fontWeight: '600',
  },
  bioToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    padding: 18,
    marginTop: 24,
  },
  bioIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  bioSub: {
    fontSize: 12,
    marginTop: 2,
  },
  // Success state
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  successSub: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
