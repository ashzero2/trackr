import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';

import { lightImpact } from '@/lib/haptics';

/** Default tab bar button; custom `AppTabBar` uses the same feedback via `lightImpact`. */
export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        lightImpact();
        props.onPressIn?.(ev);
      }}
    />
  );
}
