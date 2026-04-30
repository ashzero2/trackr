# Comprehensive UI/UX & Code Review — MoneyManager (Trackr)

**Reviewer:** Senior Dev AI Review  
**Date:** April 30, 2026  
**Scope:** Full codebase — screens, components, contexts, hooks, lib utilities, data repositories, DB layer, constants, and types.

---

## 1. OVERALL ARCHITECTURE ASSESSMENT

**Strengths:**
- Clean separation of concerns: `data/` repositories, `lib/` pure logic, `contexts/` for DI, `components/` for reusable UI, `app/` for screens.
- SQLite with a proper migration system (`db/migrations.ts`) — forward-only, versioned.
- Repository pattern wrapping raw SQL — no raw queries in UI code.
- Expo Router file-based routing is well-structured with `(tabs)` group.
- Provider hierarchy in `_layout.tsx` is logical: ErrorBoundary > ColorScheme > UserProfile > AppLock > Database > Navigation > Stack.
- 6-theme system with light/dark variants (12 total color schemes) via `design-tokens.ts` — impressive.
- Haptic feedback integrated throughout.

**Rating: 8/10** — well-architected for a personal finance app.

---

## 2. UI/UX REVIEW

### 2.1 Onboarding (`app/onboarding.tsx`)

| Aspect | Finding | Severity |
|--------|---------|----------|
| ✅ 4-slide intro pager | Good — explains features before asking for data | — |
| ✅ Name + currency setup | Minimal friction | — |
| ⚠️ No skip option visible | Users who reinstall have to swipe through all 4 slides again | Low |
| ⚠️ Currency picker opens a full modal list | For 150+ currencies, no search/filter functionality is present in the picker | Medium |
| ⚠️ No back navigation from setup step | If user accidentally swipes past intro, can't go back | Low |

### 2.2 Dashboard / Home Tab (`app/(tabs)/index.tsx`)

| Aspect | Finding | Severity |
|--------|---------|----------|
| ✅ Hero card with monthly totals | Clear at-a-glance summary | — |
| ✅ Velocity projection ("on pace for X") | Smart financial insight | — |
| ✅ Bento cards (budget + insight) | Good information density | — |
| ✅ Grouped-by-day recent transactions | Natural mental model | — |
| ✅ Pull-to-refresh | Expected pattern, implemented | — |
| ✅ FAB for quick add | Discoverable primary action | — |
| ⚠️ Search bar in dashboard | The search filters recent transactions only (last ~50), not all history — potentially confusing for users expecting global search | Medium |
| ⚠️ No loading skeleton on first load | Uses `ActivityIndicator` spinner which feels less polished than the `SkeletonCard` component already available in the codebase | Low |
| 🐛 `dataVersion` ref for cache invalidation | The `dataVersion` ref increments on focus but race conditions are possible if user rapidly navigates back/forth while SQLite queries are in-flight | Medium |

### 2.3 Add Transaction Screen (`app/add-transaction.tsx`)

| Aspect | Finding | Severity |
|--------|---------|----------|
| ✅ Custom number pad with calculator | +/− operators for split-expense math | — |
| ✅ Category horizontal scroll picker | Visual, fast selection | — |
| ✅ Expense/Income toggle | Clear type switching | — |
| ✅ Payment method toggle (Card/Cash) | Quick one-tap | — |
| ✅ Dirty-state discard confirmation | Prevents accidental data loss | — |
| ✅ Edit/duplicate/delete support | Full CRUD from one screen | — |
| ⚠️ No amount validation feedback | User can save ₹0.00 transactions — no warning or prevention | Medium |
| ⚠️ Category required but no visual error state | If user taps Save without selecting a category, behavior is unclear — no inline validation message | Medium |
| ⚠️ Note field is optional with no prompt | Could benefit from a subtle placeholder suggesting "What was this for?" | Low |
| ⚠️ FX rate input is a raw text field | No validation that exchange rate is > 0 or reasonable (e.g., someone could type 0 or negative) | Medium |
| 🐛 Calculator edge case | The `+`/`−` operator logic: if user types "100+50−" then saves, the pending operator is silently dropped. No visual indicator of pending operation state | Medium |
| ⚠️ Date picker defaults to today | When editing a past transaction, user has to manually change — no "keep original date" hint | Low |

