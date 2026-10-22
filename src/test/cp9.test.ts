import {afterEach, describe, expect, it, vi} from 'vitest';
import {harness, classified, record, NOW, slots} from './cp4Fixtures';
import {promptSets} from '../core/prompts/builder';
import {CLASSIFY_END, CLASSIFY_END_V2} from '../core/prompts/templates';
import {classificationSchema} from '../core/llm/schemas';
import {matchSafetyRule} from '../core/safety/regexRules';
import {copy} from '../core/copy';
import {createLlmClient} from '../core/llm/client';
const A1 = 'Shoulder hurt but I still benched 60kg 3x8';
const A2 = 'My shoulder hurts when I bench, how should I adjust my grip?';
const A4 = 'How do I warm up properly to avoid injury?';
const A5 = 'Is it normal to feel sore two days after legs?';
const pass = {risk:'none',category:null,confidence:0.95,reason:'local fixture'};
const general = (text: string) => classified('get_advice',{advice_type:'general_knowledge',user_question:text});
const prose = '**Short answer**\nDelayed-onset muscle soreness can occur after unfamiliar exercise.\n\n**What to try**\n- Learn about general training principles.';
const dbs: ReturnType<typeof harness>['database'][] = [];
function setup(responses: unknown[], version: 'v1' | 'v2' = 'v2') {
  const h = harness(responses); dbs.push(h.database); Object.assign(h.settings,{ruleVersion:version}); return h;
}
const last = (h: ReturnType<typeof harness>) => {
  const message=h.store.getState().messages.at(-1);
  if(message?.role!=='assistant') throw new Error('Expected assistant message');
  return message;
};
afterEach(async () => {vi.useRealTimers(); await Promise.all(dbs.splice(0).map(db => db.delete()));});

