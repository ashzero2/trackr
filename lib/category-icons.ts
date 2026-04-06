import MaterialIcons from '@expo/vector-icons/MaterialIcons';

/**
 * Keys stored in DB `icon_key`. Each maps to a MaterialIcons glyph name to approximate Material Symbols from mocks.
 */
export const CATEGORY_ICON_KEYS = [
  'category',
  'restaurant',
  'local-cafe',
  'shopping-bag',
  'shopping-cart',
  'directions-car',
  'local-gas-station',
  'home',
  'subscriptions',
  'movie',
  'flight',
  'school',
  'local-hospital',
  'pets',
  'fitness-center',
  'bolt',
  'work',
  'attach-money',
  'card-giftcard',
  'account-balance-wallet',
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

const MAP: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  category: 'category',
  restaurant: 'restaurant',
  'local-cafe': 'local-cafe',
  'shopping-bag': 'shopping-bag',
  'shopping-cart': 'shopping-cart',
  'directions-car': 'directions-car',
  'local-gas-station': 'local-gas-station',
  home: 'home',
  subscriptions: 'subscriptions',
  movie: 'movie',
  flight: 'flight',
  school: 'school',
  'local-hospital': 'local-hospital',
  pets: 'pets',
  'fitness-center': 'fitness-center',
  bolt: 'bolt',
  work: 'work',
  'attach-money': 'attach-money',
  'card-giftcard': 'card-giftcard',
  'account-balance-wallet': 'account-balance-wallet',
};

export function materialIconNameForCategory(iconKey: string): keyof typeof MaterialIcons.glyphMap {
  return MAP[iconKey] ?? 'category';
}
