import { useCallback, useMemo } from 'react';

import { useUserProfile } from '@/contexts/user-profile-context';
import { formatMoneyFromMinor } from '@/lib/format-money';

export function useFormatMoney() {
  const { currencyCode } = useUserProfile();

  const format = useCallback(
    (minorUnits: number) => formatMoneyFromMinor(minorUnits, currencyCode),
    [currencyCode],
  );

  return useMemo(() => ({ format, currencyCode }), [format, currencyCode]);
}
