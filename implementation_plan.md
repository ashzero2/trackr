# Implementation Plan — MoneyManager UI/UX Fixes & Improvements

[Overview]
Implement all issues, bugs, and improvements identified in the UI/UX review (`docs/ui-ux-review.md`), organized into 3 phases (P0, P1, P2) totaling 24 work items across bug fixes, accessibility improvements, performance optimization, security hardening, and feature additions.

This plan addresses 4 critical bugs, 6 medium bugs, 3 low bugs, 9 accessibility gaps, 5 performance issues, 4 security concerns, and 12 feature improvements. The implementation is ordered to minimize merge conflicts and maximize incremental stability — data layer changes first, then component fixes, then screen-level features.

> **NOTE (April 30, 2026):** During implementation, P0 Steps 1–3 were found to already be implemented in the codebase:
> - Step 1 (Pagination): `listByMonthWithoutTripPaginated()`, PAGE_SIZE=50, "Load more" button already exist in history.tsx
> - Step 2 (App Lock): `ready` state, `AppLockGate` null gate, SHA-256 PIN hashing already exist
> - Step 3 (Validation): Amount > 0, FX rate > 0, `resolveCalculator()`, category required, CSV zero/NaN filtering already exist
> - Step 4 (Accessibility): Most labels already exist; added `accessibilityHint` to swipeable transaction rows

[Types]
New and modified type definitions required across the implementation.

### New Types

**`types/finance.ts`** — Add:
```ts
// For paginated query results
export type PaginatedResult<T> = {
  data: T[];
  hasMore: boolean;
  nextOffset: number;
};

// For history filters
export type TransactionFilter = {
  categoryIds?: string[];
  types?: EntryType[];
  paymentMethods?: PaymentMethod[];
  amountMin?: number;  // cents
  amountMax?: number;  // cents
  query?: string;
};

```

**`lib/ai-agent.ts`** — Add return type:
```ts
export type ChatTurnResult = {
  reply: string;
  proposedRows: ParsedImportRow[];
  truncated: boolean;  // NEW: true if hit iteration limit
};
```

### Modified Types

**`types/finance.ts`** — Extend `Budget`:
```ts
// Add optional 'global' flag for overall budget
export type Budget = {
  // ...existing fields...
  isGlobal?: boolean;  // true = total monthly limit, not per-category
};
```

[Files]
Files to be created, modified, or reorganized.

### New Files
| File Path | Purpose |
|-----------|---------|
| `hooks/use-reduced-motion.ts` | Hook wrapping `AccessibilityInfo.isReduceMotionEnabled` |
| `hooks/use-query-cancellation.ts` | Hook providing abort-controller pattern for async SQLite queries |
| `components/screen-error-boundary.tsx` | Per-screen error boundary component |
| `components/dashboard-hero-card.tsx` | Extracted from `app/(tabs)/index.tsx` |
| `components/bento-cards.tsx` | Extracted from `app/(tabs)/index.tsx` |
| `components/category-breakdown-modal.tsx` | Extracted from `app/(tabs)/analytics.tsx` |
| `components/budget-limit-modal.tsx` | Extracted from `app/manage-budgets.tsx` |
| `components/pie-chart-svg.tsx` | Donut/pie chart for category breakdown |
| `lib/pin-hash.ts` | PIN hashing with salt using `expo-crypto` |

### Modified Files (by phase)

**P0 (Critical):**
- `data/transaction-repository.ts` — Add `listPaginated()` method with LIMIT/OFFSET and filter support
- `app/(tabs)/history.tsx` — Implement infinite scroll with `onEndReached`, use `listPaginated()`
- `contexts/app-lock-context.tsx` — Fix cold-start flash: render opaque view until lock state resolves
- `app/_layout.tsx` — Update `AppLockGate` to block rendering until lock state is determined
- `components/number-pad.tsx` — Add `accessibilityLabel` to all buttons
- `components/fab-gradient.tsx` — Add `accessibilityLabel="Add transaction"` and `accessibilityRole="button"`
- `components/app-header.tsx` — Add `accessibilityLabel` to dark mode toggle
- `components/swipeable-transaction-row.tsx` — Add `accessibilityHint` for swipe actions
- `app/add-transaction.tsx` — Validate amount > 0, validate FX rate > 0, resolve pending calc operator on save
- `lib/import-csv.ts` — Filter out rows with `amountCents === 0` or `NaN`

