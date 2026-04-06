import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { labelFont } from '@/constants/typography';
import { useAppColors } from '@/contexts/color-scheme-context';
import { lightImpact } from '@/lib/haptics';

const TAB_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  index: 'dashboard',
  history: 'history',
  analytics: 'analytics',
  settings: 'settings',
};

export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppColors();

  return (
    <View
      style={[
        styles.outer,
        {
          backgroundColor: colors.chromeSurface,
          borderTopColor: colors.outlineVariant,
          /** Fill system gesture / nav inset so nothing shows through below the bar */
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}>
      <View style={styles.tabsRow}>
        {state.routes.map((route, routeIndex) => {
          const isFocused = state.index === routeIndex;
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? String(options.tabBarLabel)
              : options.title !== undefined
                ? options.title
                : route.name;
          const iconName = TAB_ICONS[route.name] ?? 'circle';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={label}
              onPressIn={lightImpact}
              onPress={onPress}
              style={[
                styles.tab,
                isFocused && { backgroundColor: colors.tabBarActiveBg },
              ]}>
              <MaterialIcons
                name={iconName}
                size={24}
                color={isFocused ? colors.tabBarActiveFg : colors.tabBarInactive}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    fontFamily: labelFont,
                    color: isFocused ? colors.tabBarActiveFg : colors.tabBarInactive,
                  },
                ]}
                numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
  },
  tabLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
