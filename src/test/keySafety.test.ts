import { expect, it, vi } from 'vitest';
import {harness,classified,record} from './cp4Fixtures';
import {handleMessage} from '../core/pipeline/handleMessage';
import {generateSeedSessions} from '../core/db/seed';
import {NOW} from './cp4Fixtures';
import {fullTraceJson,testLogRow} from '../core/trace/export';
import {llmErrorText} from '../core/llm/client';
import { z } from 'zod';
import { createLlmClient, scrubSecrets, type AiCallLog } from '../core/llm/client';
import { DEFAULT_SETTINGS } from '../core/settings/settings';
import { buildTestConnection } from '../core/prompts/builder';

const key = 'sk-test-SECRET123';
const config = {...DEFAULT_SETTINGS, apiKey: key};
it('scrubs the exact key including arbitrary punctuation, and both required patterns', () => {
  expect(scrubSecrets(`${key} sk-abcdefgh12345 AIza${'a'.repeat(20)} ${key}`, key)).toBe('[redacted] [redacted] [redacted] [redacted]');
  expect(scrubSecrets('odd.+[key] odd.+[key]', 'odd.+[key]')).toBe('[redacted] [redacted]');
  expect(scrubSecrets('plain', '')).toBe('plain');
});
it('scrubs the current key in JSON data strings even when it contains escaped quotes/newlines',async()=>{
  const unusual='fixture."quoted\nkey';const result=await createLlmClient({...config,apiKey:unusual},{fetch:async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({text:unusual})}}]}))}).call('advice',{messages:[{role:'user',content:JSON.stringify({notes:unusual})}],temperature:0,expectJson:false});
  expect(JSON.stringify(result)).not.toContain('quoted');expect(JSON.stringify(result)).toContain('[redacted]');
});
it('retains only allowed error metadata and never exposes an echoed masked key or body', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({error: {message: 'Incorrect API key provided: sk-test-****123', code: 'invalid_api_key'}}), {status: 401}));
  const result = await createLlmClient(config, {fetch: fetcher}).call('test_connection', buildTestConnection());
  expect(result.log?.error).toEqual({kind: 'unauthorized', status: 401, providerCode: 'invalid_api_key'});
  expect(result.log?.rawResponse).toBeNull();
  expect(JSON.stringify(result)).not.toContain('sk-test');
});
it('discards untrusted error codes rather than copying arbitrary error-body fields', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({error: {message: key, code: 'sk-test-****123'}}), {status: 401}));
  const result = await createLlmClient(config, {fetch: fetcher}).call('test_connection', buildTestConnection());
  expect(result.log?.error?.providerCode).toBeNull(); expect(JSON.stringify(result)).not.toContain('sk-test');
});
it('scrubs raw output, validated objects (including keys), model and request messages before logging', async () => {
  const raw = JSON.stringify({text: `${key} sk-abcdefgh12345 AIza${'a'.repeat(20)}`, [key]: key});
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({choices: [{message: {content: raw}}]})));
  const logs: AiCallLog[] = [];
  const result = await createLlmClient({...config, model: key}, {fetch: fetcher, onLog: (log) => logs.push(log)}).call('classify', {
    messages: [{role: 'user', content: key}], temperature: 0, expectJson: true, schema: z.object({text: z.string()}).passthrough(),
  });
  expect(result.ok).toBe(true);
  const serialized = JSON.stringify(logs);
  for (const secret of [key, 'sk-abcdefgh12345', `AIza${'a'.repeat(20)}`]) expect(serialized).not.toContain(secret);
  expect(serialized).toContain('[redacted]');
});
it('does not resend an echoed key in the JSON-retry assistant message', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({choices: [{message: {content: key}}]})));
  const result = await createLlmClient(config, {fetch: fetcher}).call('classify', {messages: [{role: 'user', content: 'JSON'}], temperature: 0, expectJson: true, schema: z.object({text: z.string()})});
  expect(JSON.stringify(result.logs)).not.toContain(key);
  expect(String(fetcher.mock.calls[1][1]?.body)).not.toContain(key);
});
it('keeps fake keys confined to tests and the documented scrub regex in production source', () => {
  const sources = import.meta.glob('../**/*.{ts,tsx}', {eager: true, query: '?raw', import: 'default'}) as Record<string, string>;
  for (const [path, source] of Object.entries(sources)) {
    if (path.includes('/test/') || /\.test\.tsx?$/.test(path) || path === './setup.ts') continue;
    expect(source, path).not.toContain(key);
    expect(source, path).not.toMatch(/['"`]sk-[A-Za-z0-9_-]{8,}/);
    expect(source, path).not.toMatch(/['"`]AIza[0-9A-Za-z_-]{20,}/);
  }
});

it.each(['classify','risk_check','trend_interpretation','advice'] as const)('%s request/output/retry never leaks synthetic secrets to traces, UI payloads or copies',async purpose=>{
  const other='sk-abcdefgh12345', google=`AIza${'a'.repeat(20)}`, secret=`${key} ${other} ${google}`;
  const pass={risk:'none',confidence:0.9,reason:secret};
  const result=purpose==='classify'?{...record(),reason:secret}:purpose==='risk_check'?pass:`**Short answer**\n${secret}\n**What to try**\n- Practice.`;
  const classification=purpose==='trend_interpretation'?classified('query_training',{query_type:'exercise_trend',exercise_raw_name:'bench'}):classified('get_advice',{advice_type:'general_knowledge',user_question:'Current'});
  const responses=purpose==='classify'?[secret,result]:purpose==='risk_check'?[secret,result,record()]:[pass,classification,result];
  const h=harness(responses);Object.assign(h.settings,{apiKey:key,ruleVersion:purpose==='classify'?'v1':'v2'});const ctx=h.context();ctx.llm=createLlmClient(ctx.settings,{fetch:h.fetcher});
  await h.database.sessions.bulkAdd(generateSeedSessions(NOW));const before=await h.repo.list();const r=await handleMessage(`Current ${secret}`,ctx);const m=r.messages[0];
  expect(m.trace.aiCalls).toHaveLength(purpose==='classify'?2:3);const exposed=JSON.stringify({traceObject:m.trace,modelReply:m.kind==='advice'?m.payload.markdown:m.kind==='trend'?m.payload.interpretation:null,trace:fullTraceJson(m.trace,key),row:testLogRow(`Current ${secret}`,m,key)});
  for(const s of [key,other,google])expect(exposed).not.toContain(s);expect(exposed).toContain('[redacted]');
  for(const req of h.requests)for(const s of [key,other,google])expect(JSON.stringify(req)).not.toContain(s);
  expect(await h.repo.list()).toEqual(before);await h.database.delete();
});
it.each(['classify','risk_check','trend_interpretation','advice','test_connection'] as const)('%s full and partial 401 body never appears in any exposed result',async purpose=>{
  const body={error:{message:`Incorrect API key: ${key} or sk-test-****123`,code:'invalid_api_key'},details:key};
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body),{status:401}));
  const result=await createLlmClient(config,{fetch:fetcher}).call(purpose,buildTestConnection());
  expect(result.logs).toHaveLength(1);expect(result.log?.error).toEqual({kind:'unauthorized',status:401,providerCode:'invalid_api_key'});
  const exposed=JSON.stringify({result,error:llmErrorText('unauthorized')});expect(exposed).not.toContain(key);expect(exposed).not.toContain('sk-test');expect(exposed).not.toContain('Incorrect');
});
