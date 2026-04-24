import type { DocumentPickerAsset } from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { CategoryRepository } from '@/data/category-repository';
import type { TransactionRepository } from '@/data/transaction-repository';
import type { TripRepository } from '@/data/trip-repository';
import type { EntryType, PaymentMethod, TransactionWithCategory, Trip, TripStatus } from '@/types/finance';

export const TRANSACTION_JSON_VERSION = 2;

const PAYMENT_METHODS = new Set<PaymentMethod>(['CARD', 'CASH', 'ACH', 'OTHER']);

const TRIP_STATUSES = new Set<TripStatus>(['PLANNED', 'ACTIVE', 'COMPLETED', 'ARCHIVED']);

export type TripJsonRow = {
  id: string;
  name: string;
  startAt: string;
  endAt: string | null;
  status: TripStatus;
  createdAt: string;
  metadata: string | null;
};

export type TransactionJsonExportRow = {
  amountCents: number;
  type: EntryType;
  categoryName: string;
  occurredAt: string;
  note: string;
  paymentMethod: PaymentMethod;
  tripId: string | null;
  currencyCode: string | null;
  amountBaseCents: number | null;
  exchangeRateToBase: number | null;
};

export type TransactionJsonExportPayload = {
  version: typeof TRANSACTION_JSON_VERSION;
  exportedAt: string;
  currencyCode: string;
  trips: TripJsonRow[];
  transactions: TransactionJsonExportRow[];
};

export type ParsedImportRow = TransactionJsonExportRow;

function normalizePaymentMethod(raw: unknown): PaymentMethod | null {
  if (typeof raw !== 'string') return null;
  const u = raw.trim().toUpperCase();
  if (u === 'VISA') return 'CARD';
  return PAYMENT_METHODS.has(u as PaymentMethod) ? (u as PaymentMethod) : null;
}

function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) {
    return null;
  }
  return v.trim();
}

function asEntryType(v: unknown): EntryType | null {
  if (v === 'expense' || v === 'income') return v;
  return null;
}

function pickField(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (k in obj) return obj[k];
  }
  return undefined;
}

function extractTransactionArray(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && typeof parsed === 'object' && 'transactions' in parsed) {
    const t = (parsed as { transactions: unknown }).transactions;
    return Array.isArray(t) ? t : null;
  }
  return null;
}

function parseTripFromObj(o: Record<string, unknown>, index: number): TripJsonRow | { error: string } {
  const id = asNonEmptyString(pickField(o, 'id'));
  if (!id) return { error: `Trip ${index + 1}: "id" is required.` };
  const name = asNonEmptyString(pickField(o, 'name'));
  if (!name) return { error: `Trip ${index + 1}: "name" is required.` };
  const startRaw = pickField(o, 'startAt', 'start_at');
  const startAt = typeof startRaw === 'string' ? startRaw.trim() : '';
  if (!startAt || Number.isNaN(Date.parse(startAt))) {
    return { error: `Trip ${index + 1}: "startAt" must be a valid ISO date string.` };
  }
  const endRaw = pickField(o, 'endAt', 'end_at');
  const endAt =
    endRaw === null || endRaw === undefined
      ? null
      : typeof endRaw === 'string' && endRaw.trim()
        ? endRaw.trim()
        : null;
  const st = pickField(o, 'status');
  const status = typeof st === 'string' && TRIP_STATUSES.has(st as TripStatus) ? (st as TripStatus) : null;
  if (!status) return { error: `Trip ${index + 1}: invalid "status".` };
  const cr = pickField(o, 'createdAt', 'created_at');
  const createdAt =
    typeof cr === 'string' && cr.trim() && !Number.isNaN(Date.parse(cr)) ? cr.trim() : new Date().toISOString();
  const metaRaw = pickField(o, 'metadata');
  const metadata =
    metaRaw === null || metaRaw === undefined
      ? null
      : typeof metaRaw === 'string'
        ? metaRaw
        : null;
  return { id, name, startAt, endAt, status, createdAt, metadata };
}