**P1 (Next Sprint):**
- `components/currency-picker-field.tsx` — Add search/filter TextInput
- `app/(tabs)/index.tsx` — Use query cancellation hook, replace ActivityIndicator with SkeletonCard
- `app/(tabs)/analytics.tsx` — Use query cancellation hook
- `components/swipeable-transaction-row.tsx` — Auto-close other rows via shared ref
- `components/chart-tooltip.tsx` — Add bounds checking for screen width
- `lib/budget-alert.ts` — Fix timezone mismatch in weekly budget calculation
- `lib/pin-hash.ts` — (new) SHA-256 hash with random salt
- `contexts/app-lock-context.tsx` — Use hashed PIN comparison
- `app/setup-app-lock.tsx` — Use hashed PIN on save
- `app/(tabs)/history.tsx` — Add category/type/payment filter chips UI
- `db/backup.ts` — Add JSON full-backup export and restore-from-JSON
- `app/(tabs)/settings.tsx` — Add backup/restore buttons, add re-auth for sensitive actions
- All components with `Pressable` — Add `accessibilityRole="button"` and `accessibilityHint`
- `components/spending-trend-chart-svg.tsx` — Add `accessible` prop with summary text

**P2 (Future):**
- `app/(tabs)/analytics.tsx` — Add income analytics toggle, add pie chart
- `app/manage-budgets.tsx` — Add global budget support
- `lib/ai-agent.ts` — Return `truncated` flag, add user-facing message
- `lib/ai-settings.ts` — Add API key validation on save
- `app/(tabs)/index.tsx` — Add upcoming recurrences section
- `lib/haptics.ts` — Check reduced-motion before firing
- `app/manage-trips.tsx` — Auto-complete trips past end date
- `components/error-boundary.tsx` — Make reusable per-screen
- `app/(tabs)/analytics.tsx` — Extract `CategoryBreakdownModal`
- `app/manage-budgets.tsx` — Extract `BudgetLimitModal`
- `app/(tabs)/index.tsx` — Extract `DashboardHeroCard`, `BentoCards`

[Functions]
Detailed function-level changes.

### New Functions

| Function | File | Signature | Purpose |
|----------|------|-----------|---------|
| `listPaginated` | `data/transaction-repository.ts` | `(year: number, month: number, offset: number, limit: number, filter?: TransactionFilter) => Promise<PaginatedResult<TransactionWithCategory>>` | Paginated transaction query with optional filters |
| `listFiltered` | `data/transaction-repository.ts` | `(filter: TransactionFilter, offset: number, limit: number) => Promise<PaginatedResult<TransactionWithCategory>>` | Filtered query across all time |
| `useReducedMotion` | `hooks/use-reduced-motion.ts` | `() => boolean` | Returns true if system reduce-motion is enabled |
| `useQueryCancellation` | `hooks/use-query-cancellation.ts` | `() => { token: AbortToken, cancel: () => void }` | Provides cancellation token for async queries |
| `hashPin` | `lib/pin-hash.ts` | `(pin: string, salt: string) => Promise<string>` | SHA-256 hash PIN with salt |
| `generateSalt` | `lib/pin-hash.ts` | `() => string` | Generate random salt via `expo-crypto` |
| `verifyPin` | `lib/pin-hash.ts` | `(pin: string, salt: string, hash: string) => Promise<boolean>` | Compare PIN against stored hash |
| `validateApiKey` | `lib/ai-settings.ts` | `(key: string, modelId?: string) => Promise<{ valid: boolean; error?: string }>` | Test Gemini API key with a minimal request |
| `clampTooltipLeft` | `components/chart-tooltip.tsx` | `(barCenterX: number, tooltipWidth: number, screenWidth: number) => number` | Clamp tooltip X position within screen bounds |
| `resolveCalcOperator` | `app/add-transaction.tsx` (inline) | `(display: string, pendingOp: string \| null, pendingValue: number) => number` | Resolve any pending +/− operator before save |

