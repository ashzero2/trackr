import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { useAppColors } from '@/contexts/color-scheme-context';
import { bodyFont, headlineFont } from '@/constants/typography';

const TAB_BAR_EXTRA = 96;

type ScreenScaffoldProps = {
  children: React.ReactNode;
  /** Optional subtitle under header area (e.g. screen-specific) */
  subtitle?: string;
  /** Extra bottom padding (e.g. FAB above tab bar) */
  contentBottomExtra?: number;
  /** Floating overlay (e.g. gradient FAB); position absolute inside main area */
  fab?: React.ReactNode;
};

export function ScreenScaffold({ children, subtitle, contentBottomExtra = 0, fab }: ScreenScaffoldProps) {
  const { colors } = useAppColors();
  const bottomPad = TAB_BAR_EXTRA + contentBottomExtra;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={['top']}>
      <AppHeader />
      {subtitle ? (
        <View style={styles.subtitleWrap}>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
            {subtitle}
          </Text>
        </View>
      ) : null}
      <View style={styles.main}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
        {fab}
      </View>
    </SafeAreaView>
  );
}

type PlaceholderSectionProps = {
  title: string;
  body: string;
};

export function PlaceholderSection({ title, body }: PlaceholderSectionProps) {
  const { colors } = useAppColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow }]}>
      <Text style={[styles.cardTitle, { color: colors.primary, fontFamily: headlineFont }]}>
        {title}
      </Text>
      <Text style={[styles.cardBody, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  main: {
    flex: 1,
    position: 'relative',
  },
  subtitleWrap: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  subtitle: {
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 16,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 22,
  },
});
