import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CurrencyPickerField } from '@/components/currency-picker-field';
import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { bodyFont, headlineFont, labelFont } from '@/constants/typography';
import { useAppColors } from '@/contexts/color-scheme-context';
import { useUserProfile } from '@/contexts/user-profile-context';
import { lightImpact } from '@/lib/haptics';

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useAppColors();
  const { completeOnboarding, onboardingComplete } = useUserProfile();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (onboardingComplete) {
      router.replace('/(tabs)');
    }
  }, [onboardingComplete, router]);

  if (onboardingComplete) {
    return null;
  }

  const onContinue = async () => {
    const n = name.trim();
    if (!n) {
      Alert.alert('Name required', 'Please enter how we should greet you.');
      return;
    }
    setBusy(true);
    try {
      await completeOnboarding(n, currency);
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
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, { color: colors.primary, fontFamily: headlineFont }]}>
            Welcome
          </Text>
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
            accessibilityLabel="Continue to app"
            disabled={busy}
            onPress={onContinue}
            style={[
              styles.cta,
              { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 },
            ]}>
            <Text style={{ color: colors.onPrimary, fontFamily: headlineFont, fontWeight: '700' }}>Continue</Text>
          </Pressable>
        </ScrollView>
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
});