### Modified Functions

| Function | File | Change |
|----------|------|--------|
| `tryParseBankOrWalletCsv` | `lib/import-csv.ts` | Add `.filter(row => row.amountCents !== 0 && !isNaN(row.amountCents))` before return |
| `checkBudgetAlerts` | `lib/budget-alert.ts` | Use `localDayKey()` for Monday calculation instead of `new Date()` to fix timezone mismatch |
| `runGeminiChatTurn` | `lib/ai-agent.ts` | Return `{ reply, proposedRows, truncated: iteration >= MAX_ITERATIONS }` instead of just string+rows |
| `lightImpact` / `mediumImpact` | `lib/haptics.ts` | Check `useReducedMotion()` or `AccessibilityInfo.isReduceMotionEnabled` before firing |
| `greetingForSession` | `components/app-header.tsx` | Recalculate on `useFocusEffect` instead of once on mount |
| `save` (in add-transaction) | `app/add-transaction.tsx` | Call `resolveCalcOperator()` before saving; validate `amountCents > 0`; validate `fxRate > 0` when in travel mode |

[Classes]
No new classes are introduced. The codebase uses functional components and plain objects/functions.

### Modified Patterns
- `TransactionRepository` — Add 2 new methods (`listPaginated`, `listFiltered`)
- `AppLockProvider` — Modify to expose `isReady` boolean alongside `isLocked`

[Dependencies]
No new npm packages required. All changes use existing dependencies.

| Dependency | Status | Notes |
|------------|--------|-------|
| `expo-crypto` | Already installed | Used for PIN hashing (SHA-256) |
| `expo-secure-store` | Already installed | Already stores PIN and API key |
| `react-native` AccessibilityInfo | Built-in | For reduced-motion detection |
| `expo-sqlite` | Already installed | Core data storage |
| No new packages needed | — | All features implementable with current deps |

[Testing]
Testing approach for each phase.

### P0 Tests
- **Unit**: Add test for `resolveCalcOperator()` — edge cases like "100+50−", "0", negative values
- **Unit**: Add test for `tryParseBankOrWalletCsv` — verify rows with `amountCents === 0` and `NaN` are filtered out
- **Unit**: Verify `listPaginated()` returns correct `hasMore` flag at page boundaries
- **Manual**: Verify App Lock no longer flashes content on cold start (test on physical device)
- **Manual**: Verify VoiceOver reads all icon-only buttons correctly

### P1 Tests
- **Unit**: `hashPin` / `verifyPin` — round-trip test, wrong PIN returns false
- **Unit**: `clampTooltipLeft` — edge cases at x=0, x=screenWidth
- **Unit**: `checkBudgetAlerts` — weekly calculation near midnight in various timezones
- **Manual**: Currency picker search filters correctly, handles empty results
- **Manual**: Swipe one row, swipe another — first auto-closes
- **Manual**: Backup export creates valid JSON, restore recreates all data

### P2 Tests
- **Unit**: `validateApiKey` — valid key returns true, invalid returns error message
- **Manual**: Income analytics toggle shows income chart data
- **Manual**: Pie chart renders with correct percentages
- **Manual**: Upcoming recurrences section shows correct items on dashboard

### Existing Tests to Update
- `__tests__/lib/format-money.test.ts` — No changes needed
- `__tests__/lib/dates.test.ts` — No changes needed
- `__tests__/lib/analytics-buckets.test.ts` — No changes needed
- `__tests__/lib/recurrence-engine.test.ts` — No changes needed