### 2.4 History Tab (`app/(tabs)/history.tsx`)

| Aspect | Finding | Severity |
|--------|---------|----------|
| ✅ Grouped by day | Consistent with dashboard | — |
| ✅ Swipeable rows for delete | Modern gesture pattern | — |
| ✅ Undo snackbar on delete | Excellent — prevents accidental data loss | — |
| ⚠️ No pagination / infinite scroll | If user has thousands of transactions, loading all into memory could be slow. Uses `SectionList` but data is not paginated from SQLite | High |
| ⚠️ No filter by category, payment method, or amount range | Only time-based grouping available | Medium |
| ⚠️ No sort options | Always chronological descending — can't sort by amount | Low |

### 2.5 Analytics Tab (`app/(tabs)/analytics.tsx`)

| Aspect | Finding | Severity |
|--------|---------|----------|
| ✅ Multi-view: 7-day, monthly, yearly | Good time granularity | — |
| ✅ SVG-based chart (no heavy charting lib) | Lightweight, custom-built | — |
| ✅ Category breakdown with percentages | Clear spending distribution | — |
| ✅ Peak day insight | Actionable information | — |
| ✅ Chart tooltip on bar tap | Interactive data exploration | — |
| ⚠️ No income analytics | Charts only show expenses — income trends, savings rate, net worth over time are all missing | Medium |
| ⚠️ No export/share analytics | Can't share a spending report or screenshot | Low |
| ⚠️ Category breakdown modal uses a simple list | No pie chart or donut chart visualization | Low |
| 🐛 Tooltip positioning | `ChartTooltip` uses absolute positioning with a `left` value from bar position — on narrow screens or edge bars, tooltip could overflow off-screen | Medium |

### 2.6 AI Tab / ExBot (`app/(tabs)/ai.tsx`)

| Aspect | Finding | Severity |
|--------|---------|----------|
| ✅ Gemini-powered chat with tool calling | Genuinely useful — can query transactions, propose new ones | — |
| ✅ Fast-path for simple intents | Avoids API call for "list categories" etc. | — |
| ✅ Proposed transaction cards with accept/reject | Great UX for AI-suggested entries | — |
| ⚠️ API key stored in SecureStore | Good, but no way to verify the key is valid before saving — user gets errors only when trying to chat | Medium |
| ⚠️ No conversation persistence | Chat resets on tab change or app restart — no history | Medium |
| ⚠️ 6-iteration tool loop limit | If Gemini needs more rounds, the conversation just stops with whatever partial result exists — no user-facing message about hitting the limit | Medium |
| ⚠️ No rate limiting or cost awareness | User could inadvertently make many API calls with no visibility into usage/cost | Low |
| 🐛 Error handling in `runGeminiChatTurn` | If the API returns a non-JSON response or network error mid-loop, the error propagates but the partial conversation state may be inconsistent | Medium |

### 2.7 Settings Tab (`app/(tabs)/settings.tsx`)

| Aspect | Finding | Severity |
|--------|---------|----------|
| ✅ Organized in sections | Theme, data management, security, about | — |
| ✅ Theme picker with 6 themes | Visual swatches, live preview | — |
| ✅ Dark/Light mode toggle | System or manual | — |
| ✅ Export CSV, Import CSV | Data portability | — |
| ✅ App Lock with PIN + biometrics | Good security option | — |
| ✅ Notification settings | Granular control | — |
| ⚠️ No data backup/restore to cloud | Only local SQLite — device loss = data loss. `db/backup.ts` exists but only does local file copy | High |
| ⚠️ No account deletion / data wipe confirmation | "Reset" or destructive actions need double-confirmation | Medium |
| ⚠️ Settings scroll is long | No section jump/index — user must scroll to find items | Low |

