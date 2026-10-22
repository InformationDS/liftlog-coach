import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createLlmClient, type AiCallLog, type JsonRequest } from '../core/llm/client';
import { DEFAULT_SETTINGS } from '../core/settings/settings';
import { buildTestConnection } from '../core/prompts/builder';
import { JSON_RETRY } from '../core/prompts/templates';

let sequence = 0;
const settings = () => ({...DEFAULT_SETTINGS, apiBaseUrl: `https://fixture-${++sequence}.test/v1`, apiKey: 'fixture-only'});
const ok = (content: string) => new Response(JSON.stringify({choices: [{message: {content}}]}));
const bad = (status: number, message = 'private provider error', code = 'invalid_request_error') => new Response(JSON.stringify({error: {message, code}}), {status});
const request: JsonRequest<{answer: string}> = {messages: [{role: 'system', content: 'Return JSON.'}, {role: 'user', content: 'ping'}], temperature: 0, maxTokens: 100, expectJson: true, schema: z.object({answer: z.string()})};
const bodyAt = (mock: ReturnType<typeof vi.fn<typeof fetch>>, index: number): Record<string, unknown> => JSON.parse(String(mock.mock.calls[index][1]?.body)) as Record<string, unknown>;
afterEach(() => vi.useRealTimers());

it('sends exact P6 text parameters, headers and direct URL with one log', async () => {
  const config = settings(); const fetcher = vi.fn<typeof fetch>().mockResolvedValue(ok('anything nonempty'));
  const onLog = vi.fn(); const clock = vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(35);
  const result = await createLlmClient(config, {fetch: fetcher, now: clock, onLog}).call('test_connection', buildTestConnection());
  expect(result.ok && result.data).toBe('anything nonempty');
  expect(fetcher.mock.calls[0][0]).toBe(`${config.apiBaseUrl}/chat/completions`);
  expect(fetcher.mock.calls[0][1]).toMatchObject({method: 'POST', credentials: 'omit', redirect: 'error', headers: {Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json'}});
  expect(bodyAt(fetcher, 0)).toEqual({model: config.model, messages: [{role: 'system', content: 'Reply with the single word OK.'}, {role: 'user', content: 'ping'}], temperature: 0, max_tokens: 50});
  expect(result.logs).toHaveLength(1); expect(onLog).toHaveBeenCalledOnce();
  expect(result.log).toMatchObject({purpose: 'test_connection', attempt: 'first', latencyMs: 25, rawResponse: 'anything nonempty', parsed: null, repaired: false, retried: false});
  expect(result.log?.request).not.toHaveProperty('headers');
});
it('missing key creates zero network requests and zero network logs', async () => {
  const fetcher = vi.fn<typeof fetch>(); const onLog = vi.fn();
  expect(await createLlmClient({...settings(), apiKey: '  '}, {fetch: fetcher, onLog}).call('test_connection', buildTestConnection())).toEqual({ok: false, error: 'no_key', log: null, logs: []});
  expect(fetcher).not.toHaveBeenCalled(); expect(onLog).not.toHaveBeenCalled();
});
it.each([[401, 'unauthorized'], [403, 'unauthorized'], [404, 'model_not_found'], [429, 'rate_limited'], [500, 'server'], [503, 'server'], [400, 'server'], [422, 'server']])('maps HTTP %s to %s without automatic retry', async (status, error) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(bad(Number(status)));
  const result = await createLlmClient(settings(), {fetch: fetcher}).call('classify', request);
  expect(result).toMatchObject({ok: false, error, log: {error: {kind: error, status}}});
  expect(fetcher).toHaveBeenCalledOnce(); expect(result.logs).toHaveLength(1);
});
it('network exceptions never expose their message or retry', async () => {
  const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('private provider detail'));
  const result = await createLlmClient(settings(), {fetch: fetcher}).call('classify', request);
  expect(result).toMatchObject({ok: false, error: 'network', log: {error: {kind: 'network', status: null, providerCode: null}}});
  expect(JSON.stringify(result)).not.toContain('private provider detail'); expect(fetcher).toHaveBeenCalledOnce();
});
it('aborts at exactly 30 seconds using fake timers, clears timer and never retries', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('private detail', 'AbortError')))));
  const pending = createLlmClient(settings(), {fetch: fetcher}).call('classify', request);
  await vi.advanceTimersByTimeAsync(29_999); expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(await pending).toMatchObject({ok: false, error: 'timeout', log: {latencyMs: 30_000}});
  expect(fetcher).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
});
it('keeps response-body reading under the same timeout', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => ({ok: true, status: 200, json: () => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('', 'AbortError'))))}) as Response);
  const pending = createLlmClient(settings(), {fetch: fetcher}).call('test_connection', buildTestConnection());
  await vi.advanceTimersByTimeAsync(30_000); expect(await pending).toMatchObject({ok: false, error: 'timeout'});
});
it('falls back once and caches incompatibility across clients, isolated by URL and model', async () => {
  const config = settings();
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(bad(400, 'response_format unsupported')).mockImplementation(async () => ok('{"answer":"yes"}'));
  const first = await createLlmClient(config, {fetch: fetcher}).call('classify', request);
  expect(first.logs.map((log) => log.attempt)).toEqual(['first', 'json_mode_fallback']);
  expect(first.logs.map((log) => log.request.jsonMode)).toEqual([true, false]);
  await createLlmClient({...config, apiBaseUrl: config.apiBaseUrl + '/'}, {fetch: fetcher}).call('classify', request);
  await createLlmClient({...config, model: 'other-model'}, {fetch: fetcher}).call('classify', request);
  await createLlmClient({...config, apiBaseUrl: config.apiBaseUrl + '/other'}, {fetch: fetcher}).call('classify', request);
  expect([0, 1, 2, 3, 4].map((i) => bodyAt(fetcher, i).response_format)).toEqual([{type: 'json_object'}, undefined, undefined, {type: 'json_object'}, {type: 'json_object'}]);
});
it('does not repeatedly downgrade when fallback also fails', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => bad(400, 'response_format unsupported'));
  const result = await createLlmClient(settings(), {fetch: fetcher}).call('classify', request);
  expect(result.ok).toBe(false); expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each([403, 429, 500])('does not downgrade status %s even with response_format in body', async (status) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(bad(status, 'response_format'));
  await createLlmClient(settings(), {fetch: fetcher}).call('classify', request); expect(fetcher).toHaveBeenCalledOnce();
});
it('repairs validatable JSON without retry', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(ok("```json\n{'answer':'yes',}\n```"));
  const result = await createLlmClient(settings(), {fetch: fetcher}).call('classify', request);
  expect(result).toMatchObject({ok: true, data: {answer: 'yes'}, log: {repaired: true, parsed: {answer: 'yes'}}}); expect(fetcher).toHaveBeenCalledOnce();
});
it.each(['not JSON', '{"answer":2}'])('retries JSON/schema failure once with original messages plus P5: %s', async (invalid) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(ok(invalid)).mockResolvedValueOnce(ok('{"answer":"fixed"}'));
  const result = await createLlmClient(settings(), {fetch: fetcher}).call('classify', request);
  expect(result).toMatchObject({ok: true, data: {answer: 'fixed'}});
  expect(result.logs.map((log) => [log.purpose, log.attempt])).toEqual([['classify', 'first'], ['classify', 'json_retry']]);
  expect(bodyAt(fetcher, 1).messages).toEqual([...request.messages, {role: 'assistant', content: invalid}, {role: 'user', content: JSON_RETRY}]);
  expect(request.messages).toHaveLength(2);
});
it.each(['not JSON', '{"answer":false}'])('unifies final JSON/schema failure as invalid_json: %s', async (invalid) => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => ok(invalid));
  const result = await createLlmClient(settings(), {fetch: fetcher}).call('classify', request);
  expect(result).toMatchObject({ok: false, error: 'invalid_json'}); expect(result.logs).toHaveLength(2); expect(fetcher).toHaveBeenCalledTimes(2);
});
it('counts fallback and JSON retry separately, with no fourth request', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(bad(400, 'response_format unsupported')).mockResolvedValueOnce(ok('bad')).mockResolvedValueOnce(ok('still bad'));
  const onLog = vi.fn(); const result = await createLlmClient(settings(), {fetch: fetcher, onLog}).call('classify', request);
  expect(result.logs.map((log) => log.attempt)).toEqual(['first', 'json_mode_fallback', 'json_retry']);
  expect(result.logs.every((log) => log.purpose === 'classify')).toBe(true);
  expect(result).toMatchObject({ok: false, error: 'invalid_json'}); expect(fetcher).toHaveBeenCalledTimes(3); expect(onLog).toHaveBeenCalledTimes(3);
});
it('network failure during a JSON retry stops immediately', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(ok('bad')).mockRejectedValueOnce(new TypeError());
  const result = await createLlmClient(settings(), {fetch: fetcher}).call('classify', request);
  expect(result).toMatchObject({ok: false, error: 'network'}); expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each(['', '   '])('P6 rejects empty content %j without JSON retry', async (content) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(ok(content));
  expect(await createLlmClient(settings(), {fetch: fetcher}).call('test_connection', buildTestConnection())).toMatchObject({ok: false, error: 'invalid_json'});
  expect(fetcher).toHaveBeenCalledOnce();
});
it('retries malformed successful envelopes as invalid JSON', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response('not an envelope'));
  const result = await createLlmClient(settings(), {fetch: fetcher}).call('classify', request);
  expect(result).toMatchObject({ok: false, error: 'invalid_json'}); expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each(['not-a-url', 'ftp://example.test', 'https://user:pass@example.test', 'https://example.test/?key=private', 'https://example.test/#private'])('rejects malformed/credential-bearing address locally: %s', async (url) => {
  const fetcher = vi.fn<typeof fetch>(); const onLog = vi.fn<(log: AiCallLog) => void>();
  const result = await createLlmClient({...settings(), apiBaseUrl: url}, {fetch: fetcher, onLog}).call('test_connection', buildTestConnection());
  expect(result).toEqual({ok: false, error: 'network', log: null, logs: []}); expect(fetcher).not.toHaveBeenCalled(); expect(onLog).not.toHaveBeenCalled();
});