[Implementation Order]
Phased implementation sequence to minimize conflicts and ensure stability.

### Phase 0 — Critical Fixes (P0) — Estimated: 3-4 days

**Step 1: Data Layer — Pagination Support**
1. Add `PaginatedResult` and `TransactionFilter` types to `types/finance.ts`
2. Add `listPaginated()` method to `data/transaction-repository.ts`:
   - SQL: `SELECT ... WHERE year=? AND month=? {filter clauses} ORDER BY date DESC LIMIT ? OFFSET ?`
   - Return `{ data, hasMore: data.length === limit, nextOffset: offset + data.length }`
3. Update `app/(tabs)/history.tsx`:
   - Replace single load-all with paginated `onEndReached` pattern
   - Track `offset` state, append new pages to existing data
   - Show "Loading more..." indicator at list bottom
   - Already has PAGE_SIZE=50 — use it with the new `listPaginated()`

**Step 2: App Lock Cold-Start Fix**
4. Modify `contexts/app-lock-context.tsx`:
   - Add `isReady: boolean` state (default `false`)
   - Set `isReady = true` only after SecureStore read completes
   - Export `isReady` from context
5. Modify `app/_layout.tsx` `AppLockGate`:
   - If `!isReady`, render a full-screen opaque `<View>` matching splash screen background color
   - Only render children or lock screen once `isReady === true`

**Step 3: Input Validation Fixes**
6. Modify `app/add-transaction.tsx`:
   - Add `resolveCalcOperator()` function — applies pending +/− before save
   - In `save()`: call `resolveCalcOperator()` first, then validate `amountCents > 0` (show Alert if 0)
   - In `save()`: when travel mode, validate `fxRate > 0` (show Alert if invalid)
   - Show visual indicator (pulsing dot or text) when a calc operator is pending
7. Modify `lib/import-csv.ts`:
   - In `tryParseBankOrWalletCsv`, before final return, add: `rows = rows.filter(r => r.amountCents > 0 && Number.isFinite(r.amountCents))`

**Step 4: Accessibility Labels (P0)**
8. Modify `components/number-pad.tsx`:
   - Add `accessibilityLabel={digit}` to each digit button
   - Add `accessibilityLabel="Decimal point"` to `.` button
   - Add `accessibilityLabel="Backspace"` to backspace button
   - Add `accessibilityLabel={action.label}` to side action buttons
   - Add `accessibilityRole="button"` to all Pressables
9. Modify `components/fab-gradient.tsx`:
   - Add `accessibilityLabel="Add new transaction"` and `accessibilityRole="button"` to the FAB Pressable
10. Modify `components/app-header.tsx`:
    - Add `accessibilityLabel="Toggle dark mode"` and `accessibilityRole="button"` to theme toggle
11. Modify `components/swipeable-transaction-row.tsx`:
    - Add `accessibilityHint="Swipe left to delete, swipe right to edit"` to the row
    - Add `accessibilityActions` for edit, duplicate, delete

**Step 5: Write P0 Tests**
12. Add `__tests__/lib/import-csv-validation.test.ts` — test NaN/zero filtering
13. Add `__tests__/app/calc-operator.test.ts` — test resolveCalcOperator

---

### Phase 1 — Next Sprint (P1) — Estimated: 5-7 days

**Step 6: Currency Picker Search**
14. Modify `components/currency-picker-field.tsx`:
    - Add `TextInput` at top of modal with search icon
    - Filter currency list by code or name matching search query
    - Show "No results" empty state when filter returns empty

**Step 7: Query Cancellation**
15. Create `hooks/use-query-cancellation.ts`:
    - Returns `{ version: number, isCurrent: (v: number) => boolean, bump: () => number }`
    - Each query captures version at start; before setting state, checks `isCurrent(capturedVersion)`
16. Apply to `app/(tabs)/index.tsx` — wrap load() calls with version check
17. Apply to `app/(tabs)/analytics.tsx` — same pattern