### 2.8 Manage Budgets (`app/manage-budgets.tsx`)

| Aspect | Finding | Severity |
|--------|---------|----------|
| ✅ Per-category budget limits | Granular control | — |
| ✅ Weekly/Monthly/Yearly periods | Flexible | — |
| ✅ Progress bars | Visual spending vs limit | — |
| ✅ 6-month history per category | Trend awareness | — |
| ⚠️ No overall/total budget | Can only set per-category, not "total monthly spending limit" | Medium |
| ⚠️ Budget alerts fire but no in-app banner | Relies solely on push notifications — if notifications are off, user gets no warning | Medium |

### 2.9 Travel / Trip Mode (`app/manage-trips.tsx`, `app/trip-detail.tsx`)

| Aspect | Finding | Severity |
|--------|---------|----------|
| ✅ Trip creation with foreign currency | Good for travelers | — |
| ✅ Daily budget with overspent warning | Practical | — |
| ✅ FX badge on transactions | Clear visual indicator | — |
| ⚠️ Manual exchange rate entry | No live FX rate fetching — error-prone | Medium |
| ⚠️ Trip status transitions are manual | No auto-complete when end date passes | Low |

### 2.10 Recurring Transactions (`app/manage-recurring.tsx`, `app/add-recurring.tsx`)

| Aspect | Finding | Severity |
|--------|---------|----------|
| ✅ Supports daily/weekly/monthly/yearly | Comprehensive | — |
| ✅ Auto-generation on app open | `RecurrenceAppStateListener` in layout | — |
| ⚠️ Due badge on settings tab only | Not visible on dashboard — user might not notice recurring are pending | Medium |
| ⚠️ No preview of upcoming recurrences | Can't see "what's coming this week" | Low |

### 2.11 Manage Categories (`app/manage-categories.tsx`)

| Aspect | Finding | Severity |
|--------|---------|----------|
| ✅ Expense/Income grouping via SectionList | Clear organization | — |
| ✅ Icon picker with horizontal scroll | Visual category identification | — |
| ✅ Delete guard (only if no transactions) | Prevents orphaned data | — |
| ⚠️ Type locked if transactions exist | User can't change expense→income if category has transactions — no merge/migrate option, could strand a category | Medium |
| ⚠️ No category reordering | Categories display in creation order — can't prioritize frequently used ones | Low |

---

## 3. ACCESSIBILITY REVIEW

| Issue | Details | Severity |
|-------|---------|----------|
| ✅ `MIN_TOUCH_TARGET = 44` constant exists | Used in some places | — |
| ⚠️ Inconsistent touch target usage | Many `Pressable` elements (category pills, icon buttons, budget rows) don't enforce 44pt minimum. The constant exists but isn't applied universally | High |
| ⚠️ No `accessibilityLabel` on most Pressables | Icon-only buttons (backspace on NumberPad, dark mode toggle, FAB) lack screen reader labels | High |
| ⚠️ No `accessibilityRole` annotations | Buttons not marked as `role="button"`, links not as `role="link"` | High |
| ⚠️ Color contrast concerns | Some theme combinations (e.g., `sand` light mode) may have insufficient contrast between `textSecondary` and `surface` — no contrast checking in design tokens | Medium |
| ⚠️ No reduced-motion support | Haptics and animations play regardless of system accessibility settings (`AccessibilityInfo.isReduceMotionEnabled` not checked) | Medium |
| ⚠️ Chart is not accessible | SVG spending chart has no alternative text description or data table fallback for screen readers | High |
| ⚠️ Number pad has no VoiceOver grouping | Digits announced individually without context ("1", "2"... instead of "Number pad, 1") | Medium |
| ⚠️ No `accessibilityHint` on interactive elements | Swipeable rows don't announce "swipe left to delete" — discoverability issue for assistive tech users | Medium |

---

## 4. BUGS & LOGIC ISSUES

### 4.1 Critical / High

