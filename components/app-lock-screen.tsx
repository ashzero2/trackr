/**
 * AppLockScreen — full-screen PIN entry overlay.
 *
 * Rendered by AppLockGate whenever isLocked === true.
 * Features:
 *  • 6-digit PIN pad with animated dot indicators
 *  • Face ID / Touch ID auto-prompt (if enabled & enrolled)
 *  • Error shake animation on wrong PIN
 *  • Respects the active app theme
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as LocalAuthentication from 'expo-local-authentication';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppColors } from '@/contexts/color-scheme-context';
import { useAppLock } from '@/contexts/app-lock-context';
import { useUserProfile } from '@/contexts/user-profile-context';
import { headlineFont, bodyFont } from '@/constants/typography';

const PIN_LENGTH = 6;
const LOCKOUT_STORAGE_KEY = 'app_lock_lockout';

/** Returns lockout duration in ms based on failed attempt count. */
function getLockoutDurationMs(failedAttempts: number): number {
  if (failedAttempts >= 15) return 15 * 60 * 1000; // 15 minutes
  if (failedAttempts >= 10) return 5 * 60 * 1000;  // 5 minutes
  if (failedAttempts >= 5) return 30 * 1000;        // 30 seconds
  return 0;
}

async function loadLockoutState(): Promise<{ failedAttempts: number; lockedUntil: number | null }> {
  try {
    const raw = await AsyncStorage.getItem(LOCKOUT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        failedAttempts: parsed.failedAttempts ?? 0,
        lockedUntil: parsed.lockedUntil ?? null,
      };
    }
  } catch {}
  return { failedAttempts: 0, lockedUntil: null };
}

async function saveLockoutState(failedAttempts: number, lockedUntil: number | null): Promise<void> {
  await AsyncStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify({ failedAttempts, lockedUntil }));
}

async function clearLockoutState(): Promise<void> {
  await AsyncStorage.removeItem(LOCKOUT_STORAGE_KEY);
}

// ─── Numeric pad layout ───────────────────────────────────────────────────────
const PAD_ROWS: (number | 'back' | 'bio')[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  ['bio', 0, 'back'],
];

