import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';

import { useAppColors } from '@/contexts/color-scheme-context';
import { labelFont } from '@/constants/typography';
import { MIN_TOUCH_TARGET } from '@/constants/accessibility';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SettingsSectionProps = {
  title: string;
  /** MaterialIcons icon name for the section header. */
  icon?: keyof typeof MaterialIcons.glyphMap;
  /** Whether the section starts expanded. Default true. */
  defaultExpanded?: boolean;
  children: React.ReactNode;
};

/**
 * A collapsible section for the Settings screen.
 * Tapping the header toggles the children visibility with a layout animation.
 * Sections start expanded by default for better discoverability.
 */
export function SettingsSection({
  title,
  icon,
  defaultExpanded = true,
  children,
}: SettingsSectionProps) {
  const { colors } = useAppColors();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title} section, ${expanded ? 'expanded' : 'collapsed'}`}
        onPress={toggle}
        style={styles.header}>
        <View style={styles.headerLeft}>
          {icon ? (
            <MaterialIcons name={icon} size={16} color={colors.onSurfaceVariant} />
          ) : null}
          <Text style={[styles.title, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>
            {title}
          </Text>
        </View>
        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={20}
          color={colors.onSurfaceVariant}
        />
      </Pressable>
      {expanded ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 22,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  content: {
    gap: 0,
  },
});