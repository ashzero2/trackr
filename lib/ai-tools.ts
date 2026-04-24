import type { Repositories } from '@/contexts/database-context';
import type { ParsedImportRow } from '@/lib/transaction-json';
import { parseImportRowObject } from '@/lib/transaction-json';
import type { GeminiFunctionDeclaration } from '@/lib/gemini-client';

const TX_PROPOSE_ITEM_SCHEMA = {
  type: 'object',
  description: 'One transaction to add later after user confirms in the app.',
  properties: {
    amountCents: { type: 'integer', description: 'Amount in minor units (e.g. cents), non-negative integer.' },
    type: { type: 'string', enum: ['expense', 'income'] },
    categoryName: { type: 'string', description: 'Category label; created if missing.' },
    occurredAt: { type: 'string', description: 'ISO 8601 datetime.' },
    note: { type: 'string', description: 'Optional memo.' },
    paymentMethod: { type: 'string', enum: ['CARD', 'CASH', 'ACH', 'OTHER'] },
    tripId: { type: 'string', description: 'Optional existing trip id, or omit.' },
    currencyCode: { type: 'string', description: 'ISO 4217 or omit for default.' },
  },
  required: ['amountCents', 'type', 'categoryName', 'occurredAt', 'paymentMethod'],
} as const;

export function geminiToolDeclarations(): GeminiFunctionDeclaration[] {
  return [
    {
      name: 'list_categories',
      description: 'List all expense and income categories with their type.',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'month_summary',
      description: 'Total expense and income cents for a calendar month (UTC).',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'integer' },
          month: { type: 'integer', description: '1-12' },
        },
        required: ['year', 'month'],
      },
    },
    {
      name: 'list_transactions',
      description: 'List transactions in a date range (ISO), newest first. Max 200.',
      parameters: {
        type: 'object',
        properties: {
          startIso: { type: 'string', description: 'Inclusive start, ISO 8601.' },
          endIso: { type: 'string', description: 'Exclusive end, ISO 8601.' },
          limit: { type: 'integer', description: 'Max rows, default 50, max 200.' },
        },
        required: ['startIso', 'endIso'],
      },
    },
    {
      name: 'propose_transactions',
      description:
        'Propose new transactions to import. Does not write to the database. User must confirm in the app. Use for bulk adds.',
      parameters: {
        type: 'object',
        properties: {
          transactions: {
            type: 'array',
            items: TX_PROPOSE_ITEM_SCHEMA,
          },
        },
        required: ['transactions'],
      },
    },
  ];
}

export type ToolResult =
  | { name: string; response: Record<string, unknown> }
  | { name: string; error: string };

export async function executeAiTool(
  name: string,
  args: Record<string, unknown>,
  repos: Repositories,
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'list_categories': {
        const rows = await repos.categories.listAll();
        return {
          name,
          response: {
            categories: rows.map((c) => ({
              id: c.id,
              name: c.name,
              type: c.type,
            })),
          },
        };
      }
      case 'month_summary': {
        const year = Number(args.year);
        const month = Number(args.month);
        if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
          return { name, error: 'Invalid year or month.' };
        }
        const s = await repos.transactions.summaryForMonth(year, month);
        return {
          name,
          response: {
            year,
            month,
            totalExpenseCents: s.totalExpenseCents,
            totalIncomeCents: s.totalIncomeCents,
          },
        };
      }
      case 'list_transactions': {
        const startIso = typeof args.startIso === 'string' ? args.startIso : '';
        const endIso = typeof args.endIso === 'string' ? args.endIso : '';
        const limitRaw = args.limit;
        const limit =
          typeof limitRaw === 'number' && Number.isFinite(limitRaw)
            ? Math.min(200, Math.max(1, Math.floor(limitRaw)))
            : 50;
        if (!startIso || !endIso || Number.isNaN(Date.parse(startIso)) || Number.isNaN(Date.parse(endIso))) {
          return { name, error: 'startIso and endIso must be valid ISO date strings.' };
        }
        const rows = await repos.transactions.listBetween(startIso, endIso, limit);
        return {
          name,
          response: {
            transactions: rows.map((t) => ({
              id: t.id,
              amountCents: t.amountCents,
              type: t.type,
              categoryName: t.categoryName,
              occurredAt: t.occurredAt,
              note: t.note ?? '',
              paymentMethod: t.paymentMethod,
              tripId: t.tripId,
            })),
          },
        };
      }
      case 'propose_transactions': {
        const raw = args.transactions;
        if (!Array.isArray(raw)) {
          return { name, error: '"transactions" must be an array.' };
        }
        if (raw.length > 100) {
          return { name, error: 'At most 100 transactions per proposal.' };
        }
        const valid: ParsedImportRow[] = [];
        const errors: string[] = [];
        for (let i = 0; i < raw.length; i++) {
          const item = raw[i];
          if (!item || typeof item !== 'object') {
            errors.push(`Row ${i + 1}: expected object.`);
            continue;
          }
          const r = parseImportRowObject(item as Record<string, unknown>, i);
          if ('error' in r) {
            errors.push(r.error);
          } else {
            valid.push(r);
          }
        }
        return {
          name,
          response: {
            ok: errors.length === 0,
            validCount: valid.length,
            proposedTransactions: valid,
            validationErrors: errors,
          },
        };
      }
      default:
        return { name, error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { name, error: e instanceof Error ? e.message : String(e) };
  }
}