**Step 8: Swipeable Row Auto-Close**
18. Modify `components/swipeable-transaction-row.tsx`:
    - Accept `openRowRef?: React.MutableRefObject<Swipeable | null>` prop
    - On swipe open: close previous ref, set self as current
    - Pass shared ref from parent lists (History, Dashboard, TripDetail)

**Step 9: Chart Tooltip Bounds**
19. Modify `components/chart-tooltip.tsx`:
    - Use `Dimensions.get('window').width` to get screen width
    - Add `clampTooltipLeft()` — ensure tooltip stays within 8px padding from edges
    - Apply clamped position in style

**Step 10: Budget Alert Timezone Fix**
20. Modify `lib/budget-alert.ts`:
    - Replace `new Date()` Monday calculation with `localDayKey()`-based calculation
    - Ensure weekly window start/end use local timezone consistently

**Step 11: PIN Hashing**
21. Create `lib/pin-hash.ts`:
    - `generateSalt()`: use `expo-crypto.getRandomBytes(16)`, hex-encode
    - `hashPin(pin, salt)`: SHA-256 of `salt + pin` via `expo-crypto.digestStringAsync`
    - `verifyPin(pin, salt, hash)`: hash and compare
22. Modify `contexts/app-lock-context.tsx`:
    - On PIN setup: generate salt, hash PIN, store both in SecureStore
    - On PIN verify: read salt+hash from SecureStore, use `verifyPin()`
    - Migration: if old plaintext PIN exists, hash it on first successful unlock
23. Modify `app/setup-app-lock.tsx`: use `hashPin` on save

**Step 12: History Filters**
24. Modify `app/(tabs)/history.tsx`:
    - Add horizontal filter chip row below search bar
    - Filter chips: category (multi-select modal), type (expense/income toggle), payment method
    - Pass filter to `listPaginated()` / `listFiltered()`
    - Clear filters button when any filter is active

**Step 13: Backup & Restore**
25. Modify `db/backup.ts`:
    - `exportFullBackup()`: Query all tables, serialize to JSON with schema version
    - `restoreFromBackup(json)`: Validate schema version, drop+recreate tables, insert all data
26. Modify `app/(tabs)/settings.tsx`:
    - Add "Backup to Files" button — calls `exportFullBackup()` then `Sharing.shareAsync()`
    - Add "Restore from File" button — uses `DocumentPicker`, confirms with Alert, calls `restoreFromBackup()`
    - Add biometric re-authentication before export, delete-all, and PIN change

**Step 14: Accessibility — Roles & Hints (Comprehensive Pass)**
27. Audit all `Pressable` components across codebase:
    - Add `accessibilityRole="button"` to all interactive Pressables
    - Add meaningful `accessibilityHint` where action isn't obvious from label
    - Add `accessibilityLabel` to any remaining unlabeled icon buttons
28. Modify `components/spending-trend-chart-svg.tsx`:
    - Wrap SVG in `<View accessible accessibilityLabel="Spending trend chart showing...">` with dynamic summary text
    - Include total, peak day, and trend direction in the summary

---

### Phase 2 — Future Improvements (P2) — Estimated: 8-12 days

**Step 15: Income Analytics**
29. Modify `app/(tabs)/analytics.tsx`:
    - Add "Expenses / Income / Net" segment toggle above chart
    - Query income data alongside expenses
    - Show income bars in different color, net as line

**Step 16: Overall Budget**
30. Add DB migration for `isGlobal` column on budgets table
31. Modify `app/manage-budgets.tsx`:
    - Add "Total Monthly Budget" card at top
    - Use `BudgetLimitModal` for global budget (no category selection)
32. Modify `lib/budget-alert.ts`: check global budget in addition to per-category

**Step 17: AI Agent Truncation Warning**
33. Modify `lib/ai-agent.ts`: return `truncated` flag in result
34. Modify `app/(tabs)/ai.tsx`: show truncation warning when `ChatTurnResult.truncated === true`