function parseTxnRow(o: Record<string, unknown>, i: number): ParsedImportRow | { error: string } {
  const rawAmount = pickField(o, 'amountCents', 'amount_cents');
  const amountCents =
    typeof rawAmount === 'number' ? rawAmount : typeof rawAmount === 'string' ? Number(rawAmount) : NaN;
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    return { error: `Row ${i + 1}: "amountCents" must be a non-negative integer.` };
  }

  const type = asEntryType(o.type);
  if (!type) {
    return { error: `Row ${i + 1}: "type" must be "expense" or "income".` };
  }

  const categoryName = asNonEmptyString(pickField(o, 'categoryName', 'category_name'));
  if (!categoryName) {
    return { error: `Row ${i + 1}: "categoryName" is required.` };
  }

  const occurredRaw = pickField(o, 'occurredAt', 'occurred_at');
  const occurredAt = typeof occurredRaw === 'string' ? occurredRaw.trim() : '';
  if (!occurredAt || Number.isNaN(Date.parse(occurredAt))) {
    return { error: `Row ${i + 1}: "occurredAt" must be a valid ISO date string.` };
  }

  const pm = normalizePaymentMethod(pickField(o, 'paymentMethod', 'payment_method'));
  if (!pm) {
    return {
      error: `Row ${i + 1}: "paymentMethod" must be one of CARD, CASH, ACH, OTHER (VISA is accepted as Card).`,
    };
  }

  let note = '';
  const noteRaw = o.note;
  if (noteRaw === null || noteRaw === undefined) {
    note = '';
  } else if (typeof noteRaw === 'string') {
    note = noteRaw;
  } else {
    return { error: `Row ${i + 1}: "note" must be a string if present.` };
  }

  const tripRaw = pickField(o, 'tripId', 'trip_id');
  const tripId =
    tripRaw === null || tripRaw === undefined || tripRaw === ''
      ? null
      : typeof tripRaw === 'string'
        ? tripRaw
        : null;

  const curRaw = pickField(o, 'currencyCode', 'currency_code');
  const currencyCode =
    curRaw === null || curRaw === undefined
      ? null
      : typeof curRaw === 'string' && curRaw.trim()
        ? curRaw.trim()
        : null;

  const abRaw = pickField(o, 'amountBaseCents', 'amount_base_cents');
  const amountBaseCents =
    abRaw === null || abRaw === undefined
      ? null
      : typeof abRaw === 'number'
        ? abRaw
        : typeof abRaw === 'string'
          ? Number(abRaw)
          : null;
  if (amountBaseCents !== null && (!Number.isInteger(amountBaseCents) || amountBaseCents < 0)) {
    return { error: `Row ${i + 1}: "amountBaseCents" must be a non-negative integer if present.` };
  }

  const exRaw = pickField(o, 'exchangeRateToBase', 'exchange_rate_to_base');
  const exchangeRateToBase =
    exRaw === null || exRaw === undefined
      ? null
      : typeof exRaw === 'number'
        ? exRaw
        : typeof exRaw === 'string'
          ? Number(exRaw)
          : null;

  return {
    amountCents,
    type,
    categoryName,
    occurredAt,
    note,
    paymentMethod: pm,
    tripId,
    currencyCode,
    amountBaseCents: amountBaseCents ?? null,
    exchangeRateToBase: exchangeRateToBase ?? null,
  };
}

/** Validate a single proposed row (e.g. from AI or CSV) using the same rules as JSON import. */
export function parseImportRowObject(
  o: Record<string, unknown>,
  index: number,
): ParsedImportRow | { error: string } {
  const r = parseTxnRow(o, index);
  if ('error' in r) return r;
  return {
    ...r,
    amountBaseCents: r.amountBaseCents ?? r.amountCents,
    exchangeRateToBase: r.exchangeRateToBase ?? 1,
  };
}

