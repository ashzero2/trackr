import type { DocumentPickerAsset } from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { CategoryRepository } from '@/data/category-repository';
import type { TransactionRepository } from '@/data/transaction-repository';
import type { EntryType, PaymentMethod, TransactionWithCategory } from '@/types/finance';

export const TRANSACTION_JSON_VERSION = 1;

const PAYMENT_METHODS = new Set<PaymentMethod>(['VISA', 'CASH', 'ACH', 'OTHER']);

export type TransactionJsonExportRow = {
  amountCents: number;
  type: EntryType;
  categoryName: string;
  occurredAt: string;
  note: string;
  paymentMethod: PaymentMethod;
};

export type TransactionJsonExportPayload = {
  version: typeof TRANSACTION_JSON_VERSION;
  exportedAt: string;
  /** ISO 4217 code for minor units in `transactions` (app primary at export time). */
  currencyCode: string;
  transactions: TransactionJsonExportRow[];
};

export type ParsedImportRow = TransactionJsonExportRow;

function normalizePaymentMethod(raw: unknown): PaymentMethod | null {
  if (typeof raw !== 'string') return null;
  const u = raw.trim().toUpperCase();
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

/** Validates and normalizes rows from Trackr JSON export (or the same shape from older backups) or a plain array. */
export function parseTransactionImportJson(text: string): { ok: true; rows: ParsedImportRow[] } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
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

    const rawAmount = pickField(o, 'amountCents', 'amount_cents');
    const amountCents = typeof rawAmount === 'number' ? rawAmount : typeof rawAmount === 'string' ? Number(rawAmount) : NaN;
    if (!Number.isInteger(amountCents) || amountCents < 0) {
      return { ok: false, error: `Row ${i + 1}: "amountCents" must be a non-negative integer.` };
    }

    const type = asEntryType(o.type);
    if (!type) {
      return { ok: false, error: `Row ${i + 1}: "type" must be "expense" or "income".` };
    }

    const categoryName = asNonEmptyString(pickField(o, 'categoryName', 'category_name'));
    if (!categoryName) {
      return { ok: false, error: `Row ${i + 1}: "categoryName" is required.` };
    }

    const occurredRaw = pickField(o, 'occurredAt', 'occurred_at');
    const occurredAt = typeof occurredRaw === 'string' ? occurredRaw.trim() : '';
    if (!occurredAt || Number.isNaN(Date.parse(occurredAt))) {
      return { ok: false, error: `Row ${i + 1}: "occurredAt" must be a valid ISO date string.` };
    }

    const pm = normalizePaymentMethod(pickField(o, 'paymentMethod', 'payment_method'));
    if (!pm) {
      return { ok: false, error: `Row ${i + 1}: "paymentMethod" must be one of VISA, CASH, ACH, OTHER.` };
    }

    let note = '';
    const noteRaw = o.note;
    if (noteRaw === null || noteRaw === undefined) {
      note = '';
    } else if (typeof noteRaw === 'string') {
      note = noteRaw;
    } else {
      return { ok: false, error: `Row ${i + 1}: "note" must be a string if present.` };
    }

    rows.push({
      amountCents,
      type,
      categoryName,
      occurredAt,
      note,
      paymentMethod: pm,
    });
  }

  return { ok: true, rows };
}

export function buildTransactionExportPayload(
  rows: TransactionWithCategory[],
  currencyCode: string,
): TransactionJsonExportPayload {
  return {
    version: TRANSACTION_JSON_VERSION,
    exportedAt: new Date().toISOString(),
    currencyCode,
    transactions: rows.map((r) => ({
      amountCents: r.amountCents,
      type: r.type,
      categoryName: r.categoryName,
      occurredAt: r.occurredAt,
      note: r.note ?? '',
      paymentMethod: r.paymentMethod,
    })),
  };
}

export function serializeTransactionsJson(rows: TransactionWithCategory[], currencyCode: string): string {
  return JSON.stringify(buildTransactionExportPayload(rows, currencyCode), null, 2);
}

/** Web provides `file`; native uses `uri` readable by expo-file-system. */
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

/** Inserts rows in one DB transaction; creates categories when no name+type match exists. */
export async function importTransactionRows(
  db: SQLiteDatabase,
  categories: CategoryRepository,
  transactions: TransactionRepository,
  rows: ParsedImportRow[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      let existing = await categories.findFirstByNameAndType(row.categoryName, row.type);
      let categoryId: string;
      if (existing) {
        categoryId = existing.id;
      } else {
        categoryId = await categories.insert({
          name: row.categoryName,
          type: row.type,
          iconKey: 'category',
        });
      }
      await transactions.insert({
        id: await Crypto.randomUUID(),
        amountCents: row.amountCents,
        type: row.type,
        categoryId,
        occurredAt: row.occurredAt,
        note: row.note.trim() === '' ? null : row.note,
        paymentMethod: row.paymentMethod,
      });
    }
  });
}
