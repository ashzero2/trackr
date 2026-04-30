import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { fetchRandomPetAvatarUrl } from '@/lib/pet-avatar';

const PROFILE_KEY = '@trackr/profile';
const LEGACY_PROFILE_KEY = '@moneymanager/profile';

export type DashboardPrefValue = 'auto' | 'on' | 'off';

export type DashboardPrefs = {
  /** Show velocity projection row. Auto = after day 3 of month. */
  showVelocity: DashboardPrefValue;
  /** Show budget card in bento row. Auto = when ≥1 budget configured. */
  showBudget: DashboardPrefValue;
  /** Show insight card in bento row. Auto = when ≥5 recent transactions. */
  showInsight: DashboardPrefValue;
};

export const DEFAULT_DASHBOARD_PREFS: DashboardPrefs = {
  showVelocity: 'auto',
  showBudget: 'auto',
  showInsight: 'auto',
};

export type UserProfile = {
  displayName: string;
  currencyCode: string;
  onboardingComplete: boolean;
  /** Random dog/cat image URL assigned once (network). */
  petAvatarUrl: string | null;
  travelModeEnabled: boolean;
  /** Session default for new transactions when trip is ACTIVE */
  activeTripId: string | null;
  /** Dashboard section visibility preferences */
  dashboardPrefs: DashboardPrefs;
};

type UserProfileContextValue = {
  ready: boolean;
  profile: UserProfile | null;
  displayName: string;
  currencyCode: string;
  onboardingComplete: boolean;
  petAvatarUrl: string | null;
  travelModeEnabled: boolean;
  activeTripId: string | null;
  dashboardPrefs: DashboardPrefs;
  setProfile: (
    patch: Partial<
      Pick<UserProfile, 'displayName' | 'currencyCode' | 'petAvatarUrl' | 'travelModeEnabled' | 'activeTripId' | 'dashboardPrefs'>
    >,
  ) => Promise<void>;
  completeOnboarding: (
    displayName: string,
    currencyCode: string,
    opts?: { travelModeEnabled?: boolean; activeTripId?: string | null },
  ) => Promise<void>;
};

const defaultProfile = (): UserProfile => ({
  displayName: '',
  currencyCode: 'USD',
  onboardingComplete: false,
  petAvatarUrl: null,
  travelModeEnabled: false,
  activeTripId: null,
  dashboardPrefs: { ...DEFAULT_DASHBOARD_PREFS },
});

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

function parseProfile(raw: string | null): UserProfile | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<UserProfile>;
    if (typeof o.currencyCode !== 'string' || typeof o.onboardingComplete !== 'boolean') {
      return null;
    }
    // Parse dashboardPrefs with fallback to defaults for missing/invalid fields
    const rawPrefs = (o as any).dashboardPrefs;
    const parsePrefVal = (v: unknown): DashboardPrefValue =>
      v === 'auto' || v === 'on' || v === 'off' ? v : 'auto';
    const dashboardPrefs: DashboardPrefs = rawPrefs && typeof rawPrefs === 'object'
      ? {
          showVelocity: parsePrefVal((rawPrefs as any).showVelocity),
          showBudget: parsePrefVal((rawPrefs as any).showBudget),
          showInsight: parsePrefVal((rawPrefs as any).showInsight),
        }
      : { ...DEFAULT_DASHBOARD_PREFS };

    return {
      displayName: typeof o.displayName === 'string' ? o.displayName : '',
      currencyCode: o.currencyCode,
      onboardingComplete: o.onboardingComplete,
      petAvatarUrl: typeof o.petAvatarUrl === 'string' && o.petAvatarUrl.length > 0 ? o.petAvatarUrl : null,
      travelModeEnabled: typeof o.travelModeEnabled === 'boolean' ? o.travelModeEnabled : false,
      activeTripId: typeof o.activeTripId === 'string' && o.activeTripId.length > 0 ? o.activeTripId : null,
      dashboardPrefs,
    };
  } catch {
    return null;
  }
}

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const petBackfillDone = useRef(false);

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
    async (
      patch: Partial<
        Pick<UserProfile, 'displayName' | 'currencyCode' | 'petAvatarUrl' | 'travelModeEnabled' | 'activeTripId' | 'dashboardPrefs'>
      >,
    ) => {
      const base = profile ?? defaultProfile();
      await persist({
        ...base,
        ...patch,
        displayName: patch.displayName !== undefined ? patch.displayName.trim() : base.displayName,
        currencyCode: patch.currencyCode !== undefined ? patch.currencyCode : base.currencyCode,
        petAvatarUrl: patch.petAvatarUrl !== undefined ? patch.petAvatarUrl : base.petAvatarUrl,
        travelModeEnabled: patch.travelModeEnabled !== undefined ? patch.travelModeEnabled : base.travelModeEnabled,
        activeTripId: patch.activeTripId !== undefined ? patch.activeTripId : base.activeTripId,
        dashboardPrefs: patch.dashboardPrefs !== undefined ? patch.dashboardPrefs : base.dashboardPrefs,
      });
    },
    [profile, persist],
  );

  const completeOnboarding = useCallback(
    async (
      displayName: string,
      currencyCode: string,
      opts?: { travelModeEnabled?: boolean; activeTripId?: string | null },
    ) => {
      const petAvatarUrl = await fetchRandomPetAvatarUrl();
      await persist({
        displayName: displayName.trim(),
        currencyCode,
        onboardingComplete: true,
        petAvatarUrl,
        travelModeEnabled: opts?.travelModeEnabled ?? false,
        activeTripId: opts?.activeTripId ?? null,
        dashboardPrefs: { ...DEFAULT_DASHBOARD_PREFS },
      });
    },
    [persist],
  );

  /** Existing installs: assign a pet avatar once if missing. */
  useEffect(() => {
    if (!ready || !profile?.onboardingComplete || profile.petAvatarUrl || petBackfillDone.current) return;
    let cancelled = false;
    (async () => {
      const url = await fetchRandomPetAvatarUrl();
      if (cancelled || !url) return;
      petBackfillDone.current = true;
      await setProfile({ petAvatarUrl: url });
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, profile?.onboardingComplete, profile?.petAvatarUrl, setProfile]);

  const value = useMemo<UserProfileContextValue>(() => {
    const p = profile ?? defaultProfile();
    return {
      ready,
      profile,
      displayName: p.displayName,
      currencyCode: p.currencyCode,
      onboardingComplete: p.onboardingComplete,
      petAvatarUrl: p.petAvatarUrl,
      travelModeEnabled: p.travelModeEnabled,
      activeTripId: p.activeTripId,
      dashboardPrefs: p.dashboardPrefs,
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
