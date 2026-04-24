import type { Repositories } from '@/contexts/database-context';
import type { ParsedImportRow } from '@/lib/transaction-json';
import { executeAiTool, geminiToolDeclarations } from '@/lib/ai-tools';
import type { GeminiContent } from '@/lib/gemini-client';
import { geminiGenerateContent } from '@/lib/gemini-client';

const MAX_TOOL_ITERATIONS = 6;

/** If the API ever omits `parts`, rebuild tool calls with a documented escape hatch for validators. */
function syntheticModelPartsForToolCalls(
  text: string,
  calls: { name: string; args: Record<string, unknown> }[],
): unknown[] {
  const parts: unknown[] = [];
  if (text.trim()) {
    parts.push({ text: text.trim() });
  }
  for (const c of calls) {
    parts.push({
      functionCall: { name: c.name, args: c.args },
      thoughtSignature: 'skip_thought_signature_validator',
    });
  }
  return parts;
}

export async function runGeminiChatTurn(params: {
  apiKey: string;
  modelId: string;
  systemInstruction: string;
  priorContents: GeminiContent[];
  userText: string;
  repos: Repositories;
}): Promise<
  | {
      ok: true;
      contents: GeminiContent[];
      assistantText: string;
      proposedRows: ParsedImportRow[];
    }
  | { ok: false; error: string }
> {
  const { apiKey, modelId, systemInstruction, priorContents, userText, repos } = params;
  const contents: GeminiContent[] = [
    ...priorContents,
    { role: 'user', parts: [{ text: userText }] },
  ];

  const tools = geminiToolDeclarations();
  let proposedRows: ParsedImportRow[] = [];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const gen = await geminiGenerateContent(apiKey, modelId, {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      tools: [{ functionDeclarations: tools }],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    });

    if (!gen.ok) {
      return { ok: false, error: gen.error };
    }

    const calls = gen.functionCalls;

    if (calls.length === 0) {
      const text = gen.text?.trim() || 'Done.';
      const parts =
        gen.modelParts.length > 0 ? gen.modelParts : ([{ text }] as unknown[]);
      contents.push({
        role: 'model',
        parts,
      });
      return { ok: true, contents, assistantText: text, proposedRows };
    }

    const modelParts =
      gen.modelParts.length > 0 ? gen.modelParts : syntheticModelPartsForToolCalls(gen.text, calls);
    contents.push({ role: 'model', parts: modelParts });

    const responseParts: GeminiContent['parts'] = [];
    for (const c of calls) {
      const result = await executeAiTool(c.name, c.args, repos);
      if (result.name === 'propose_transactions' && 'response' in result) {
        const res = result.response;
        if (res.ok === true && Array.isArray(res.proposedTransactions) && res.proposedTransactions.length > 0) {
          proposedRows = res.proposedTransactions as ParsedImportRow[];
        }
      }
      if ('error' in result) {
        responseParts.push({
          functionResponse: {
            name: result.name,
            response: { error: result.error },
          },
        });
      } else {
        responseParts.push({
          functionResponse: {
            name: result.name,
            response: result.response,
          },
        });
      }
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  return {
    ok: false,
    error: 'Too many tool rounds. Try a simpler question.',
  };
}