| # | Bug | Location | Details |
|---|-----|----------|---------|
| 1 | **No pagination in History** | `app/(tabs)/history.tsx` | All transactions loaded at once via `transactions.listAll()` or similar. With 10K+ transactions, this will cause significant memory pressure and UI jank on low-end devices. |
| 2 | **Race condition on rapid navigation** | `app/(tabs)/index.tsx` | `dataVersion` ref increments on `useFocusEffect`, triggering async SQLite queries. If user rapidly switches tabs, stale query results can overwrite fresh data in state. No cancellation token or version check on query completion. |
| 3 | **App Lock bypass on cold start** | `contexts/app-lock-context.tsx` | The `AppLockGate` renders children while `isLocked` state initializes. There's a brief flash where the underlying content is visible before the lock screen mounts. Need to show a splash/opaque screen until lock state is determined. |
| 4 | **CSV import lacks transaction validation** | `lib/import-csv.ts` | `tryParseBankOrWalletCsv` can produce rows with `amountCents = 0` or `NaN` if the amount column contains non-numeric data (e.g., "Pending", "N/A"). These flow into the database unchecked. |

### 4.2 Medium

| # | Bug | Location | Details |
|---|-----|----------|---------|
| 5 | **Gemini tool loop silent truncation** | `lib/ai-agent.ts` | Max 6 iterations. If the LLM hasn't finished tool-calling by iteration 6, the last partial result is returned with no indication to the user that the response is incomplete. |
| 6 | **FX rate of 0 allowed** | `app/add-transaction.tsx` | The FX rate text input has no validation. A rate of `0` would cause division by zero when converting amounts. A negative rate would corrupt the transaction. |
| 7 | **Budget alert timing** | `lib/budget-alert.ts` | Weekly budget calculation uses `new Date()` for Monday calculation, but the transactions query uses UTC dates. Timezone mismatch can cause incorrect weekly spend calculations near midnight. |
| 8 | **Tooltip overflow** | `components/chart-tooltip.tsx` | Tooltip `left` position is calculated from bar center. No bounds checking against screen width — tooltip text clips on rightmost bars. |
| 9 | **Pending calculator operator on save** | `app/add-transaction.tsx` | If user enters "100+" then taps Save, the pending `+` operator is silently discarded. The amount saved is 100, not the user's intended sum. No visual feedback about the pending operation. |
| 10 | **Swipeable row state leak** | `components/swipeable-transaction-row.tsx` | When a row is swiped open and another is swiped, the first doesn't auto-close. Multiple swipe drawers can be open simultaneously, which is non-standard UX. |

### 4.3 Low

| # | Bug | Location | Details |
|---|-----|----------|---------|
| 11 | **Stale greeting** | `components/app-header.tsx` | Greeting is calculated once on mount. If user leaves app open across morning→afternoon, the greeting doesn't update. |
| 12 | **No empty state for budget history** | `app/manage-budgets.tsx` | Expanding history for a category with no past budgets shows a blank area — no "No history yet" message. |
| 13 | **Duplicate transaction inherits ID context** | `app/add-transaction.tsx` | When duplicating, the `editId` param should be cleared, but the screen title might still show "Edit" briefly during the transition. |

---

## 5. PERFORMANCE CONCERNS

| Issue | Details | Severity |
|-------|---------|----------|
| ⚠️ No query result caching | Every `useFocusEffect` triggers fresh SQLite queries. No in-memory cache or stale-while-revalidate pattern. On complex screens (analytics, dashboard), this means 3-5 queries per focus event. | Medium |
| ⚠️ Large list rendering | History and trip-detail screens render all transactions in a `SectionList` without windowing optimization hints (`getItemLayout`, `maxToRenderPerBatch`, `windowSize`). | High |
| ⚠️ SVG chart re-renders | `SpendingTrendChartSVG` recalculates all bar positions on every render. No `useMemo` wrapping the SVG path calculations. | Medium |
| ⚠️ Font loading blocks render | `useAppFonts` loads 7 font variants synchronously via `useFonts`. If fonts are slow to load (cold start, slow storage), the entire app shows splash screen. | Low |
| ⚠️ No image caching strategy | Pet avatars and category icons are loaded from bundled assets, which is fine — but if remote images are ever added, there's no caching layer. | Low |
| ✅ No heavy third-party chart library | Custom SVG charts keep bundle size lean | — |
| ✅ Haptics are lightweight | Uses `expo-haptics` which is native and minimal overhead | — |

