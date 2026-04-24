import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CurrencyPickerField } from '@/components/currency-picker-field';
import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { bodyFont, headlineFont, labelFont } from '@/constants/typography';
import { useAppColors } from '@/contexts/color-scheme-context';
import { useDatabase } from '@/contexts/database-context';
import { useUserProfile } from '@/contexts/user-profile-context';
import { lightImpact } from '@/lib/haptics';

type Step = 0 | 1 | 2;

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useAppColors();
  const { completeOnboarding, onboardingComplete } = useUserProfile();
  const { ready, trips } = useDatabase();
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [busy, setBusy] = useState(false);
  const [firstTripName, setFirstTripName] = useState('');

  useEffect(() => {
    if (onboardingComplete) {
      router.replace('/(tabs)');
    }
  }, [onboardingComplete, router]);

  if (onboardingComplete) {
    return null;
  }

  const finish = async (opts: { travelModeEnabled: boolean; activeTripId: string | null }) => {
    const n = name.trim();
    if (!n) {
      Alert.alert('Name required', 'Please enter how we should greet you.');
      return;
    }
    setBusy(true);
    try {
      await completeOnboarding(n, currency, opts);
      lightImpact();
      router.replace('/(tabs)');
    } finally {
      setBusy(false);
    }
  };

  const onCreateFirstTripAndFinish = async () => {
    const tripName = firstTripName.trim();
    if (!tripName) {
      Alert.alert('Trip name', 'Enter a name or tap Skip to enable Travel mode without a trip yet.');
      return;
    }
    if (!ready || !trips) {
      Alert.alert('Please wait', 'Still preparing your data…');
      return;
    }
    setBusy(true);
    try {
      const id = await Crypto.randomUUID();
      const iso = new Date().toISOString();
      await trips.insert({
        id,
        name: tripName,
        startAt: iso,
        endAt: null,
        status: 'ACTIVE',
        metadata: null,
      });
      await finish({ travelModeEnabled: true, activeTripId: id });
    } catch (e) {
      Alert.alert('Could not create trip', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {step === 0 ? (
            <>
              <Text style={[styles.title, { color: colors.primary, fontFamily: headlineFont }]}>Welcome</Text>
              <Text style={[styles.sub, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
                Set your name and primary currency. Amounts are stored in this currency’s smallest units (e.g. cents or
                pence). Changing currency later only changes how numbers are shown—not converted.
              </Text>

              <Text style={[styles.lbl, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>Your name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Rahul"
                placeholderTextColor={colors.onSurfaceVariant}
                autoCapitalize="words"
                style={[
                  styles.input,
                  { color: colors.onSurface, backgroundColor: colors.surfaceContainerLowest, fontFamily: bodyFont },
                ]}
              />

              <Text style={[styles.lbl, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>
                Primary currency
              </Text>
              <CurrencyPickerField value={currency} onChange={setCurrency} colors={colors} />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Continue"
                disabled={busy}
                onPress={() => {
                  const n = name.trim();
                  if (!n) {
                    Alert.alert('Name required', 'Please enter how we should greet you.');
                    return;
                  }
                  setStep(1);
                }}
                style={[styles.cta, { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }]}>
                <Text style={{ color: colors.onPrimary, fontFamily: headlineFont, fontWeight: '700' }}>Continue</Text>
              </Pressable>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Text style={[styles.title, { color: colors.primary, fontFamily: headlineFont }]}>Travel</Text>
              <Text style={[styles.sub, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
                Do you travel often? We can turn on Travel mode so you get a clear “currently tracking” banner, trip
                history, and analytics—without hiding your everyday spending.
              </Text>
              <Pressable
                style={[styles.cta, { backgroundColor: colors.primary, marginTop: 16 }]}
                disabled={busy}
                onPress={() => setStep(2)}>
                <Text style={{ color: colors.onPrimary, fontFamily: headlineFont, fontWeight: '700' }}>Yes, often</Text>
              </Pressable>
              <Pressable
                style={[styles.ctaGhost, { borderColor: colors.outlineVariant, marginTop: 12 }]}
                disabled={busy}
                onPress={() => void finish({ travelModeEnabled: false, activeTripId: null })}>
                <Text style={{ color: colors.onSurface, fontFamily: headlineFont, fontWeight: '700' }}>Not really</Text>
              </Pressable>
              <Pressable onPress={() => setStep(0)} style={styles.back} disabled={busy}>
                <Text style={{ color: colors.primary, fontFamily: labelFont }}>Back</Text>
              </Pressable>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={[styles.title, { color: colors.primary, fontFamily: headlineFont }]}>First trip</Text>
              <Text style={[styles.sub, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
                Create an active trip now, or skip and set one up later in Settings.
              </Text>
              {!ready || !trips ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
              ) : (
                <>
                  <Text style={[styles.lbl, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>Trip name</Text>
                  <TextInput
                    value={firstTripName}
                    onChangeText={setFirstTripName}
                    placeholder="e.g. Tokyo spring"
                    placeholderTextColor={colors.onSurfaceVariant}
                    style={[
                      styles.input,
                      {
                        color: colors.onSurface,
                        backgroundColor: colors.surfaceContainerLowest,
                        fontFamily: bodyFont,
                      },
                    ]}
                  />
                  <Pressable
                    style={[styles.cta, { backgroundColor: colors.primary, marginTop: 16 }]}
                    disabled={busy}
                    onPress={() => void onCreateFirstTripAndFinish()}>
                    <Text style={{ color: colors.onPrimary, fontFamily: headlineFont, fontWeight: '700' }}>
                      Create trip & continue
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.ctaGhost, { borderColor: colors.outlineVariant, marginTop: 12 }]}
                    disabled={busy}
                    onPress={() => void finish({ travelModeEnabled: true, activeTripId: null })}>
                    <Text style={{ color: colors.onSurface, fontFamily: headlineFont, fontWeight: '700' }}>Skip for now</Text>
                  </Pressable>
                </>
              )}
              <Pressable onPress={() => setStep(1)} style={styles.back} disabled={busy}>
                <Text style={{ color: colors.primary, fontFamily: labelFont }}>Back</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
        {busy ? (
          <View style={[StyleSheet.absoluteFill, styles.busyOverlay]} pointerEvents="auto">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.busyLabel, { fontFamily: bodyFont }]}>
              Setting up your profile…
            </Text>
          </View>
        ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    padding: 24,
    paddingTop: 16,
    gap: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  lbl: {
    fontSize: 12,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    marginTop: 8,
  },
  cta: {
    marginTop: 32,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  ctaGhost: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1,
  },
  back: {
    marginTop: 20,
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  busyOverlay: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 24,
  },
  busyLabel: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    color: '#ffffff',
  },
});
