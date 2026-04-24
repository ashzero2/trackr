import { geminiGenerateText } from '@/lib/gemini-client';
import type { ParsedImportRow } from '@/lib/transaction-json';
import { parseImportRowObject } from '@/lib/transaction-json';
import { truncateCsvForLlm } from '@/lib/import-csv';

const SYSTEM = `You convert bank or wallet CSV samples into JSON for a personal finance app.
Output ONLY a valid JSON array. No markdown, no code fences, no commentary.
Each element must be an object with exactly these keys:
- amountCents (integer, minor units, always non-negative)
- type: "expense" or "income"
- categoryName (string, use "Imported" if unsure)
- occurredAt (ISO 8601 string)
- note (string, merchant or description)
- paymentMethod: one of CARD, CASH, ACH, OTHER
- tripId: always null
- currencyCode: ISO code string or null
- amountBaseCents: same as amountCents unless multi-currency
- exchangeRateToBase: 1

Skip failed/cancelled/pending rows. Infer expense vs income from signs or column meanings.`;

function extractJsonArray(text: string): unknown {
  const t = text.trim();
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start >= 0 && end > start) {
    return JSON.parse(t.slice(start, end + 1));
  }
  return JSON.parse(t);
}

export async function mapCsvWithGemini(
  apiKey: string,
  modelId: string,
  csvText: string,
): Promise<{ ok: true; rows: ParsedImportRow[] } | { ok: false; error: string }> {
  const sample = truncateCsvForLlm(csvText, 35);
  if (!sample.trim()) {
    return { ok: false, error: 'File is empty.' };
  }

  const user = `Map these CSV lines to the JSON array format. First line may be headers.\n\n${sample}`;
  const gen = await geminiGenerateText(apiKey, modelId, SYSTEM, user);
  if (!gen.ok) return gen;

  let parsed: unknown;
  try {
    parsed = extractJsonArray(gen.text);
  } catch {
    return { ok: false, error: 'Could not parse JSON from the model response.' };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'Expected a JSON array from the model.' };
  }

  if (parsed.length > 200) {
    return { ok: false, error: 'Model returned too many rows; try a smaller file or use a known CSV export.' };
  }

  const rows: ParsedImportRow[] = [];
  const errors: string[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (!item || typeof item !== 'object') {
      errors.push(`Row ${i + 1}: not an object.`);
      continue;
    }
    const r = parseImportRowObject(item as Record<string, unknown>, i);
    if ('error' in r) {
      errors.push(r.error);
    } else {
      rows.push(r);
    }
  }

  if (rows.length === 0) {
    return {
      ok: false,
      error: errors.length ? errors.slice(0, 5).join(' ') : 'No valid rows.',
    };
  }

  return { ok: true, rows };
}
