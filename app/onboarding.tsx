import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
import { useUserProfile } from '@/contexts/user-profile-context';
import { lightImpact } from '@/lib/haptics';

const INTRO_SLIDES = [
  {
    icon: 'receipt-long' as const,
    title: 'Track every expense',
    subtitle: 'Log cash, card, and foreign-currency transactions in seconds.',
  },
  {
    icon: 'account-balance-wallet' as const,
    title: 'Set budgets, stay on track',
    subtitle: 'Get alerts when you approach your monthly category limits.',
  },
  {
    icon: 'smart-toy' as const,
    title: 'Ask ExBot anything',
    subtitle: 'Your AI spending assistant answers questions about your own data instantly.',
  },
  {
    icon: 'luggage' as const,
    title: 'Trip Mode',
    subtitle:
      'Going on a trip? Enable Trip Mode from Settings to track spending per trip, see per-trip analytics, and log foreign-currency expenses with ease.',
  },
] as const;

const TOTAL_INTRO = INTRO_SLIDES.length; // 4

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useAppColors();
  const { completeOnboarding, onboardingComplete } = useUserProfile();
  const [introStep, setIntroStep] = useState<number>(0);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [busy, setBusy] = useState(false);

  const showForm = introStep >= TOTAL_INTRO;

  useEffect(() => {
    if (onboardingComplete) {
      router.replace('/(tabs)');
    }
  }, [onboardingComplete, router]);

  if (onboardingComplete) {
    return null;
  }

  const finish = async () => {
    const n = name.trim();
    if (!n) {
      Alert.alert('Name required', 'Please enter how we should greet you.');
      return;
    }
    setBusy(true);
    try {
      await completeOnboarding(n, currency, { travelModeEnabled: false, activeTripId: null });
      lightImpact();
      router.replace('/(tabs)');
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
            {/* ── Intro pager (slides 0–3) ─────────────────────────────── */}
            {!showForm ? (() => {
              const slide = INTRO_SLIDES[introStep];
              return (
                <>
                  <View style={styles.introIllustration}>
                    <View style={[styles.introIconCircle, { backgroundColor: colors.primaryContainer }]}>
                      <MaterialIcons name={slide.icon} size={64} color={colors.primary} />
                    </View>
                  </View>

                  <Text style={[styles.title, { color: colors.primary, fontFamily: headlineFont }]}>
                    {slide.title}
                  </Text>
                  <Text style={[styles.sub, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
                    {slide.subtitle}
                  </Text>

                  <View style={styles.dots}>
                    {INTRO_SLIDES.map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          {
                            backgroundColor: i === introStep ? colors.primary : colors.surfaceContainerHighest,
                            width: i === introStep ? 20 : 8,
                          },
                        ]}
                      />
                    ))}
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={introStep < TOTAL_INTRO - 1 ? 'Next' : 'Get started'}
                    disabled={busy}
                    onPress={() => setIntroStep((s) => s + 1)}
                    style={[styles.cta, { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }]}>
                    <Text style={{ color: colors.onPrimary, fontFamily: headlineFont, fontWeight: '700' }}>
                      {introStep < TOTAL_INTRO - 1 ? 'Next' : 'Get started'}
                    </Text>
                  </Pressable>

                  <View style={styles.introFooter}>
                    {introStep > 0 ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Previous slide"
                        disabled={busy}
                        onPress={() => setIntroStep((s) => Math.max(s - 1, 0))}
                        style={styles.back}>
                        <Text style={{ color: colors.primary, fontFamily: labelFont }}>Back</Text>
                      </Pressable>
                    ) : (
                      <View />
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Skip introduction"
                      disabled={busy}
                      onPress={() => setIntroStep(TOTAL_INTRO)}
                      style={styles.back}>
                      <Text style={{ color: colors.onSurfaceVariant, fontFamily: labelFont }}>Skip intro</Text>
                    </Pressable>
                  </View>
                </>
              );
            })() : null}

            {/* ── Form: Name + Currency ─────────────────────────────────── */}
            {showForm ? (
              <>
                <Text style={[styles.title, { color: colors.primary, fontFamily: headlineFont }]}>Welcome</Text>
                <Text style={[styles.sub, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
                  Set your name and primary currency. Amounts are stored in this currency's smallest units (e.g. cents
                  or pence). Changing currency later only changes how numbers are shown—not converted.
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
                  accessibilityLabel="Finish setup"
                  disabled={busy}
                  onPress={() => void finish()}
                  style={[styles.cta, { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }]}>
                  <Text style={{ color: colors.onPrimary, fontFamily: headlineFont, fontWeight: '700' }}>
                    Let's go!
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setIntroStep(TOTAL_INTRO - 1)}
                  style={styles.back}
                  disabled={busy}>
                  <Text style={{ color: colors.primary, fontFamily: labelFont }}>Back to intro</Text>
                </Pressable>
              </>
            ) : null}
          </ScrollView>
          {busy ? (
            <View style={[StyleSheet.absoluteFill, styles.busyOverlay]} pointerEvents="auto">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.busyLabel, { fontFamily: bodyFont }]}>Setting up your profile…</Text>
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
  introIllustration: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 32,
    paddingBottom: 24,
  },
  introIconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
    marginBottom: 4,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  introFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
});
