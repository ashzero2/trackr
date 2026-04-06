import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const PROFILE_KEY = '@trackr/profile';
const LEGACY_PROFILE_KEY = '@moneymanager/profile';

export type UserProfile = {
  displayName: string;
  currencyCode: string;
  onboardingComplete: boolean;
};

type UserProfileContextValue = {
  ready: boolean;
  profile: UserProfile | null;
  displayName: string;
  currencyCode: string;
  onboardingComplete: boolean;
  setProfile: (patch: Partial<Pick<UserProfile, 'displayName' | 'currencyCode'>>) => Promise<void>;
  completeOnboarding: (displayName: string, currencyCode: string) => Promise<void>;
};

const defaultProfile = (): UserProfile => ({
  displayName: '',
  currencyCode: 'USD',
  onboardingComplete: false,
});

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

function parseProfile(raw: string | null): UserProfile | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<UserProfile>;
    if (typeof o.currencyCode !== 'string' || typeof o.onboardingComplete !== 'boolean') {
      return null;
    }
    return {
      displayName: typeof o.displayName === 'string' ? o.displayName : '',
      currencyCode: o.currencyCode,
      onboardingComplete: o.onboardingComplete,
    };
  } catch {
    return null;
  }
}

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState<UserProfile | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let raw = await AsyncStorage.getItem(PROFILE_KEY);
      if (!raw) {
        raw = await AsyncStorage.getItem(LEGACY_PROFILE_KEY);
        if (raw) {
          await AsyncStorage.setItem(PROFILE_KEY, raw);
          await AsyncStorage.removeItem(LEGACY_PROFILE_KEY);
        }
      }
      const parsed = parseProfile(raw);
      if (!alive) return;
      setProfileState(parsed ?? defaultProfile());
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const persist = useCallback(async (next: UserProfile) => {
    setProfileState(next);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  }, []);

  const setProfile = useCallback(
    async (patch: Partial<Pick<UserProfile, 'displayName' | 'currencyCode'>>) => {
      const base = profile ?? defaultProfile();
      await persist({
        ...base,
        ...patch,
        displayName: patch.displayName !== undefined ? patch.displayName.trim() : base.displayName,
        currencyCode: patch.currencyCode !== undefined ? patch.currencyCode : base.currencyCode,
      });
    },
    [profile, persist],
  );

  const completeOnboarding = useCallback(
    async (displayName: string, currencyCode: string) => {
      await persist({
        displayName: displayName.trim(),
        currencyCode,
        onboardingComplete: true,
      });
    },
    [persist],
  );

  const value = useMemo<UserProfileContextValue>(() => {
    const p = profile ?? defaultProfile();
    return {
      ready,
      profile,
      displayName: p.displayName,
      currencyCode: p.currencyCode,
      onboardingComplete: p.onboardingComplete,
      setProfile,
      completeOnboarding,
    };
  }, [ready, profile, setProfile, completeOnboarding]);

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}

export function useUserProfile(): UserProfileContextValue {
  const ctx = useContext(UserProfileContext);
  if (!ctx) {
    throw new Error('useUserProfile must be used within UserProfileProvider');
  }
  return ctx;
}
