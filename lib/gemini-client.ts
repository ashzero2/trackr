/** Outbound user parts we construct in-app (text + tool results). */
export type GeminiUserPart =
  | { text: string }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

/**
 * Conversation turn: user parts are built locally; model parts must be copied verbatim from
 * API responses so fields like `thoughtSignature` / `thought_signature` are preserved (required
 * for Gemini 2.5+/3 tool calling).
 */
export type GeminiContent = {
  role: 'user' | 'model';
  parts: unknown[];
};

export type GenerateContentRequestBody = {
  systemInstruction?: { parts: { text: string }[] };
  contents: GeminiContent[];
  tools?: { functionDeclarations: GeminiFunctionDeclaration[] }[];
  toolConfig?: {
    functionCallingConfig: {
      mode: 'AUTO' | 'ANY' | 'NONE';
    };
  };
};

export type GeminiFunctionDeclaration = {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
};

export type GenerateContentResponse = {
  candidates?: {
    content?: {
      parts?: unknown[];
      role?: string;
    };
    finishReason?: string;
  }[];
  error?: { code?: number; message?: string; status?: string };
  promptFeedback?: { blockReason?: string };
};

function getFunctionCallObj(part: unknown): { name?: string; args?: unknown } | null {
  if (!part || typeof part !== 'object') return null;
  const o = part as Record<string, unknown>;
  const fc = (o.functionCall ?? o.function_call) as Record<string, unknown> | undefined;
  if (!fc || typeof fc !== 'object') return null;
  const name = typeof fc.name === 'string' ? fc.name : undefined;
  if (!name) return null;
  return { name, args: fc.args };
}

function extractText(parts: unknown[] | undefined): string {
  if (!parts?.length) return '';
  let s = '';
  for (const p of parts) {
    if (!p || typeof p !== 'object') continue;
    const o = p as Record<string, unknown>;
    const text = o.text;
    if (typeof text === 'string') s += text;
  }
  return s;
}

function extractFunctionCalls(parts: unknown[] | undefined): { name: string; args: Record<string, unknown> }[] {
  if (!parts?.length) return [];
  const out: { name: string; args: Record<string, unknown> }[] = [];
  for (const p of parts) {
    const fc = getFunctionCallObj(p);
    if (!fc?.name) continue;
    let args: Record<string, unknown> = {};
    const raw = fc.args;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      args = raw as Record<string, unknown>;
    } else if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          args = parsed as Record<string, unknown>;
        }
      } catch {
        args = {};
      }
    }
    out.push({ name: fc.name, args });
  }
  return out;
}

/** Deep clone of model `parts` from the API for replay in the next request. */
export function cloneModelPartsFromResponse(raw: GenerateContentResponse): unknown[] {
  const parts = raw.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return [];
  return JSON.parse(JSON.stringify(parts)) as unknown[];
}

export async function geminiGenerateContent(
  apiKey: string,
  modelId: string,
  body: GenerateContentRequestBody,
): Promise<
  | {
      ok: true;
      text: string;
      functionCalls: { name: string; args: Record<string, unknown> }[];
      modelParts: unknown[];
      raw: GenerateContentResponse;
    }
  | { ok: false; error: string }
> {
  const model = modelId.includes('/') ? modelId : `models/${modelId}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });
    const raw = (await res.json()) as GenerateContentResponse;
    if (!res.ok) {
      const msg = raw.error?.message || `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }
    if (raw.promptFeedback?.blockReason) {
      return { ok: false, error: `Blocked: ${raw.promptFeedback.blockReason}` };
    }
    const parts = raw.candidates?.[0]?.content?.parts;
    const text = extractText(parts);
    const functionCalls = extractFunctionCalls(parts);
    const modelParts = cloneModelPartsFromResponse(raw);
    return { ok: true, text, functionCalls, modelParts, raw };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** One-shot text generation (no tools), for CSV mapping etc. */
export async function geminiGenerateText(
  apiKey: string,
  modelId: string,
  systemInstruction: string,
  userText: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const r = await geminiGenerateContent(apiKey, modelId, {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
  });
  if (!r.ok) return r;
  return { ok: true, text: r.text };
}