---

## 6. SECURITY REVIEW

| Issue | Details | Severity |
|-------|---------|----------|
| ✅ API key in SecureStore | Gemini key stored via `expo-secure-store`, not AsyncStorage | — |
| ✅ App Lock with PIN + biometrics | `expo-local-authentication` with progressive lockout | — |
| ✅ No network calls for core functionality | All data is local SQLite | — |
| ⚠️ App Lock cold-start flash | Content briefly visible before lock screen renders (see Bug #3) | High |
| ⚠️ PIN stored in SecureStore but no salting/hashing | PIN is compared directly. If SecureStore is compromised, PIN is in plaintext. Should hash with a salt. | Medium |
| ⚠️ CSV import is unsanitized | Imported CSV data goes directly into SQLite. While parameterized queries prevent SQL injection, malformed UTF-8 or extremely long strings in note fields could cause display issues. | Low |
| ⚠️ Gemini API key sent over HTTPS | Good, but the key is sent in the request body to the Gemini endpoint. If the user accidentally enables a debugging proxy, the key could leak. | Low |
| ⚠️ No biometric re-authentication for sensitive actions | Exporting all data, deleting all transactions, or changing the PIN doesn't require re-authentication | Medium |

---

## 7. CODE QUALITY OBSERVATIONS

### 7.1 Positive Patterns
- **Consistent hook usage**: Custom hooks (`useFormatMoney`, `useAppColors`, `useDatabase`) create a clean API surface.
- **Repository pattern**: All SQL is encapsulated. Changing DB schema only affects `data/` and `db/` layers.
- **Error boundary at root**: `ErrorBoundary` wraps the entire app in `_layout.tsx`.
- **Type safety**: TypeScript throughout with well-defined types in `types/finance.ts`.
- **Design tokens**: Centralized color system with semantic naming.
- **Test coverage for utilities**: `analytics-buckets`, `dates`, `format-money`, `recurrence-engine` all have test files.

### 7.2 Areas for Improvement
- **Large screen files**: `analytics.tsx` (~380 lines), `index.tsx` (~290 lines), `add-transaction.tsx` (~310 lines) could be broken into smaller sub-components.
- **Inline styles**: Many screens define `StyleSheet.create` at the bottom but also use inline style objects — inconsistent pattern.
- **No error boundaries per screen**: Only one global ErrorBoundary. A screen-level boundary would prevent full-app crashes.
- **Missing TypeScript strict mode checks**: Some `any` types likely exist in the Gemini API response handling.
- **No API response validation**: Gemini responses are trusted without schema validation (e.g., using Zod).
- **Test coverage gaps**: No tests for UI components, screens, or data repositories. Only pure utility functions are tested.

---

## 8. RECOMMENDATIONS — PRIORITIZED

### P0 — Fix Before Next Release
1. **Add pagination to History tab** — Use `LIMIT/OFFSET` in SQLite queries, implement infinite scroll.
2. **Fix App Lock cold-start flash** — Render opaque placeholder until lock state resolves.
3. **Add `accessibilityLabel` to all icon-only buttons** — FAB, number pad backspace, dark mode toggle, swipe actions.
4. **Validate FX rate input** — Reject 0, negative, and non-numeric values.
5. **Validate transaction amount > 0 on save** — Show inline error or disable save button.

### P1 — Next Sprint
6. **Add search/filter to currency picker** — Critical for 150+ currency list.
7. **Implement query cancellation** — Cancel in-flight SQLite queries when `useFocusEffect` fires again (abort controller pattern).
8. **Add cloud backup option** — Even a simple "export to Files app" with restore capability.
9. **Hash PIN before storage** — Use `expo-crypto` to SHA-256 hash with a random salt stored alongside.
10. **Add `accessibilityRole` and `accessibilityHint`** to all interactive elements.
11. **Category filter in History** — Allow filtering transactions by category, type, payment method.
12. **Close other swipe rows** — Implement a shared ref to auto-close other open `SwipeableTransactionRow`s.

### P2 — Future Improvements
13. **Income analytics** — Show income trends, net savings, income vs expense comparison.
14. **Overall budget limit** — In addition to per-category limits.
15. **API key validation** — Test the Gemini key on save and show success/error.
16. **Upcoming recurrences preview** — Show "Due this week" section on dashboard.
17. **Pie/donut chart for category breakdown** — More visual than a plain list.
18. **Reduced-motion support** — Check `AccessibilityInfo.isReduceMotionEnabled` before playing haptics/animations.
19. **Auto-complete trips** — Automatically transition trip status to COMPLETED when end date passes.
20. **Screen-level error boundaries** — Wrap each tab screen in its own `ErrorBoundary` to prevent full-app crashes from screen-specific bugs.
21. **Validate Gemini API responses** — Use Zod or a similar schema validator to ensure tool call responses match expected shape.
22. **Break up large screens** — Extract `DashboardHeroCard`, `BentoCards`, `CategoryBreakdownModal`, `BudgetLimitModal` into separate component files.

---

## 9. FEATURE COMPLETENESS SCORECARD

| Feature | Status | Notes |
|---------|--------|-------|
| Transaction CRUD | ✅ Complete | Add, edit, duplicate, delete with undo |
| Categories | ✅ Complete | CRUD with icon picker, delete guards |
| Budgets | ✅ Mostly Complete | Per-category only, no total budget |
| Recurring Transactions | ✅ Complete | Auto-generation, CRUD, frequency options |
| Analytics | ⚠️ Partial | Expense-only, no income/savings analytics |
| AI Assistant | ✅ Complete | Gemini tool-calling, proposal cards |
| Trip/Travel Mode | ✅ Complete | FX support, daily budget, trip detail |
| Themes | ✅ Complete | 6 themes × 2 schemes = 12 combinations |
| App Lock | ⚠️ Mostly Complete | PIN + biometrics, but cold-start flash bug |
| Data Export | ✅ Complete | CSV export with sharing |
| Data Import | ⚠️ Partial | CSV import but no validation, no cloud restore |
| Notifications | ✅ Complete | Budget alerts, recurring reminders |
| Accessibility | ❌ Incomplete | Missing labels, roles, hints, contrast checks |
| Onboarding | ✅ Complete | 4-slide intro + setup |
| Search | ⚠️ Partial | Dashboard only, no global search |
| Filters | ❌ Missing | No category/amount/payment method filters in History |

---

## 10. SUMMARY

**Overall Grade: B+**

This is a well-built, feature-rich personal finance app with solid architecture. The codebase demonstrates strong engineering fundamentals — clean separation of concerns, proper use of TypeScript, a thoughtful design system, and a pragmatic approach to feature development (custom SVG charts instead of heavy libraries, local-first SQLite, Gemini AI with tool-calling).

**Top 3 Strengths:**
1. The 6-theme × light/dark design token system is production-quality.
2. The AI assistant with function-calling and proposal cards is genuinely innovative for a personal finance app.
3. Clean repository pattern and migration system make the data layer maintainable and extensible.

**Top 3 Weaknesses:**
1. Accessibility is the biggest gap — the app would be largely unusable for screen reader users.
2. No data pagination means the app will degrade with heavy usage (1000+ transactions).
3. No cloud backup means device loss = complete data loss for a financial app, which is a critical trust issue.

**Verdict:** Ship-ready for a v1 with the P0 fixes applied. The P1 items should be addressed within the first month post-launch to handle scale and security properly.
