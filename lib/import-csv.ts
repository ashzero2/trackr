import type { EntryType } from '@/types/finance';
import type { ParsedImportRow } from '@/lib/transaction-json';

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && ch === delimiter) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export function splitCsvLines(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd());
  return lines.filter((l) => l.length > 0);
}

export function detectDelimiter(firstLine: string): string {
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const semi = (firstLine.match(/;/g) || []).length;
  if (tabs >= commas && tabs >= semi && tabs > 0) return '\t';
  if (semi > commas) return ';';
  return ',';
}

export function parseCsvRows(text: string): string[][] {
  const lines = splitCsvLines(text);
  if (lines.length === 0) return [];
  const delim = detectDelimiter(lines[0]!);
  return lines.map((ln) => parseCsvLine(ln, delim));
}

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9/_\s-]/g, '');
}

function findCol(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normHeader);
  for (const a of aliases) {
    const na = normHeader(a);
    const i = normalized.indexOf(na);
    if (i >= 0) return i;
  }
  for (let i = 0; i < normalized.length; i++) {
    for (const a of aliases) {
      if (normalized[i]!.includes(normHeader(a)) || normHeader(a).includes(normalized[i]!)) {
        return i;
      }
    }
  }
  return -1;
}

function parseAmountToCents(raw: string): number | null {
  if (!raw || !raw.trim()) return null;
  let s = raw.trim();
  const neg = /^-/.test(s) || /\([^)]+\)/.test(s);
  s = s.replace(/[()]/g, '');
  s = s.replace(/[$€£₹\s]/gi, '');
  s = s.replace(/,/g, '');
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(Math.abs(n) * 100);
  return neg ? -cents : cents;
}

const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}T/;

function parseDateToIso(raw: string): string | null {
  if (!raw || !raw.trim()) return null;

  const t = Date.parse(raw);
  if (!Number.isNaN(t)) {
    const iso = new Date(t).toISOString();
    // Ensure the result is a valid ISO date string (YYYY-MM-DDTHH:mm:ss)
    if (ISO_DATE_PREFIX.test(iso)) return iso;
  }

  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const mm = Number(m[1]);
    const dd = Number(m[2]);
    const yy = Number(m[3]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yy < 1900 || yy > 2100) return null;
    const d = new Date(Date.UTC(yy, mm - 1, dd, 12, 0, 0));
    if (!Number.isNaN(d.getTime())) {
      const iso = d.toISOString();
      if (ISO_DATE_PREFIX.test(iso)) return iso;
    }
  }

  return null;
}

function isCompletedStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  if (!s) return true;
  if (s.includes('fail') || s.includes('declin') || s.includes('cancel')) return false;
  if (s.includes('pending')) return false;
  return true;
}

function inferTypeFromRow(amountCents: number, typeCol: string, desc: string): EntryType {
  const t = typeCol.toLowerCase();
  const d = desc.toLowerCase();
  if (t.includes('income') || t.includes('credit') || t.includes('received') || t.includes('refund')) {
    return 'income';
  }
  if (t.includes('expense') || t.includes('debit') || t.includes('sent') || t.includes('payment')) {
    return 'expense';
  }
  if (amountCents < 0) return 'income';
  return 'expense';
}

/**
 * Heuristic import for payment-activity style CSV (e.g. pay.google.com export, generic bank CSV).
 * Maps rows to ParsedImportRow with category "Imported".
 */
export function tryParseBankOrWalletCsv(text: string): { ok: true; rows: ParsedImportRow[] } | { ok: false } {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return { ok: false };

  const headers = rows[0]!.map((h) => h.trim());
  const dateIx = findCol(headers, [
    'date',
    'transaction date',
    'datetime',
    'time',
    'posted date',
    'value date',
  ]);
  const amountIx = findCol(headers, [
    'amount',
    'net amount',
    'transaction amount',
    'debit',
    'credit',
    'total',
  ]);
  const merchantIx = findCol(headers, [
    'merchant',
    'merchant/payee',
    'payee',
    'description',
    'name',
    'counterparty',
    'details',
    'note',
    'notes',
  ]);
  const statusIx = findCol(headers, ['status', 'transaction status']);
  const typeIx = findCol(headers, ['transaction type', 'type', 'dr/cr']);
  const currencyIx = findCol(headers, ['currency', 'currency code']);

  if (dateIx < 0 || amountIx < 0 || merchantIx < 0) {
    return { ok: false };
  }

  const out: ParsedImportRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]!;
    if (cells.every((c) => !c.trim())) continue;

    const dateRaw = cells[dateIx] ?? '';
    const amountRaw = cells[amountIx] ?? '';
    const merchant = (cells[merchantIx] ?? '').trim() || 'Transaction';
    const status = statusIx >= 0 ? (cells[statusIx] ?? '').trim() : '';
    const typeCol = typeIx >= 0 ? (cells[typeIx] ?? '').trim() : '';
    const currency = currencyIx >= 0 ? (cells[currencyIx] ?? '').trim() : '';

    if (!isCompletedStatus(status)) continue;

    const occurredAt = parseDateToIso(dateRaw);
    if (!occurredAt) continue;

    const signedCents = parseAmountToCents(amountRaw);
    if (signedCents === null) continue;
    const amountCents = Math.abs(signedCents);
    if (amountCents === 0) continue;

    const type = inferTypeFromRow(signedCents, typeCol, merchant);

    out.push({
      amountCents,
      type,
      categoryName: 'Imported',
      occurredAt,
      note: merchant,
      paymentMethod: 'OTHER',
      tripId: null,
      currencyCode: currency || null,
      amountBaseCents: amountCents,
      exchangeRateToBase: 1,
    });
  }

  if (out.length === 0) return { ok: false };
  return { ok: true, rows: out };
}

export function truncateCsvForLlm(text: string, maxLines: number): string {
  const lines = splitCsvLines(text);
  return lines.slice(0, maxLines).join('\n');
}
