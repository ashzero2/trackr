export type TripMetadataShape = {
  dailyBudgetCents?: number;
};

export function parseTripMetadata(raw: string | null): TripMetadataShape {
  if (!raw?.trim()) return {};
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const dailyBudgetCents =
      typeof o.dailyBudgetCents === 'number' && Number.isFinite(o.dailyBudgetCents)
        ? Math.max(0, Math.round(o.dailyBudgetCents))
        : undefined;
    return { dailyBudgetCents };
  } catch {
    return {};
  }
}