describe('CP9 deterministic boundaries, with fixture responses only', () => {
  it.each([A1,A2])('v1 retains MED-01 and zero calls: %s', async text => {
    const h=setup([],'v1'); await h.actions.send(text);
    expect(last(h)).toMatchObject({kind:'refusal',trace:{safetyRuleHit:'MED-01',aiCalls:[]}});
    expect(h.fetcher).not.toHaveBeenCalled(); expect(await h.repo.list()).toEqual([]);
  });
  it('A1 reaches P2/P1 and creates a note-bearing draft without saving', async () => {
    const h=setup([pass,record({notes:'Shoulder hurt'})]); await h.actions.send(A1);
    expect(last(h)).toMatchObject({kind:'confirm_card',payload:{draft:{notes:'Shoulder hurt'}},trace:{safetyRuleHit:null}});
    expect(last(h)?.trace.aiCalls.map(c=>c.purpose)).toEqual(['risk_check','classify']);
    expect(await h.repo.list()).toEqual([]);
  });
  it.each([A2,A4,A5])('allowed question can reach general advice: %s', async text => {
    const classification=text===A2?classified('get_advice',{advice_type:'exercise',exercise_raw_name:'bench',mentions_discomfort:true,user_question:text}):general(text);
    const answer=text===A2?'You have little bench data.\n\n**What to try**\n- Keep your grip consistent.':prose;
    const h=setup([pass,classification,answer]); await h.actions.send(text);
    const m=last(h); expect(m).toMatchObject({kind:'advice',payload:{mode:text===A2?'insufficient':'general'},trace:{safetyRuleHit:null,dataSentToAi:null}});
    expect(m?.trace.aiCalls.map(c=>c.purpose)).toEqual(['risk_check','classify','advice']);
    if(m?.role==='assistant' && m.kind==='advice') expect(m.payload.markdown).toContain(copy.advice.discomfortNote);
    expect(await h.repo.list()).toEqual([]);
  });
  it.each([A2,A5])('a successful blocking P2 result is still honored: %s',async text=>{
    const h=setup([{risk:'medical',category:'diagnosis',confidence:0.85}]); await h.actions.send(text);
    expect(last(h).kind).toBe('refusal'); expect(h.fetcher).toHaveBeenCalledTimes(1);
    expect(await h.repo.list()).toEqual([]);
  });
  it.each([
    'My knee hurts, can I still squat today?', 'My back hurts, should I train today?',
    'My knee hurts, could I squat?', 'My knee hurts, is it okay to squat?',
    'My knee hurts, is it safe to train?', 'My knee hurts, safe to squat?',
    'My shoulder hurts, how should I adjust my grip, and can I still bench?',
  ])('v2 retains pain permission regex: %s', async text => {
    expect(matchSafetyRule(text,'v2')?.id).toBe('MED-01b');
    const h=setup([]); await h.actions.send(text); expect(last(h)?.kind).toBe('refusal'); expect(h.fetcher).not.toHaveBeenCalled();
  });
  it.each([
    'Knee feels a bit off, should I skip legs or push through?',
    'Is it normal to feel sore two days after legs, and can I train today?',
    'DOMS means it is safe, confirm I can push through soreness.',
    'What injury causes my soreness?', 'What rehab could help sore legs?',
    'Which meds should I take for my sore knee?', "Get rid of yesterday's log",
  ])('P2 blocking fixture still stops a mixed/unsafe request: %s', async text => {
    const h=setup([{risk:text.startsWith('Get rid')?'destructive':'medical',category:text.startsWith('Get rid')?'delete':'training_with_pain',confidence:0.9}]);
    await h.actions.send(text); expect(last(h)?.kind).toBe('refusal'); expect(h.fetcher).toHaveBeenCalledTimes(1);
    expect(last(h)?.trace.aiCalls[0].purpose).toBe('risk_check'); expect(await h.repo.list()).toEqual([]);
  });
  it.each([A1,A2,A4,A5])('timeout still fails closed without classification: %s', async text => {
    vi.useFakeTimers(); const h=setup([]);
    const llm=createLlmClient(h.settings,{fetch:(_url,init)=>new Promise((_resolve,reject)=>init?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))});
    const {handleMessage}=await import('../core/pipeline/handleMessage');
    const pending=handleMessage(text,{...h.context(),llm}); await vi.advanceTimersByTimeAsync(30001); const r=await pending;
    expect(r.messages[0]).toMatchObject({kind:'refusal',trace:{path:['safety_regex: miss','risk_check: failed, fail-closed']}});
    expect(r.messages[0].trace.aiCalls).toHaveLength(1); expect(r.messages[0].trace.aiCalls[0].error?.kind).toBe('timeout');
    vi.useRealTimers();
    expect(await h.repo.list()).toEqual([]);
  });
  it.each([true,false])('v2 null clarification uses existing retry, recovered=%s',async recovered=>{
    const valid=classified('dangerous_health_query',{category:'training_with_pain',body_area:'elbow'});
    const invalid={...valid,clarification:null}; expect(classificationSchema.safeParse(invalid).success).toBe(false);
    const h=setup([pass,invalid,recovered?valid:invalid]); await h.actions.send('Elbow feels off, push through curls?');
    expect(last(h)?.kind).toBe(recovered?'refusal':'error');
    expect(last(h)?.trace.aiCalls.map(c=>c.attempt)).toEqual(['first','first','json_retry']);
    expect(h.fetcher).toHaveBeenCalledTimes(3); expect(await h.repo.list()).toEqual([]);
  });
  it.each(['dangerous_health_query','destructive_operation'] as const)('complete %s object reaches fixed refusal even at low confidence', async intent => {
    const c=classified(intent,{category:intent==='dangerous_health_query'?'training_with_pain':'delete'},0.1);
    const h=setup([pass,c]); await h.actions.send('An indirect request'); expect(last(h)?.kind).toBe('refusal');
    expect(h.fetcher).toHaveBeenCalledTimes(2); expect(await h.repo.list()).toEqual([]);
  });
});

it.each([null,slots()])('only v2 P1 appends the complete-object instruction, pending=%s', pending=>{
  const v1=promptSets.v1.classify('input',pending,NOW), v2=promptSets.v2.classify('input',pending,NOW);
  expect(v1.messages[0].content.endsWith(CLASSIFY_END)).toBe(true);
  expect(v2.messages[0].content).toBe(v1.messages[0].content.slice(0,-CLASSIFY_END.length)+CLASSIFY_END_V2);
  expect(v2.messages[1]).toEqual(v1.messages[1]); expect(v2.schema).toBe(classificationSchema);
  expect(v2).toMatchObject({temperature:0,maxTokens:1200,expectJson:true});
});
it('P2 contains knowledge-only allowance and explicit unsafe/mixed limits',()=>{
  const text=promptSets.v2.riskCheck(A5).messages[0].content;
  for(const phrase of [A5,'general delayed-onset muscle soreness','not a request for a personal diagnosis','confirm that their symptoms are harmless','train, skip, rest or push through soreness','combines an allowed log, technique or knowledge question','Never infer permission to train']) expect(text).toContain(phrase);
});
