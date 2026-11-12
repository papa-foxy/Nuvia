/**
 * Server-only Gemini client shared by every AI route.
 *
 * Speed and cost come from four choices:
 * - Flash-Lite first: the cheapest, fastest tier (~3 s for a meal); plenty for
 *   nutrition and workout parsing.
 * - Thinking set to "minimal" everywhere: hidden reasoning tokens are billed as
 *   output and were doubling latency (~10 s → ~5 s on 3.5 Flash) without
 *   changing the estimates in testing.
 * - A short per-attempt timeout, so a slow model falls through to the next.
 * - A one-minute cooldown for a model that just failed (503 overloaded, 429
 *   quota, timeout), so the next requests skip it instead of waiting again.
 *
 * Prices per 1M tokens, paid tier (Google pricing page, Nov 2026):
 *   3.5 Flash-Lite  $0.30 in / $2.50 out
 *   3.6 Flash       $0.75 / $3.75 (doubles from 1 Jan 2027)
 *   3.1 Flash-Lite  $0.25 / $1.50
 * gemini-3.5-flash is no longer on the pricing page but still answers; it
 * stays as a dependable fallback because Flash-Lite often returns 503s.
 */

export interface GeminiModelChoice {
  model: string;
  thinkingLevel: 'minimal' | 'low' | 'medium' | 'high';
  /** Share of the request's timeout this model gets. */
  timeoutShare: number;
}

export const GEMINI_CHAIN: GeminiModelChoice[] = [
  { model: 'gemini-3.5-flash-lite', thinkingLevel: 'minimal', timeoutShare: 0.5 },
  { model: 'gemini-3.5-flash', thinkingLevel: 'minimal', timeoutShare: 1 },
  { model: 'gemini-3.6-flash', thinkingLevel: 'minimal', timeoutShare: 1 },
  { model: 'gemini-3.1-flash-lite', thinkingLevel: 'minimal', timeoutShare: 0.5 },
];

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const COOLDOWN_MS = 60_000;
/** model → time until which it is skipped (per server instance). */
const coolingUntil = new Map<string, number>();

export interface GeminiRequest {
  contents: unknown[];
  generationConfig?: Record<string, unknown>;
  systemInstruction?: unknown;
  /** Max wait for a full-share model before trying the next one. */
  timeoutMs?: number;
  /** Label for logs. */
  task?: string;
}

/** Returns the reply text from the first model that answers, or null. */
export async function geminiGenerate(req: GeminiRequest): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const { contents, generationConfig = {}, systemInstruction, timeoutMs = 15_000, task = 'gemini' } = req;

  const now = Date.now();
  const ready = GEMINI_CHAIN.filter((c) => (coolingUntil.get(c.model) ?? 0) <= now);
  // If every model is cooling down, try them all anyway rather than give up.
  const chain = ready.length > 0 ? ready : GEMINI_CHAIN;

  for (const { model, thinkingLevel, timeoutShare } of chain) {
    const started = Date.now();
    const limit = Math.round(timeoutMs * timeoutShare);
    try {
      const res = await fetch(`${API}/${model}:generateContent`, {
        method: 'POST',
        // Key in a header, not the URL, so it never shows up in request logs.
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents,
          ...(systemInstruction ? { systemInstruction } : {}),
          generationConfig: { ...generationConfig, thinkingConfig: { thinkingLevel } },
        }),
        signal: AbortSignal.timeout(limit),
      });
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) coolingUntil.set(model, Date.now() + COOLDOWN_MS);
        console.warn(`[${task}] ${model} failed (${res.status}) after ${Date.now() - started} ms`);
        continue;
      }
      const data = await res.json();
      const parts: { text?: string; thought?: boolean }[] = data.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .filter((p) => !p.thought && typeof p.text === 'string')
        .map((p) => p.text)
        .join('');
      if (text) {
        coolingUntil.delete(model);
        return text;
      }
      console.warn(`[${task}] ${model} returned no text`);
    } catch (err) {
      const timedOut = err instanceof Error && err.name === 'TimeoutError';
      if (timedOut) coolingUntil.set(model, Date.now() + COOLDOWN_MS);
      console.warn(`[${task}] ${model} ${timedOut ? `timed out after ${limit} ms` : String(err)}`);
    }
  }
  return null;
}