export function parseTransactionImportJson(
  text: string,
):
  | { ok: true; version: number; trips: TripJsonRow[]; rows: ParsedImportRow[] }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }

  let version = 1;
  if (parsed && typeof parsed === 'object' && 'version' in parsed) {
    const v = (parsed as { version: unknown }).version;
    if (typeof v === 'number' && Number.isInteger(v) && v >= 1) {
      version = v;
    }
  }

  const tripsOut: TripJsonRow[] = [];
  if (parsed && typeof parsed === 'object' && 'trips' in parsed) {
    const ta = (parsed as { trips: unknown }).trips;
    if (ta !== undefined && ta !== null && !Array.isArray(ta)) {
      return { ok: false, error: '"trips" must be an array when present.' };
    }
    if (Array.isArray(ta)) {
      for (let i = 0; i < ta.length; i++) {
        const item = ta[i];
        if (!item || typeof item !== 'object') {
          return { ok: false, error: `Trip ${i + 1}: expected an object.` };
        }
        const r = parseTripFromObj(item as Record<string, unknown>, i);
        if ('error' in r) return { ok: false, error: r.error };
        tripsOut.push(r);
      }
    }
  }

  const arr = extractTransactionArray(parsed);
  if (!arr) {
    return { ok: false, error: 'Expected a JSON array or an object with a "transactions" array.' };
  }

  const rows: ParsedImportRow[] = [];
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (!item || typeof item !== 'object') {
      return { ok: false, error: `Row ${i + 1}: expected an object.` };
    }
    const o = item as Record<string, unknown>;
    const r = parseTxnRow(o, i);
    if ('error' in r) return { ok: false, error: r.error };
    if (version < 2) {
      rows.push({
        ...r,
        tripId: null,
        currencyCode: null,
        amountBaseCents: r.amountCents,
        exchangeRateToBase: 1,
      });
    } else {
      rows.push({
        ...r,
        amountBaseCents: r.amountBaseCents ?? r.amountCents,
        exchangeRateToBase: r.exchangeRateToBase ?? 1,
      });
    }
  }

  const tripIds = new Set(tripsOut.map((t) => t.id));
  for (let i = 0; i < rows.length; i++) {
    const tid = rows[i]!.tripId;
    if (tid && !tripIds.has(tid)) {
      return {
        ok: false,
        error: `Row ${i + 1}: tripId "${tid}" has no matching trip in the backup. Import trips first or fix the file.`,
      };
    }
  }

  return { ok: true, version, trips: tripsOut, rows };
}

export function buildTransactionExportPayload(
  tripRows: Trip[],
  txRows: TransactionWithCategory[],
  currencyCode: string,
): TransactionJsonExportPayload {
  return {
    version: TRANSACTION_JSON_VERSION,
    exportedAt: new Date().toISOString(),
    currencyCode,
    trips: tripRows.map((t) => ({
      id: t.id,
      name: t.name,
      startAt: t.startAt,
      endAt: t.endAt,
      status: t.status,
      createdAt: t.createdAt,
      metadata: t.metadata,
    })),
    transactions: txRows.map((r) => ({
      amountCents: r.amountCents,
      type: r.type,
      categoryName: r.categoryName,
      occurredAt: r.occurredAt,
      note: r.note ?? '',
      paymentMethod: r.paymentMethod,
      tripId: r.tripId,
      currencyCode: r.currencyCode,
      amountBaseCents: r.amountBaseCents ?? r.amountCents,
      exchangeRateToBase: r.exchangeRateToBase ?? 1,
    })),
  };
}

export function serializeTransactionsJson(
  tripRows: Trip[],
  txRows: TransactionWithCategory[],
  currencyCode: string,
): string {
  return JSON.stringify(buildTransactionExportPayload(tripRows, txRows, currencyCode), null, 2);
}

export async function readDocumentPickerAssetAsText(asset: DocumentPickerAsset): Promise<string> {
  if (asset.file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
      reader.readAsText(asset.file!);
    });
  }
  return FileSystem.readAsStringAsync(asset.uri);
}

export async function importTransactionRows(
  db: SQLiteDatabase,
  categories: CategoryRepository,
  trips: TripRepository,
  transactions: TransactionRepository,
  tripRows: TripJsonRow[],
  rows: ParsedImportRow[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const seenTrip = new Set<string>();
    for (const t of tripRows) {
      if (seenTrip.has(t.id)) continue;
      seenTrip.add(t.id);
      const existing = await trips.getById(t.id);
      if (!existing) {
        await trips.insert({
          id: t.id,
          name: t.name,
          startAt: t.startAt,
          endAt: t.endAt,
          status: t.status,
          metadata: t.metadata,
          createdAt: t.createdAt,
        });
      }
    }

    for (const row of rows) {
      let existingCat = await categories.findFirstByNameAndType(row.categoryName, row.type);
      let categoryId: string;
      if (existingCat) {
        categoryId = existingCat.id;
      } else {
        categoryId = await categories.insert({
          name: row.categoryName,
          type: row.type,
          iconKey: 'category',
        });
      }
      await transactions.insert(
        {
          id: await Crypto.randomUUID(),
          amountCents: row.amountCents,
          type: row.type,
          categoryId,
          occurredAt: row.occurredAt,
          note: row.note.trim() === '' ? null : row.note,
          paymentMethod: row.paymentMethod,
          tripId: row.tripId,
          currencyCode: row.currencyCode,
          amountBaseCents: row.amountBaseCents ?? row.amountCents,
          exchangeRateToBase: row.exchangeRateToBase ?? 1,
        },
        { skipOuterTransaction: true },
      );
    }
  });
}
