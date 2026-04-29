/**
 * AppLockContext — SEC-C1 fix
 *
 * Provides PIN-based and biometric app locking.
 * Settings are stored in expo-secure-store (hardware-backed keychain).
 * PIN is never stored in plain text — only a SHA-256 hash is persisted.
 *
 * Behaviour:
 *  • Lock on first launch if enabled.
 *  • Re-lock after BACKGROUND_LOCK_DELAY_MS of background time.
 *  • Biometric prompt fires automatically on the lock screen if enabled.
 */

import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

// ─── Storage keys ────────────────────────────────────────────────────────────
const KEY_ENABLED = 'trackr.applock.enabled';
const KEY_PIN_HASH = 'trackr.applock.pin_hash';
const KEY_BIOMETRICS = 'trackr.applock.biometrics_enabled';

/** Seconds in background before the app re-locks. */
const BACKGROUND_LOCK_DELAY_MS = 15_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function hashPin(pin: string): Promise<string> {
  // Salt with a fixed app-specific prefix so rainbow tables are useless.
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `trackr:applock:${pin}`,
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────
export type AppLockContextValue = {
  /** True when the context has finished reading from SecureStore. */
  ready: boolean;
  /** Whether the lock feature is turned on. */
  isEnabled: boolean;
  /** Whether the app is currently showing the lock screen. */
  isLocked: boolean;
  /** Whether biometric unlock is enabled by the user. */
  biometricsEnabled: boolean;
  /** Whether this device has biometric hardware. */
  hasBiometrics: boolean;
  /** Whether biometric hardware is enrolled with credentials. */
  biometricsEnrolled: boolean;
  /** Verify PIN and unlock. Returns true on success. */
  unlock: (pin: string) => Promise<boolean>;
  /** Authenticate via biometrics and unlock. Returns true on success. */
  unlockWithBiometrics: () => Promise<boolean>;
  /** Turn on the lock with a new 6-digit PIN. */
  enableLock: (pin: string) => Promise<void>;
  /** Disable the lock (requires the current PIN for confirmation). Returns true on success. */
  disableLock: (currentPin: string) => Promise<boolean>;
  /** Change the PIN (requires the current PIN). Returns true on success. */
  changePIN: (currentPin: string, newPin: string) => Promise<boolean>;
  /** Toggle biometric unlock on/off. */
  setBiometricsEnabled: (enabled: boolean) => Promise<void>;
  /** Manually lock immediately (e.g. from a "Lock now" button). */
  lock: () => void;
};

// ─── Context ─────────────────────────────────────────────────────────────────
const AppLockContext = createContext<AppLockContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────
export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [biometricsEnabled, setBiometricsEnabledState] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [biometricsEnrolled, setBiometricsEnrolled] = useState(false);

  const backgroundedAt = useRef<number | null>(null);
  const appStateRef = useRef(AppState.currentState);

  // ── Load settings from SecureStore on mount ──────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      const [enabled, biometricsVal, hasHw, enrolled] = await Promise.all([
        SecureStore.getItemAsync(KEY_ENABLED),
        SecureStore.getItemAsync(KEY_BIOMETRICS),
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);

      if (!alive) return;

      const lockEnabled = enabled === 'true';
      setIsEnabled(lockEnabled);
      setBiometricsEnabledState(biometricsVal === 'true');
      setHasBiometrics(hasHw);
      setBiometricsEnrolled(enrolled);

      // Lock on cold start if feature is enabled
      setIsLocked(lockEnabled);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ── Re-lock when app comes back from background ───────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState.match(/inactive|background/)) {
        // Record when we backgrounded
        if (backgroundedAt.current === null) {
          backgroundedAt.current = Date.now();
        }
      } else if (nextState === 'active' && prev.match(/inactive|background/)) {
        // Coming back to foreground — check elapsed time
        if (isEnabled && backgroundedAt.current !== null) {
          const elapsed = Date.now() - backgroundedAt.current;
          if (elapsed >= BACKGROUND_LOCK_DELAY_MS) {
            setIsLocked(true);
          }
        }
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [isEnabled]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    const stored = await SecureStore.getItemAsync(KEY_PIN_HASH);
    if (!stored) return false;
    const hash = await hashPin(pin);
    if (hash === stored) {
      setIsLocked(false);
      return true;
    }
    return false;
  }, []);

  const unlockWithBiometrics = useCallback(async (): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Trackr',
        cancelLabel: 'Use PIN instead',
        disableDeviceFallback: false,
      });
      if (result.success) {
        setIsLocked(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const enableLock = useCallback(async (pin: string): Promise<void> => {
    const hash = await hashPin(pin);
    await SecureStore.setItemAsync(KEY_PIN_HASH, hash);
    await SecureStore.setItemAsync(KEY_ENABLED, 'true');
    setIsEnabled(true);
    // Don't lock immediately — user is already authenticated
    setIsLocked(false);
  }, []);

  const disableLock = useCallback(async (currentPin: string): Promise<boolean> => {
    const stored = await SecureStore.getItemAsync(KEY_PIN_HASH);
    if (!stored) return false;
    const hash = await hashPin(currentPin);
    if (hash !== stored) return false;
    await SecureStore.setItemAsync(KEY_ENABLED, 'false');
    await SecureStore.deleteItemAsync(KEY_PIN_HASH);
    setIsEnabled(false);
    setIsLocked(false);
    return true;
  }, []);

  const changePIN = useCallback(async (currentPin: string, newPin: string): Promise<boolean> => {
    const stored = await SecureStore.getItemAsync(KEY_PIN_HASH);
    if (!stored) return false;
    const currentHash = await hashPin(currentPin);
    if (currentHash !== stored) return false;
    const newHash = await hashPin(newPin);
    await SecureStore.setItemAsync(KEY_PIN_HASH, newHash);
    return true;
  }, []);

  const setBiometricsEnabled = useCallback(async (enabled: boolean): Promise<void> => {
    await SecureStore.setItemAsync(KEY_BIOMETRICS, enabled ? 'true' : 'false');
    setBiometricsEnabledState(enabled);
  }, []);

  const lock = useCallback(() => {
    if (isEnabled) setIsLocked(true);
  }, [isEnabled]);

  // ── Context value ─────────────────────────────────────────────────────────
  const value = useMemo<AppLockContextValue>(
    () => ({
      ready,
      isEnabled,
      isLocked,
      biometricsEnabled,
      hasBiometrics,
      biometricsEnrolled,
      unlock,
      unlockWithBiometrics,
      enableLock,
      disableLock,
      changePIN,
      setBiometricsEnabled,
      lock,
    }),
    [
      ready,
      isEnabled,
      isLocked,
      biometricsEnabled,
      hasBiometrics,
      biometricsEnrolled,
      unlock,
      unlockWithBiometrics,
      enableLock,
      disableLock,
      changePIN,
      setBiometricsEnabled,
      lock,
    ],
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAppLock(): AppLockContextValue {
  const ctx = useContext(AppLockContext);
  if (!ctx) {
    throw new Error('useAppLock must be used within AppLockProvider');
  }
  return ctx;
}