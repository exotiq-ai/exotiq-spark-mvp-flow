// Tenant-aware money formatter hook.
//
// Reads currency + locale from TeamContext and returns a bound `money(value)`
// function. Components migrate from `formatCurrency(x)` → `money(x)`.
//
// During Phase 1, components that haven't migrated keep calling the
// `formatCurrency` USD shim in `src/lib/utils.ts` — output for US tenants is
// byte-identical, so no regression risk.

import { useCallback, useMemo } from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { formatMoney, type MoneyFormatOptions } from '@/lib/format';

export function useMoney() {
  const { currentTeam } = useTeam();

  const currency = currentTeam?.currency || 'USD';
  const locale = currentTeam?.locale || 'en-US';
  const taxLabel = currentTeam?.tax_label || 'Tax';
  const taxRatePercent = Number(currentTeam?.tax_rate_percent || 0);
  const taxInclusive = !!currentTeam?.tax_inclusive;

  const money = useCallback(
    (value: number | string | null | undefined, opts: MoneyFormatOptions = {}) =>
      formatMoney(value, { currency, locale, ...opts }),
    [currency, locale],
  );

  return useMemo(
    () => ({
      money,
      currency,
      locale,
      taxLabel,
      taxRatePercent,
      taxInclusive,
      hasTax: taxRatePercent > 0,
    }),
    [money, currency, locale, taxLabel, taxRatePercent, taxInclusive],
  );
}
