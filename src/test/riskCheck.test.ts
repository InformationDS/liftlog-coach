import {afterEach, describe, expect, it, vi} from 'vitest';
import {handleMessage} from '../core/pipeline/handleMessage';
import {createLlmClient, type LlmError} from '../core/llm/client';
import {copy} from '../core/copy';
import {harness, record, slots, NOW} from './cp4Fixtures';
import {clearContext} from '../core/pipeline/types';
import {buildRiskCheck, promptSets} from '../core/prompts/builder';
import {loadLlmSection} from '../core/kb/loader';
import {confidenceSchema, riskCheckSchema} from '../core/llm/schemas';
export const safeRisk = {risk:'none', category:null, confidence:0.95, reason:'fixture'};
const dbs: ReturnType<typeof harness>['database'][] = [];
const setup = (responses: unknown[]) => {const h=harness(responses); dbs.push(h.database); const settings={...h.settings,ruleVersion:'v2' as const};
  return {...h,settings,context:(state=h.store.getState())=>({...h.context(state),settings})};};
afterEach(async()=>{vi.useRealTimers();await Promise.all(dbs.splice(0).map(d=>d.delete()));});
describe('P2 decisions and state table',()=>{
  it.each([
    ['medical','diagnosis',0.88,true], ['medical','training_with_pain',0.5,true], ['medical','training_with_pain',0.49,false],
    ['destructive','delete',0.5,true], ['destructive','clear_all',1,true], ['destructive','edit_record',0.5,true],
    ['destructive','change_date',0.5,true], ['destructive','unexpected',0.5,true], ['destructive',null,0.5,true],
    ['destructive','delete',0.49,false], ['none',null,1,false], ['none',null,0,false],
  ])('%s/%s at %s blocks=%s',async(risk,category,confidence,blocked)=>{
    const h=setup([{risk,category,confidence},record()]);
    const state={...h.store.getState(),pendingDraft:{slots:slots(),rawTexts:['private earlier note'],createdAt:NOW.toISOString()},clarificationCount:2,activeClarificationId:'old'};
    const r=await handleMessage('Current message only',h.context(state));const m=r.messages[0];
    expect(m.kind).toBe(blocked?'refusal':'confirm_card');expect(m.trace.ruleVersion).toBe('v2');
    expect(m.trace.aiCalls).toHaveLength(blocked?1:2);expect(h.fetcher).toHaveBeenCalledTimes(blocked?1:2);
    if(blocked){expect(r.statePatch).toEqual(clearContext());expect(m).toMatchObject({payload:{label:copy.badge.blockedCheck,text:risk==='medical'?copy.refusal.medical:['edit_record','change_date'].includes(String(category))?copy.refusal.edit:copy.refusal.delete}});}
    expect(JSON.stringify(h.requests[0])).not.toMatch(/private earlier note|PENDING_DRAFT|TRAINING_DATA/);
    expect(await h.repo.list()).toEqual([]);
  });
  it.each(['timeout','network','server','rate_limited','invalid_json'] as const)('failure %s uses shared softPain for both outcomes',async error=>{
    for(const sore of [true,false]){
      const h=setup([record()]);const ctx=h.context();const original=ctx.llm;
      const fail=await createLlmClient(ctx.settings,{fetch:async()=>new Response('',{status:503})}).call('risk_check',buildRiskCheck('test'));
      ctx.llm={call:vi.fn().mockImplementation((purpose,request)=>purpose==='risk_check'?Promise.resolve({...fail,error,logs:fail.logs.map(l=>({...l,error:{kind:error,status:null,providerCode:null}}))}):original.call(purpose,request))};
      const r=await handleMessage(sore?'Knee sore — squat or rest?':'Bench 60kg 3x8',ctx);
      expect(r.messages[0].kind).toBe(sore?'refusal':'confirm_card');expect(r.messages[0].trace.path).toContain(`risk_check: failed, ${sore?'fail-closed':'continue'}`);
      expect(ctx.llm.call).toHaveBeenCalledTimes(sore?1:2);expect(r.messages[0].trace.aiCalls).toHaveLength(sore?1:2);
      if(sore)expect(r.statePatch).toEqual(clearContext());expect(await h.repo.list()).toEqual([]);
    }
  });
  it.each([401,404])('configuration HTTP %s stops and retains pending state',async status=>{
    const h=setup([new Response('secret provider body',{status})]); const state={...h.store.getState(),pendingDraft:{slots:slots(),rawTexts:['pending'],createdAt:NOW.toISOString()},clarificationCount:1,activeClarificationId:'keep'};
    const r=await handleMessage('Knee sore — squat or rest?',h.context(state));expect(r.messages[0].kind).toBe('error');expect(r.statePatch).toEqual({});expect(h.fetcher).toHaveBeenCalledTimes(1);
    expect(r.messages[0].trace.path).toContain(`risk_check: error (${status===401?'unauthorized':'model_not_found'})`);
  });
  it.each([null,true,false,'',' ',undefined,NaN,Infinity,'0x1','1e309',-0.1,1.1])('invalid confidence %s causes real schema retry',async confidence=>{
    expect(confidenceSchema.safeParse(confidence).success).toBe(false);expect(riskCheckSchema.safeParse({risk:'medical',confidence}).success).toBe(false);
    const h=setup([{risk:'medical',confidence},{risk:'medical',confidence:0.9}]);const r=await handleMessage('Knee sore — squat or rest?',h.context());
    expect(r.messages[0].kind).toBe('refusal');expect(r.messages[0].trace.aiCalls.map(l=>l.attempt)).toEqual(['first','json_retry']);expect(h.fetcher).toHaveBeenCalledTimes(2);
  });
  it.each(['0.5',' 0.65 ','6.5e-1',0,1])('valid confidence %s uses common schema',value=>expect(riskCheckSchema.parse({risk:'none',confidence:value}).confidence).toBe(Number(value)));
  it.each([true,false])('two invalid JSON responses fail closed only with pain=%s',async sore=>{
    const h=setup([{risk:'medical',confidence:null},{risk:'medical',confidence:null},record()]);const r=await handleMessage(sore?'Knee sore — squat or rest?':'Bench 60kg 3x8',h.context());
    expect(r.messages[0].kind).toBe(sore?'refusal':'confirm_card');expect(r.messages[0].trace.aiCalls).toHaveLength(sore?2:3);expect(h.fetcher).toHaveBeenCalledTimes(sore?2:3);
  });
  it('real client timeout logs a single HTTP attempt then closes',async()=>{
    vi.useFakeTimers();const h=setup([]);const ctx=h.context();ctx.llm=createLlmClient(ctx.settings,{fetch:(_url,init)=>new Promise((_resolve,reject)=>init?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))});
    const pending=handleMessage('Knee sore — squat or rest?',ctx);await vi.advanceTimersByTimeAsync(30001);const r=await pending;expect(r.messages[0].kind).toBe('refusal');expect(r.messages[0].trace.aiCalls[0].error?.kind).toBe('timeout');
  });
  it('real network error and server/rate limit responses are logged',async()=>{
    for(const error of [new TypeError('network'),new Response('',{status:503}),new Response('',{status:429})]){
      const h=setup([error]);const r=await handleMessage('Knee sore — squat or rest?',h.context());expect(r.messages[0].kind).toBe('refusal');expect(r.messages[0].trace.aiCalls).toHaveLength(1);
      expect(['network','server','rate_limited']).toContain(r.messages[0].trace.aiCalls[0].error?.kind as LlmError);
    }
  });
  it('JSON mode fallback + retry retain every actual request and cache downgrade',async()=>{
    const h=setup([new Response('response_format unsupported',{status:400}),'bad JSON',safeRisk,record(),safeRisk,record()]);h.settings.model='cp7-fallback-only';
    const first=await handleMessage('Bench 60kg 3x8',h.context());expect(first.messages[0].kind).toBe('confirm_card');
    expect(first.messages[0].trace.aiCalls.map(l=>l.attempt)).toEqual(['first','json_mode_fallback','json_retry','first']);
    const second=await handleMessage('Bench 60kg 3x8',h.context());expect(second.messages[0].trace.aiCalls).toHaveLength(2);expect(second.messages[0].trace.aiCalls.every(l=>!l.request.jsonMode)).toBe(true);expect(h.fetcher).toHaveBeenCalledTimes(6);
  });
  it.each(['v1','v2'] as const)('%s regex priority and no key require zero HTTP requests',async version=>{
    const h=setup([]);h.settings.apiKey='';const ctx={...h.context(),settings:{...h.settings,ruleVersion:version}};
    expect((await handleMessage('Delete yesterday\'s log',ctx)).messages[0].kind).toBe('refusal');
    const r=await handleMessage('Bench 60kg 3x8',ctx);expect(r.messages[0].trace.path).toContain('no_key: stop');expect(r.statePatch).toEqual({});expect(h.fetcher).not.toHaveBeenCalled();
  });
});
it('prompt sets share P3, v2 supplies its P1/P4 and tagged P2/current text',()=>{
  expect(promptSets.v1.riskCheck).toBeNull();expect(promptSets.v2.riskCheck).toBe(buildRiskCheck);
  expect(promptSets.v1.trendInterpretation).toBe(promptSets.v2.trendInterpretation);
  expect(promptSets.v1.advice).not.toBe(promptSets.v2.advice);
  expect(promptSets.v1.classify).not.toBe(promptSets.v2.classify);
  const p=buildRiskCheck('a""""b');expect(p.messages).toHaveLength(2);expect(p.messages[1].content).toBe('MESSAGE:\n"""\na\'\'b\n"""');
  expect(p.messages[0].content).toContain(loadLlmSection('references/safety-rules.md','risk-check'));expect(p.messages[0].content).not.toContain('Code contract');
  expect(p).toMatchObject({temperature:0,maxTokens:400,expectJson:true,schema:riskCheckSchema});
  expect(promptSets.v1.classify('today',null,NOW).messages[0].content).not.toContain('You are a safety screen');
});