// ─── Biometric icon helper ────────────────────────────────────────────────────
function useBiometricIconName(): keyof typeof MaterialIcons.glyphMap {
  const [name, setName] = useState<keyof typeof MaterialIcons.glyphMap>('fingerprint');
  useEffect(() => {
    LocalAuthentication.supportedAuthenticationTypesAsync().then((types) => {
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setName('face');
      } else {
        setName('fingerprint');
      }
    });
  }, []);
  return name;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AppLockScreen() {
  const { colors } = useAppColors();
  const { displayName } = useUserProfile();
  const { unlock, unlockWithBiometrics, biometricsEnabled, hasBiometrics, biometricsEnrolled } =
    useAppLock();
  const bioIconName = useBiometricIconName();

  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  // ── Load lockout state on mount ─────────────────────────────────────
  useEffect(() => {
    loadLockoutState().then((state) => {
      setAttempts(state.failedAttempts);
      if (state.lockedUntil && state.lockedUntil > Date.now()) {
        setLockedUntil(state.lockedUntil);
      }
    });
  }, []);

  // ── Countdown timer during lockout ──────────────────────────────────
  useEffect(() => {
    if (!lockedUntil) {
      setCountdown(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        setLockedUntil(null);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const isLockedOut = lockedUntil !== null && lockedUntil > Date.now();

  const showBiometric =
    biometricsEnabled && hasBiometrics && biometricsEnrolled;

  // ── Shake on error ──────────────────────────────────────────────────────
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

  // ── Submit PIN ──────────────────────────────────────────────────────────
  const submitPin = useCallback(
    async (candidate: string) => {
      if (isLockedOut) return;

      const ok = await unlock(candidate);
      if (ok) {
        // Reset lockout on success
        setAttempts(0);
        setLockedUntil(null);
        await clearLockoutState();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setError(true);
        triggerShake();
        setPin('');
        setTimeout(() => setError(false), 1200);

        // Check if we need to lock out
        const lockoutMs = getLockoutDurationMs(newAttempts);
        if (lockoutMs > 0) {
          const until = Date.now() + lockoutMs;
          setLockedUntil(until);
          await saveLockoutState(newAttempts, until);
        } else {
          await saveLockoutState(newAttempts, null);
        }
      }
    },
    [unlock, triggerShake, attempts, isLockedOut],
  );

  // ── Handle key press ────────────────────────────────────────────────────
  const handleKey = useCallback(
    (key: number | 'back' | 'bio') => {
      if (isLockedOut) return;
      if (key === 'bio') {
        void unlockWithBiometrics();
        return;
      }
      if (key === 'back') {
        setPin((p) => p.slice(0, -1));
        return;
      }
      setPin((p) => {
        const next = p.length < PIN_LENGTH ? p + String(key) : p;
        if (next.length === PIN_LENGTH) {
          // Submit after state update
          setTimeout(() => void submitPin(next), 60);
        }
        return next;
      });
    },
    [unlockWithBiometrics, submitPin],
  );

  // ── Auto-trigger biometrics on mount ────────────────────────────────────
  useEffect(() => {
    if (showBiometric) {
      // Small delay so the lock screen has rendered before the system dialog
      const t = setTimeout(() => void unlockWithBiometrics(), 400);
      return () => clearTimeout(t);
    }
  }, [showBiometric, unlockWithBiometrics]);

  // ── Greeting ────────────────────────────────────────────────────────────
  const greeting = displayName.trim() ? `Welcome back, ${displayName.trim().split(' ')[0]}` : 'Welcome back';

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={[styles.logoCircle, { backgroundColor: colors.primaryContainer }]}>
          <MaterialIcons name="lock" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.appName, { color: colors.primary, fontFamily: headlineFont }]}>
          Trackr
        </Text>
        <Text style={[styles.greeting, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
          {greeting}
        </Text>
        <Text style={[styles.prompt, { color: colors.onSurface, fontFamily: bodyFont }]}>
          Enter your PIN to continue
        </Text>
      </View>

      {/* ── PIN dots ───────────────────────────────────────────────────── */}
      <Animated.View
        style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const filled = i < pin.length;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: filled
                    ? error
                      ? colors.error
                      : colors.primary
                    : colors.surfaceContainerHigh,
                  borderColor: filled
                    ? error
                      ? colors.error
                      : colors.primary
                    : colors.outlineVariant,
                  transform: [{ scale: filled ? 1.1 : 1 }],
                },
              ]}
            />
          );
        })}
      </Animated.View>

      {/* ── Error / lockout / attempts text ─────────────────────────────── */}
      <View style={styles.errorRow}>
        {isLockedOut ? (
          <Text style={[styles.errorText, { color: colors.error, fontFamily: bodyFont }]}>
            Too many attempts. Try again in {countdown}s
          </Text>
        ) : error ? (
          <Text style={[styles.errorText, { color: colors.error, fontFamily: bodyFont }]}>
            {attempts >= 5
              ? `Incorrect PIN (${attempts} attempts)`
              : 'Incorrect PIN'}
          </Text>
        ) : null}
      </View>

      {/* ── Number pad ─────────────────────────────────────────────────── */}
      <View style={styles.pad}>
        {PAD_ROWS.map((row, ri) => (
          <View key={ri} style={styles.padRow}>
            {row.map((key) => {
              const isSpecial = key === 'back' || key === 'bio';
              const isBio = key === 'bio';
              const isBack = key === 'back';

              // Hide bio button if not available
              if (isBio && !showBiometric) {
                return <View key="bio-empty" style={styles.padKey} />;
              }

              return (
                <Pressable
                  key={String(key)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isBio ? 'Biometric unlock' : isBack ? 'Delete' : String(key)
                  }
                  onPress={() => handleKey(key)}
                  style={({ pressed }) => [
                    styles.padKey,
                    !isSpecial && {
                      backgroundColor: pressed
                        ? colors.surfaceContainerHighest
                        : colors.surfaceContainerLow,
                    },
                    isSpecial && {
                      backgroundColor: pressed
                        ? colors.surfaceContainerHigh
                        : 'transparent',
                    },
                  ]}>
                  {isBack ? (
                    <MaterialIcons name="backspace" size={24} color={colors.onSurface} />
                  ) : isBio ? (
                    <MaterialIcons name={bioIconName} size={28} color={colors.primary} />
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

    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 24,
  },
  header: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 24,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  greeting: {
    fontSize: 14,
    marginTop: 2,
  },
  prompt: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 6,
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
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pad: {
    width: '100%',
    paddingHorizontal: 24,
    gap: 12,
    paddingBottom: 8,
  },
  padRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  padKey: {
    flex: 1,
    aspectRatio: 1.6,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  padKeyText: {
    fontSize: 26,
    fontWeight: '600',
  },
});
