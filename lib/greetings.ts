/**
 * One short greeting per app session (until JS reload) so the header stays one line.
 */
const TEMPLATES = [
  'Hi, {name}',
  'Hey {name}',
  'Welcome, {name}',
  'Good day, {name}',
  'Hi there, {name}',
  'Hello, {name}',
  'Nice to see you, {name}',
  '{name}, welcome back',
] as const;

let sessionTemplateIndex: number | null = null;

export function greetingForSession(displayName: string): string {
  const name = displayName.trim() || 'there';
  if (sessionTemplateIndex === null) {
    sessionTemplateIndex = Math.floor(Math.random() * TEMPLATES.length);
  }
  return TEMPLATES[sessionTemplateIndex]!.replace(/\{name\}/g, name);
}

// ---------------------------------------------------------------------------
// Spending-context-aware greetings
// ---------------------------------------------------------------------------

export type SpendingContext = {
  /** Current month total expense in minor units (cents) */
  spentThisMonth: number;
  /** Sum of all category budget limits in minor units; 0 = no budgets */
  budgetTotalCents: number;
  /** Previous month total expense in minor units */
  lastMonthSpent: number;
};

/**
 * Returns a contextual greeting when spending data provides an interesting
 * story, otherwise falls back to the regular time-of-day greeting.
 *
 * Designed to stay ≤ ~40 chars so it fits the header on one line.
 */
export function contextualGreeting(
  displayName: string,
  ctx: SpendingContext | null,
): string {
  const name = displayName.trim() || 'there';

  if (ctx) {
    const { spentThisMonth, budgetTotalCents, lastMonthSpent } = ctx;

    // Under budget by a good margin
    if (budgetTotalCents > 0 && spentThisMonth > 0) {
      const pct = spentThisMonth / budgetTotalCents;
      if (pct <= 0.5) return `Under budget, ${name}! 🎉`;
      if (pct >= 1) return `Over budget — careful, ${name}`;
      if (pct >= 0.9) return `Budget's tight, ${name}`;
    }

    // Spending down vs. last month
    if (lastMonthSpent > 0 && spentThisMonth > 0) {
      const change = ((spentThisMonth - lastMonthSpent) / lastMonthSpent) * 100;
      if (change <= -20) return `Spending's down, ${name}! 💪`;
      if (change >= 40) return `Busy month, ${name}!`;
    }

    // Zero spending so far
    if (spentThisMonth === 0) return `Fresh start, ${name}!`;
  }

  // Fallback to session greeting
  return greetingForSession(displayName);
}