**Step 18: API Key Validation**
35. Add `validateApiKey()` to `lib/ai-settings.ts`:
    - Send minimal `generateContent` request with "Hello" to test key
    - Return `{ valid: true }` or `{ valid: false, error: "..." }`
36. Modify `app/exbot-settings.tsx`: validate on save, show success/error toast

**Step 19: Upcoming Recurrences on Dashboard**
37. Add `listUpcomingDue(days: number)` to `data/recurring-repository.ts`
38. Modify `app/(tabs)/index.tsx`:
    - Add "Due This Week" section between bento cards and recent transactions
    - Show recurring items due within 7 days with amount and next date
    - Tap to navigate to manage-recurring

**Step 20: Reduced Motion Support**
39. Create `hooks/use-reduced-motion.ts`:
    - Listen to `AccessibilityInfo.isReduceMotionEnabled` change events
    - Return boolean, default to false
40. Modify `lib/haptics.ts`:
    - Import `AccessibilityInfo` from react-native
    - Cache reduce-motion preference at module level
    - In `lightImpact()` and `mediumImpact()`: skip haptic if reduce-motion enabled

**Step 21: Auto-Complete Trips**
41. Modify `app/manage-trips.tsx`:
    - On mount/focus, query ACTIVE trips where `endDate < today`
    - For each, auto-transition to COMPLETED status
    - Show brief toast "Trip X auto-completed"

**Step 22: Screen-Level Error Boundaries**
42. Create `components/screen-error-boundary.tsx`:
    - Class component wrapping children with `componentDidCatch`
    - Shows "Something went wrong" with "Tap to retry" button
    - Styled consistently with app theme
43. Modify `app/(tabs)/_layout.tsx`:
    - Wrap each tab screen render in `<ScreenErrorBoundary>`

**Step 23: Component Extraction / Refactoring**
44. Extract `DashboardHeroCard` from `app/(tabs)/index.tsx` → `components/dashboard-hero-card.tsx`
45. Extract `BentoCards` (budget card + insight card) → `components/bento-cards.tsx`
46. Extract `CategoryBreakdownModal` from `app/(tabs)/analytics.tsx` → `components/category-breakdown-modal.tsx`
47. Extract `BudgetLimitModal` from `app/manage-budgets.tsx` → `components/budget-limit-modal.tsx`
48. Add `components/pie-chart-svg.tsx`:
    - SVG donut chart component accepting `{ segments: { label, value, color }[] }`
    - Use in `CategoryBreakdownModal` alongside the existing list view

**Step 24: Low-Priority Bug Fixes**
49. Modify `components/app-header.tsx`: recalculate greeting on `useFocusEffect` to fix stale greeting
50. Modify `app/manage-budgets.tsx`: show "No history yet" `EmptyState` when budget history array is empty
51. Modify `app/add-transaction.tsx`: ensure duplicate mode clears `editId` param and shows "New Transaction" title

---

### Summary — Implementation Timeline

| Phase | Items | Estimated Days | Files Changed | New Files |
|-------|-------|---------------|---------------|-----------|
| P0 | 5 work items (13 sub-tasks) | 3-4 days | 10 files | 0 |
| P1 | 7 work items (15 sub-tasks) | 5-7 days | 14 files | 2 |
| P2 | 10 work items (21 sub-tasks) | 6-10 days | 13 files | 7 |
| **Total** | **22 work items (49 sub-tasks)** | **14-21 days** | **~27 unique files** | **9 new files** |

### Risk Mitigation
- **P0 changes are isolated**: Pagination, validation, and accessibility labels don't affect each other
- **PIN migration (P1)**: Backward-compatible — old plaintext PIN auto-migrates on first unlock
- **DB migrations (P2)**: Only global budget column addition — minimal schema change
- **Component extraction (P2)**: Pure refactoring with no behavior change — lowest risk
