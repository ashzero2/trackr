import * as Crypto from 'expo-crypto';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Keyboard, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { bodyFont, displayFont, headlineFont, labelFont } from '@/constants/typography';
import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { useAppColors } from '@/contexts/color-scheme-context';
import { useRepositories } from '@/contexts/database-context';
import { useUserProfile } from '@/contexts/user-profile-context';
import { useFormatMoney } from '@/hooks/use-format-money';
import { lightImpact, warningHaptic } from '@/lib/haptics';
import { materialIconNameForCategory } from '@/lib/category-icons';
import { CurrencyPickerField } from '@/components/currency-picker-field';
import { NumberPad } from '@/components/number-pad';
import { formatPreviewAmount } from '@/lib/format-preview';
import type { Category, EntryType, PaymentMethod, Trip } from '@/types/finance';

const EXPENSE_COLOR = '#F06B6B';
const INCOME_COLOR = '#4CD964';

/** Maximum transaction amount in the base unit (cents). 9,999,999.99 */
const MAX_AMOUNT = 9_999_999.99;
const MAX_AMOUNT_DIGITS = 9; // digits before decimal

function getCurrencySymbol(code: string): string {
  try {
    const parts = new Intl.NumberFormat(undefined, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? code;
  } catch { return code; }
}

export default function AddTransactionScreen() {
  const { id: editId, duplicate: duplicateId } = useLocalSearchParams<{ id?: string; duplicate?: string }>();
  const router = useRouter();
  const nav = useNavigation();
  const { colors } = useAppColors();
  const { format } = useFormatMoney();
  const { travelModeEnabled, activeTripId, currencyCode: profileCurrency, setProfile } = useUserProfile();
  const { transactions, categories, trips } = useRepositories();
  const insets = useSafeAreaInsets();
  const noteRef = useRef<TextInput>(null);

  const [loading, setLoading] = useState(!!(editId || duplicateId));
  const [type, setType] = useState<EntryType>('expense');
  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD');
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDate, setShowDate] = useState(false);
  const [showFxModal, setShowFxModal] = useState(false);
  const [catList, setCatList] = useState<Category[]>([]);
  const [tripList, setTripList] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [tripPickerOpen, setTripPickerOpen] = useState(false);
  const [newTripModalOpen, setNewTripModalOpen] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [txnCurrencyCode, setTxnCurrencyCode] = useState(profileCurrency);
  const [exchangeRateText, setExchangeRateText] = useState('1');

  const accentColor = type === 'expense' ? EXPENSE_COLOR : INCOME_COLOR;
  const sym = useMemo(() => getCurrencySymbol(txnCurrencyCode), [txnCurrencyCode]);
  const isFx = txnCurrencyCode !== profileCurrency;

  // ── Dirty-state tracking for discard confirmation ──
  const savedRef = useRef(false); // set to true after successful save/delete
  const isDirty = useMemo(() => {
    // In edit mode, any field change from the loaded value counts as dirty.
    // In add mode, any non-default value counts as dirty.
    if (amountText.length > 0 && amountText !== '0') return true;
    if (note.trim().length > 0) return true;
    if (categoryId !== null) return true;
    return false;
  }, [amountText, note, categoryId]);

  useEffect(() => {
    const unsubscribe = nav.addListener('beforeRemove', (e: any) => {
      // Allow navigation if form was saved/deleted or nothing was entered
      if (savedRef.current || !isDirty) return;
      // Prevent default navigation
      e.preventDefault();
      Alert.alert(
        'Discard changes?',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => nav.dispatch(e.data.action) },
        ],
      );
    });
    return unsubscribe;
  }, [nav, isDirty]);

  // ── Number pad (dismiss keyboard on tap) ──
  const [amountLimitHit, setAmountLimitHit] = useState(false);
  const limitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashAmountLimit = useCallback(() => {
    setAmountLimitHit(true);
    if (limitTimerRef.current) clearTimeout(limitTimerRef.current);
    limitTimerRef.current = setTimeout(() => setAmountLimitHit(false), 1200);
  }, []);

  const onDigit = useCallback((d: string) => {
    Keyboard.dismiss();
    setAmountText(p => {
      if (p === '0' && d !== '.') return d;
      const dot = p.indexOf('.');
      // max 2 decimal places
      if (dot !== -1 && p.length - dot > 2) return p;
      const candidate = p + d;
      const numVal = parseFloat(candidate);
      // Enforce max amount
      if (isFinite(numVal) && numVal > MAX_AMOUNT) {
        flashAmountLimit();
        return p;
      }
      // Enforce max digits before decimal
      const intPart = dot !== -1 ? p.slice(0, dot) : candidate;
      if (intPart.length > MAX_AMOUNT_DIGITS) {
        flashAmountLimit();
        return p;
      }
      return candidate;
    });
  }, [flashAmountLimit]);
  const onDecimal = useCallback(() => { Keyboard.dismiss(); setAmountText(p => p.includes('.') ? p : (p.length === 0 ? '0.' : p + '.')); }, []);
  const onBackspace = useCallback(() => { Keyboard.dismiss(); setAmountText(p => p.slice(0, -1)); setAmountLimitHit(false); }, []);

  // ── Data loading ──
  useEffect(() => { let a = true; categories.listByType(type).then(c => { if (a) setCatList(c); }); return () => { a = false; }; }, [categories, type]);
  useEffect(() => { let a = true; trips.listForTransactionPicker().then(l => { if (a) setTripList(l); }); return () => { a = false; }; }, [trips]);
  useEffect(() => {
    if (editId || duplicateId) return;
    if (!travelModeEnabled) { setSelectedTripId(null); return; }
    let a = true;
    (async () => { if (!activeTripId) { if (a) setSelectedTripId(null); return; } const t = await trips.getById(activeTripId); if (!a) return; if (t?.status === 'ACTIVE') setSelectedTripId(activeTripId); else setSelectedTripId(null); })();
    return () => { a = false; };
  }, [editId, duplicateId, travelModeEnabled, activeTripId, trips]);

  const load = useCallback(async () => {
    const sid = editId ?? duplicateId; if (!sid) { setLoading(false); return; }
    const row = await transactions.getById(sid);
    if (row) {
      setType(row.type);
      setAmountText((row.amountCents / 100).toFixed(2));
      setCategoryId(row.categoryId);
      setNote(row.note ?? '');
      // Map legacy payment methods to CARD
      const pm = row.paymentMethod;
      setPaymentMethod(pm === 'CASH' ? 'CASH' : 'CARD');
      setOccurredAt(duplicateId ? new Date() : new Date(row.occurredAt));
      setSelectedTripId(row.tripId);
      setTxnCurrencyCode(row.currencyCode ?? profileCurrency);
      setExchangeRateText(row.exchangeRateToBase != null && row.exchangeRateToBase !== 1 ? String(row.exchangeRateToBase) : '1');
      if (row.currencyCode && row.currencyCode !== profileCurrency) setShowFxModal(false);
    }
    setLoading(false);
  }, [editId, duplicateId, transactions, profileCurrency]);
  useEffect(() => { load(); }, [load]);

  useLayoutEffect(() => {
    nav.setOptions({
      headerShown: false,
    });
  }, [nav]);

  // ── Derived ──
  const convertedCents = useMemo(() => { if (!isFx) return null; const a = parseFloat(amountText.replace(/,/g, '')); const r = parseFloat(exchangeRateText); if (!isFinite(a) || a <= 0 || !isFinite(r) || r <= 0) return null; return Math.round(a * 100 * r); }, [isFx, amountText, exchangeRateText]);
  const isToday = useMemo(() => { const n = new Date(); return occurredAt.getDate() === n.getDate() && occurredAt.getMonth() === n.getMonth() && occurredAt.getFullYear() === n.getFullYear(); }, [occurredAt]);
  const dateLabel = isToday ? 'Today' : occurredAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const tripLabel = useMemo(() => { if (!selectedTripId) return 'No trip'; return tripList.find(x => x.id === selectedTripId)?.name ?? 'Trip'; }, [selectedTripId, tripList]);

  // ── Actions ──
  async function confirmTrip(id: string | null): Promise<boolean> { if (!id) return true; const t = await trips.getById(id); if (!t || (t.status !== 'COMPLETED' && t.status !== 'ARCHIVED')) return true; return new Promise(r => Alert.alert('Finished trip?', 'Continue?', [{ text: 'Cancel', style: 'cancel', onPress: () => r(false) }, { text: 'OK', onPress: () => r(true) }])); }

  const onSave = async () => {
    setError(null);
    const parsed = parseFloat(amountText.replace(/,/g, ''));
    if (!isFinite(parsed) || parsed <= 0) { setError('Enter a valid amount.'); return; }
    if (!categoryId) { setError('Choose a category.'); return; }
    if (isFx) { const r = parseFloat(exchangeRateText); if (!isFinite(r) || r <= 0) { setError('Enter a valid rate.'); return; } }
    if (!(await confirmTrip(selectedTripId))) return;
    setSaving(true);
    try {
      const cents = Math.round(parsed * 100); const iso = occurredAt.toISOString();
      const rate = isFx ? parseFloat(exchangeRateText) : 1;
      const payload = { amountCents: cents, type, categoryId, occurredAt: iso, note: note.trim() || null, paymentMethod, tripId: selectedTripId, currencyCode: txnCurrencyCode, amountBaseCents: isFx ? Math.round(cents * rate) : cents, exchangeRateToBase: rate };
      if (editId) await transactions.update(editId, payload);
      else await transactions.insert({ id: await Crypto.randomUUID(), ...payload });
      savedRef.current = true;
      lightImpact(); router.back();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setSaving(false); }
  };

  const onDelete = () => { if (!editId) return; warningHaptic(); Alert.alert('Delete?', 'Cannot undo.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { setSaving(true); try { await transactions.delete(editId); savedRef.current = true; lightImpact(); router.back(); } catch (e) { setError(e instanceof Error ? e.message : 'Error'); } finally { setSaving(false); } } }]); };

  const onCreateTrip = async () => {
    const n = newTripName.trim();
    if (!n) { Alert.alert('Name required'); return; }
    setSaving(true);
    try {
      const id = await Crypto.randomUUID();
      await trips.insert({ id, name: n, startAt: new Date().toISOString(), endAt: null, status: 'ACTIVE', metadata: null });
      await setProfile({ activeTripId: id, travelModeEnabled: true });
      const list = await trips.listForTransactionPicker();
      setTripList(list); setSelectedTripId(id); setNewTripModalOpen(false); setNewTripName('');
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Unknown'); }
    finally { setSaving(false); }
  };

  if (loading) return <View style={[s.root, s.center, { backgroundColor: colors.surface }]}><ActivityIndicator size="large" color={accentColor} /></View>;

  // ══════════════════ RENDER ══════════════════
  return (
    <View style={[s.root, { backgroundColor: colors.surface }]}>
      {/* ── Custom Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.headerBtn} hitSlop={8}>
          <MaterialIcons name="chevron-left" size={28} color={colors.onSurface} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.onSurface, fontFamily: headlineFont }]}>
          {editId ? 'Edit Transaction' : 'Add Transaction'}
        </Text>
        <Pressable onPress={() => router.back()} style={s.headerBtn} hitSlop={8}>
          <MaterialIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
      </View>

      {/* ── Type toggle (segmented control) ── */}
      <View style={[s.typeRow, { backgroundColor: colors.surfaceContainerHigh }]}>
        {(['expense', 'income'] as const).map(t => {
          const isActive = type === t;
          const bg = isActive ? (t === 'expense' ? EXPENSE_COLOR : INCOME_COLOR) : 'transparent';
          return (
            <Pressable key={t} onPress={() => { setType(t); setCategoryId(null); }}
              style={[s.typeChip, { backgroundColor: bg }]}>
              <Text style={[s.typeChipText, { color: isActive ? '#FFFFFF' : colors.onSurfaceVariant, fontFamily: labelFont }]}>
                {t === 'expense' ? 'Expense' : 'Income'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Flex spacer above amount ── */}
      <View style={s.spacer} />

      {/* ── Amount display (centered in available space) ── */}
      <View style={s.amountSection}>
        {error ? <Text style={[s.errorText, { color: colors.error, fontFamily: bodyFont }]}>{error}</Text> : null}
        {amountLimitHit ? <Text style={[s.errorText, { color: colors.error, fontFamily: bodyFont }]}>Maximum amount is {MAX_AMOUNT.toLocaleString()}</Text> : null}
        <View style={s.amountRow}>
          <Text style={[s.amountSymbol, { color: colors.onSurfaceVariant, fontFamily: displayFont }]}>{sym}</Text>
          <Text style={[s.amountText, { color: amountText ? colors.onSurface : colors.onSurfaceVariant, fontFamily: displayFont }]}>
            {formatPreviewAmount(amountText)}
          </Text>
          <View style={[s.amountCursor, { backgroundColor: accentColor }]} />
        </View>
        {isFx && convertedCents != null ? <Text style={[s.fxText, { color: accentColor, fontFamily: bodyFont }]}>≈ {format(convertedCents)} {profileCurrency}</Text> : null}
      </View>

      {/* ── Flex spacer below amount ── */}
      <View style={s.spacer} />

      {/* ── Categories: single-row horizontal scroll ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catScrollContent} style={s.catScroll}>
        {catList.map(item => {
          const sel = item.id === categoryId;
          return (
            <Pressable key={item.id} onPress={() => setCategoryId(item.id)}
              style={[s.catChip, { backgroundColor: sel ? accentColor : colors.surfaceContainerHigh }]}>
              <MaterialIcons name={materialIconNameForCategory(item.iconKey)} size={16} color={sel ? '#FFFFFF' : colors.onSurfaceVariant} />
              <Text style={[s.catLabel, { color: sel ? '#FFFFFF' : colors.onSurfaceVariant, fontFamily: labelFont }]} numberOfLines={1}>{item.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Note input (inline) ── */}
      <View style={[s.noteRow, { backgroundColor: colors.surfaceContainerHigh }]}>
        <MaterialIcons name="format-list-bulleted" size={18} color={colors.onSurfaceVariant} />
        <TextInput
          ref={noteRef}
          value={note}
          onChangeText={setNote}
          placeholder="Add a note..."
          placeholderTextColor={colors.onSurfaceVariant}
          style={[s.noteInput, { color: colors.onSurface, fontFamily: bodyFont }]}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
      </View>

      {/* ── Date + Payment method row ── */}
      <View style={s.metaRow}>
        <Pressable onPress={() => setShowDate(true)} style={[s.metaChip, { backgroundColor: colors.surfaceContainerHigh }]}>
          <MaterialIcons name="event" size={16} color={colors.onSurfaceVariant} />
          <Text style={[s.metaChipText, { color: colors.onSurface, fontFamily: labelFont }]}>{dateLabel}</Text>
        </Pressable>

        <View style={s.paymentToggle}>
          {(['CARD', 'CASH'] as const).map(pm => {
            const isActive = paymentMethod === pm;
            return (
              <Pressable key={pm} onPress={() => setPaymentMethod(pm)}
                style={[s.paymentChip, { backgroundColor: isActive ? accentColor : 'transparent' }]}>
                <MaterialIcons name={pm === 'CARD' ? 'credit-card' : 'account-balance-wallet'} size={14} color={isActive ? '#FFFFFF' : colors.onSurfaceVariant} />
                <Text style={[s.paymentChipText, { color: isActive ? '#FFFFFF' : colors.onSurfaceVariant, fontFamily: labelFont }]}>
                  {pm === 'CARD' ? 'Card' : 'Cash'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Travel mode options (trip/FX) ── */}
      {travelModeEnabled ? (
        <View style={s.travelRow}>
          <Pressable onPress={() => setTripPickerOpen(true)} style={[s.metaChip, { backgroundColor: colors.surfaceContainerHigh }]}>
            <MaterialIcons name="flight" size={14} color={colors.onSurfaceVariant} />
            <Text style={[s.metaChipText, { color: colors.onSurface, fontFamily: labelFont }]}>{tripLabel}</Text>
          </Pressable>
          <Pressable onPress={() => setShowFxModal(true)} style={[s.metaChip, { backgroundColor: isFx ? accentColor : colors.surfaceContainerHigh }]}>
            <MaterialIcons name="currency-exchange" size={14} color={isFx ? '#FFFFFF' : colors.onSurfaceVariant} />
            <Text style={[s.metaChipText, { color: isFx ? '#FFFFFF' : colors.onSurface, fontFamily: labelFont }]}>{isFx ? txnCurrencyCode : 'FX'}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── Number pad (fixed height) ── */}
      <NumberPad onDigit={onDigit} onDecimal={onDecimal} onBackspace={onBackspace} colors={colors} style={s.pad} />

      {/* ── Save / Delete buttons ── */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 4 }]}>
        {editId ? (
          <Pressable onPress={onDelete} style={[s.deleteBtn, { borderColor: colors.error }]}>
            <MaterialIcons name="delete-outline" size={18} color={colors.error} />
            <Text style={[s.deleteBtnText, { color: colors.error, fontFamily: labelFont }]}>Delete</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onSave} disabled={saving} style={[s.saveBtn, { backgroundColor: accentColor, opacity: saving ? 0.7 : 1 }]}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : (
            <Text style={[s.saveText, { color: '#FFFFFF', fontFamily: headlineFont }]}>
              {type === 'expense' ? 'Save Expense' : 'Save Income'}
            </Text>
          )}
        </Pressable>
      </View>

      {/* ── Modals ── */}
      {showDate && Platform.OS === 'android' ? <DateTimePicker value={occurredAt} mode="date" display="default" onChange={(_, d) => { setShowDate(false); if (d) setOccurredAt(d); }} /> : null}
      {showDate && Platform.OS === 'ios' ? (
        <Modal visible transparent animationType="fade">
          <Pressable style={s.backdrop} onPress={() => setShowDate(false)}>
            <View style={[s.sheet, { backgroundColor: colors.surfaceContainerLowest }]}>
              <DateTimePicker value={occurredAt} mode="date" display="spinner" onChange={(_, d) => { if (d) setOccurredAt(d); }} />
              <Pressable onPress={() => setShowDate(false)} style={[s.sheetBtn, { backgroundColor: accentColor }]}>
                <Text style={{ color: '#FFFFFF', fontFamily: labelFont, fontWeight: '700' }}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      ) : null}
      <Modal visible={showFxModal} transparent animationType="fade">
        <Pressable style={s.backdrop} onPress={() => setShowFxModal(false)}>
          <Pressable onPress={e => e.stopPropagation()} style={[s.sheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[s.sheetTitle, { color: accentColor, fontFamily: headlineFont }]}>Currency</Text>
            <CurrencyPickerField value={txnCurrencyCode} onChange={c => { setTxnCurrencyCode(c); if (c === profileCurrency) setExchangeRateText('1'); }} colors={colors} />
            {isFx ? (
              <>
                <Text style={[s.rateLabel, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>Exchange rate</Text>
                <TextInput value={exchangeRateText} onChangeText={setExchangeRateText} keyboardType="decimal-pad" placeholder="e.g. 83.50" placeholderTextColor={colors.onSurfaceVariant} style={[s.textInput, { color: colors.onSurface, backgroundColor: colors.surfaceContainerLow, fontFamily: bodyFont }]} />
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: bodyFont, fontSize: 12, marginTop: 4 }}>1 {txnCurrencyCode} = {exchangeRateText || '?'} {profileCurrency}</Text>
              </>
            ) : null}
            <Pressable onPress={() => setShowFxModal(false)} style={[s.sheetBtn, { backgroundColor: accentColor }]}>
              <Text style={{ color: '#FFFFFF', fontFamily: labelFont, fontWeight: '700' }}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={tripPickerOpen} transparent animationType="fade">
        <Pressable style={s.backdrop} onPress={() => setTripPickerOpen(false)}>
          <View style={[s.sheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[s.sheetTitle, { color: accentColor, fontFamily: headlineFont }]}>Trip</Text>
            <Pressable style={s.sheetRow} onPress={() => { setSelectedTripId(null); setTripPickerOpen(false); }}><Text style={{ color: colors.onSurface, fontFamily: bodyFont }}>None</Text></Pressable>
            {tripList.map(t => <Pressable key={t.id} style={s.sheetRow} onPress={() => { setSelectedTripId(t.id); setTripPickerOpen(false); }}><Text style={{ color: colors.onSurface, fontFamily: bodyFont }}>{t.name} · {t.status}</Text></Pressable>)}
            <Pressable style={s.sheetRow} onPress={() => { setTripPickerOpen(false); setNewTripModalOpen(true); }}><Text style={{ color: accentColor, fontFamily: labelFont, fontWeight: '700' }}>+ New trip</Text></Pressable>
          </View>
        </Pressable>
      </Modal>
      <Modal visible={newTripModalOpen} transparent animationType="fade">
        <Pressable style={s.backdrop} onPress={() => setNewTripModalOpen(false)}>
          <Pressable onPress={e => e.stopPropagation()} style={[s.sheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[s.sheetTitle, { color: accentColor, fontFamily: headlineFont }]}>New trip</Text>
            <TextInput value={newTripName} onChangeText={setNewTripName} placeholder="Trip name" placeholderTextColor={colors.onSurfaceVariant} style={[s.textInput, { color: colors.onSurface, backgroundColor: colors.surfaceContainerLow, fontFamily: bodyFont }]} />
            <Pressable onPress={() => void onCreateTrip()} disabled={saving} style={[s.sheetBtn, { backgroundColor: accentColor, marginTop: 12 }]}>
              <Text style={{ color: '#FFFFFF', fontFamily: headlineFont, fontWeight: '700' }}>Create</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },

  // Type toggle
  typeRow: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 999, padding: 3 },
  typeChip: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  typeChipText: { fontSize: 14, fontWeight: '600' },

  // Amount
  amountSection: { alignItems: 'center', paddingVertical: 10 },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  amountSymbol: { fontSize: 28, fontWeight: '700', marginRight: 4 },
  amountText: { fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  amountCursor: { width: 2, height: 32, marginLeft: 2, borderRadius: 1 },
  errorText: { fontSize: 12, marginBottom: 4 },
  fxText: { fontSize: 12, fontWeight: '600', marginTop: 4 },

  // Spacer to center amount and push bottom content down
  spacer: { flex: 1 },

  // Categories
  catScroll: { flexGrow: 0, marginTop: 12 },
  catScrollContent: { paddingHorizontal: 16, gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 999 },
  catLabel: { fontSize: 12, fontWeight: '600' },

  // Note
  noteRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: 'transparent' },
  noteInput: { flex: 1, fontSize: 14, marginLeft: 10, padding: 0 },

  // Date & Payment row
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 10 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  metaChipText: { fontSize: 12, fontWeight: '600' },
  paymentToggle: { flexDirection: 'row', gap: 4 },
  paymentChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  paymentChipText: { fontSize: 12, fontWeight: '600' },

  // Travel row
  travelRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 8 },

  // Number pad
  pad: { height: 200, marginTop: 12 },

  // Bottom bar
  bottomBar: { paddingHorizontal: 16, paddingTop: 16 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 10, marginBottom: 8 },
  deleteBtnText: { fontSize: 14, fontWeight: '600' },
  saveBtn: { borderRadius: 999, minHeight: MIN_TOUCH_TARGET, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 16, fontWeight: '700' },

  // Modals
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '70%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  sheetBtn: { marginTop: 12, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  sheetRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.1)' },
  textInput: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, minHeight: 44 },
  rateLabel: { fontSize: 11, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
});
