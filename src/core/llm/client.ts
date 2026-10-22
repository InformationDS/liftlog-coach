import type { z } from 'zod';
import { copy } from '../copy';
import { JSON_RETRY } from '../prompts/templates';
import { normalizeApiBaseUrl, type Settings } from '../settings/settings';
import { parseJsonWithSchema } from './jsonRepair';

export type LlmError = 'no_key' | 'timeout' | 'network' | 'unauthorized' | 'model_not_found' | 'rate_limited' | 'server' | 'invalid_json';
export interface Message { role: 'system' | 'user' | 'assistant'; content: string }
interface BaseRequest { messages: Message[]; temperature: number; maxTokens?: number }
export interface TextRequest extends BaseRequest { expectJson: false }
export interface JsonRequest<T> extends BaseRequest { expectJson: true; schema: z.ZodType<T, z.ZodTypeDef, unknown> }
export interface AiCallLog {
  purpose: 'risk_check' | 'classify' | 'trend_interpretation' | 'advice' | 'test_connection';
  attempt: 'first' | 'json_mode_fallback' | 'json_retry';
  model: string;
  request: { messages: Message[]; temperature: number; jsonMode: boolean };
  rawResponse: string | null;
  parsed: unknown | null;
  repaired: boolean;
  retried: boolean;
  latencyMs: number;
  error: { kind: LlmError; status: number | null; providerCode: string | null } | null;
}
export type CallResult<T> = ({ ok: true; data: T } | { ok: false; error: LlmError }) & { log: AiCallLog | null; logs: AiCallLog[] };
export interface LlmClient {
  call(purpose: AiCallLog['purpose'], req: TextRequest): Promise<CallResult<string>>;
  call<T>(purpose: AiCallLog['purpose'], req: JsonRequest<T>): Promise<CallResult<T>>;
}
export function scrubSecrets(text: string, currentKey: string): string {
  const variants = currentKey ? [...new Set([currentKey, JSON.stringify(currentKey).slice(1, -1)])].sort((a, b) => b.length - a.length) : [];
  const exact = variants.reduce((safe, key) => safe.split(key).join('[redacted]'), text);
  return exact.replace(/sk-[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}/g, '[redacted]');
}
export function scrubValue(value: unknown, key: string): unknown {
  if (typeof value === 'string') return scrubSecrets(value, key);
  if (Array.isArray(value)) return value.map((item: unknown) => scrubValue(item, key));
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [scrubSecrets(name, key), scrubValue(item, key)]));
  return value;
}
const unsupportedJson = new Set<string>(); // Shared by client instances in this browser session.
const providerCodes = new Set(['invalid_api_key', 'model_not_found', 'rate_limit_exceeded', 'insufficient_quota', 'invalid_request_error', 'unsupported_parameter']);
const httpError = (status: number): LlmError => status === 401 || status === 403 ? 'unauthorized' : status === 404 ? 'model_not_found' : status === 429 ? 'rate_limited' : 'server';
export const llmErrorText = (kind: LlmError): string => ({
  no_key: copy.error.noKey, timeout: copy.error.timeout, network: copy.error.network,
  unauthorized: copy.error.unauthorized, model_not_found: copy.error.modelNotFound,
  rate_limited: copy.error.rateLimited, server: copy.error.network, invalid_json: copy.error.invalidJson,
})[kind];
const envelopeContent = (value: unknown): string | null => {
  if (!value || typeof value !== 'object' || !('choices' in value) || !Array.isArray(value.choices)) return null;
  const first: unknown = value.choices[0];
  if (!first || typeof first !== 'object' || !('message' in first)) return null;
  const message: unknown = first.message;
  return message && typeof message === 'object' && 'content' in message && typeof message.content === 'string' ? message.content : null;
};
export function createLlmClient(settings: Settings, dependencies: {
  fetch?: typeof fetch; now?: () => number; onLog?: (log: AiCallLog) => void;
} = {}): LlmClient {
  const fetcher = dependencies.fetch ?? fetch;
  const now = dependencies.now ?? (() => performance.now());
  async function call<T>(purpose: AiCallLog['purpose'], req: TextRequest | JsonRequest<T>): Promise<CallResult<T | string>> {
    const logs: AiCallLog[] = [];
    const finish = (result: {ok: true; data: T | string} | {ok: false; error: LlmError}): CallResult<T | string> => ({ ...result, log: logs.at(-1) ?? null, logs });
    if (!settings.apiKey.trim()) return finish({ok: false, error: 'no_key'});
    const base = normalizeApiBaseUrl(settings.apiBaseUrl);
    const cacheKey = JSON.stringify([base, settings.model]);
    const safeMessages = req.messages.map((message) => ({ ...message, content: scrubSecrets(message.content, settings.apiKey) }));
    let messages = safeMessages;
    let attempt: AiCallLog['attempt'] = 'first';
    let jsonRetried = false;
    for (;;) {
      const jsonMode = req.expectJson && !unsupportedJson.has(cacheKey);
      const log: AiCallLog = {
        purpose, attempt, model: scrubSecrets(settings.model, settings.apiKey),
        request: { messages: messages.map((m) => ({ ...m, content: scrubSecrets(m.content, settings.apiKey) })), temperature: req.temperature, jsonMode },
        rawResponse: null, parsed: null, repaired: false, retried: attempt !== 'first', latencyMs: 0, error: null,
      };
      const start = now();
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 30_000);
      let content: string | null = null;
      let fallback = false;
      let status: number | null = null;
      let requested = false;
      try {
        const url = new URL(base);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new TypeError();
        requested = true;
        const response = await fetcher(`${base}/chat/completions`, {
          method: 'POST', signal: controller.signal, redirect: 'error', credentials: 'omit',
          headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: settings.model, messages, temperature: req.temperature,
            ...(req.maxTokens === undefined ? {} : { max_tokens: req.maxTokens }),
            ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
          }),
        });
        status = response.status;
        if (!response.ok) {
          const body = await response.text(); // Inspect in memory only; never return/store the body.
          let providerCode: string | null = null;
          try {
            const parsed: unknown = JSON.parse(body);
            if (parsed && typeof parsed === 'object' && 'error' in parsed && parsed.error && typeof parsed.error === 'object' && 'code' in parsed.error && typeof parsed.error.code === 'string' && providerCodes.has(parsed.error.code)) providerCode = parsed.error.code;
          } catch { /* Non-JSON error bodies also remain private. */ }
          log.error = { kind: httpError(status), status, providerCode };
          fallback = status === 400 && jsonMode && body.includes('response_format') && !unsupportedJson.has(cacheKey);
          if (fallback) unsupportedJson.add(cacheKey);
        } else {
          let envelope: unknown;
          try { envelope = await response.json(); }
          catch (error) { if (timedOut || error instanceof TypeError) throw error; }
          content = envelopeContent(envelope);
          log.rawResponse = content === null ? null : scrubSecrets(content, settings.apiKey);
        }
      } catch { log.error = { kind: timedOut ? 'timeout' : 'network', status, providerCode: null }; }
      finally { clearTimeout(timer); log.latencyMs = Math.max(0, now() - start); }
      let data: T | string | undefined;
      if (!log.error) {
        if (req.expectJson) {
          const parsed = parseJsonWithSchema(content ?? '', req.schema);
          if (parsed.ok) { data = parsed.data; log.parsed = scrubValue(data, settings.apiKey); log.repaired = parsed.repaired; }
          else log.error = {kind: 'invalid_json', status, providerCode: null};
        } else if (content?.trim()) data = content;
        else log.error = {kind: 'invalid_json', status, providerCode: null};
      }
      const retryJson = req.expectJson && log.error?.kind === 'invalid_json' && !jsonRetried;
      log.retried ||= fallback || retryJson;
      if (requested) { logs.push(log); dependencies.onLog?.(log); }
      if (fallback) { attempt = 'json_mode_fallback'; continue; }
      if (retryJson) {
        jsonRetried = true; attempt = 'json_retry';
        messages = [...safeMessages, {role: 'assistant', content: scrubSecrets(content ?? '', settings.apiKey)}, {role: 'user', content: JSON_RETRY}];
        continue;
      }
      if (log.error) return finish({ok: false, error: log.error.kind});
      return finish({ok: true, data: scrubValue(data, settings.apiKey) as T | string});
    }
  }
  return { call } as LlmClient;
}
