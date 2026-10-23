import {afterEach, describe, expect, it} from 'vitest';
import {classified, exercise, harness, NOW, record} from './cp4Fixtures';
import {generateSeedSessions} from '../core/db/seed';
import {ADVICE_SYSTEM, ADVICE_SYSTEM_V2} from '../core/prompts/templates';
import {copy} from '../core/copy';
import type {AdviceSlots} from '../core/pipeline/types';

const pass={risk:'none',category:null,confidence:0.95};
const doms='Is it normal to feel sore two days after legs?';
const technique='My shoulder hurts when I bench, how should I adjust my grip?';
const answer='**Short answer**\nDOMS is delayed-onset muscle soreness.\n**What to try**\n- Its timing and intensity vary.';
const dbs:ReturnType<typeof harness>['database'][]=[];
async function setup(responses:unknown[],version:'v1'|'v2'='v2') {
  const h=harness(responses);dbs.push(h.database);Object.assign(h.settings,{ruleVersion:version});
  await h.database.sessions.bulkAdd(generateSeedSessions(NOW));return h;
}
const last=(h:ReturnType<typeof harness>)=>{
  const m=h.store.getState().messages.at(-1);if(m?.role!=='assistant')throw Error('Expected assistant');return m;
};
const advice=(type:AdviceSlots['advice_type'],name:string|null)=>classified('get_advice',{advice_type:type,exercise_raw_name:name,mentions_discomfort:true,user_question:'REWRITTEN'});
function checkSystem(system:string,version:'v1'|'v2') {
  expect(system.includes('For a knowledge-only question about delayed-onset muscle soreness')).toBe(version==='v2');
  expect(system.includes('a prescribed rest period')).toBe(version==='v2');
  expect(system).not.toContain('{mode_data_rule}');expect(system).not.toContain('{mode_structure}');
}
afterEach(async()=>{await Promise.all(dbs.splice(0).map(db=>db.delete()));});

describe('round2 P4 wiring through actual HTTP request bodies (fake provider)',()=>{
  it.each((['v1','v2'] as const).flatMap(version=>([
    ['general_knowledge',null,'general',doms],['exercise','bench','data',technique],
    ['exercise','deadlift','insufficient','My deadlift feels sore, how should I adjust my stance?'],
  ] as const).map(([type,name,mode,text])=>({version,type,name,mode,text}))))('$version/$mode selects correct P4, keeps original text and fixed note',async({version,type,name,mode,text})=>{
    const c=advice(type,name),h=await setup(version==='v2'?[pass,c,answer]:[c,answer],version),before=await h.repo.list();
    const original=version==='v1'&&text===technique?'My shoulder feels sore when I bench, how should I adjust my grip?':text;
    await h.actions.send(original);const m=last(h);expect(m).toMatchObject({kind:'advice',payload:{mode,discomfort:true}});
    const call=m.trace.aiCalls.find(c=>c.purpose==='advice');expect(call).toBeDefined();
    const sent=h.requests.at(-1)!;checkSystem(sent.messages[0].content,version);
    expect(sent.messages).toEqual(call!.request.messages);
    expect(sent.messages[1].content).toContain(original);expect(sent.messages[1].content).not.toContain('REWRITTEN');
    expect(sent.messages[1].content.includes('TRAINING_DATA:')).toBe(mode==='data');
    if(m.kind==='advice'){
      expect(m.payload.markdown).toBe(`${answer}\n\n${copy.advice.discomfortNote}`);
      expect(m.payload.markdown.split(copy.advice.discomfortNote)).toHaveLength(2);
    }
    expect(h.fetcher).toHaveBeenCalledTimes(version==='v2'?3:2);expect(await h.repo.list()).toEqual(before);
  });
  it.each((['v1','v2'] as const).flatMap(version=>(['typed','option','retry'] as const).map(route=>({version,route}))))('$version $route resume/retry uses selected P4 without reclassification',async({version,route})=>{
    const c=advice('exercise',route==='option'?'press':null);
    const h=await setup([...(version==='v2'?[pass]:[]),c,...(route==='retry'?[new TypeError('fixture network')]:[]),answer],version);
    const before=await h.repo.list(),original='My shoulder feels sore, how should I adjust my grip?';
    await h.actions.send(original);const q=last(h);expect(q.kind).toBe('clarification');
    if(route==='option'){
      if(q.kind!=='clarification')throw Error('Expected question');await h.actions.choose(q.id,q.payload.options[0].action);
    }else await h.actions.send('bench');
    if(route==='retry'){
      const failed=last(h);expect(failed.kind).toBe('error');checkSystem(h.requests.at(-1)!.messages[0].content,version);
      await h.actions.retry(failed.id);
      expect(h.requests.at(-1)!.messages).toEqual(h.requests.at(-2)!.messages);
    }
    expect(last(h).kind).toBe('advice');checkSystem(h.requests.at(-1)!.messages[0].content,version);
    expect(h.requests.at(-1)!.messages[1].content).toContain(original);
    expect(h.requests.at(-1)!.messages[1].content).not.toContain('REWRITTEN');
    expect(h.fetcher).toHaveBeenCalledTimes((version==='v2'?3:2)+(route==='retry'?1:0));
    expect(last(h).trace.aiCalls.map(c=>c.purpose)).toEqual(['advice']);expect(await h.repo.list()).toEqual(before);
  });
});

it('v2 DOMS rules explicitly override suggestion and lighter-load defaults',()=>{
  for(const phrase of [doms,'explain general knowledge only','symptom-based load reduction, fewer sets, exercise substitution','training or rest decisions, time off, return-to-training criteria, or a recovery plan','use explanatory facts there, not action steps','takes priority over the general technique and lighter-load permissions'])expect(ADVICE_SYSTEM_V2).toContain(phrase);
  expect(ADVICE_SYSTEM_V2).not.toContain('- If the question mentions pain or discomfort, give only general technique cues');
  expect(ADVICE_SYSTEM).not.toContain('knowledge-only');
});
it('v2 technique cues remain allowed while symptom-based periods and recovery plans are prohibited',()=>{
  for(const phrase of ['grip, stance, range of motion, tempo or non-numeric load reduction','a prescribed rest period','exercise substitutions for a number of days or weeks','treatment/rehab/recovery steps','the app appends its unchanged fixed sentence'])expect(ADVICE_SYSTEM_V2).toContain(phrase);
  expect(copy.advice.discomfortNote).toBe('If pain persists or gets worse, stop and see a doctor or physiotherapist.');
});
it('a fake unsafe answer is not evidence of corrected real-model behavior or silently post-filtered',async()=>{
  const unsafe='**Short answer**\nFixture only.\n**What to try**\n- Skip legs for two weeks.';
  const h=await setup([pass,advice('general_knowledge',null),unsafe]);await h.actions.send(doms);
  checkSystem(h.requests.at(-1)!.messages[0].content,'v2');
  expect(last(h)).toMatchObject({kind:'advice',payload:{markdown:`${unsafe}\n\n${copy.advice.discomfortNote}`}});
});

describe('round2 P1 explicit units, defaults and unchanged raw names (fixture extraction)',()=>{
  it.each([
    {text:'Shoulder hurt but I still benched 60kg 3x8',name:'benched',unit:'kg',defaultUnit:'lb',weight:60},
    {text:'Bench 135 lb 3x5',name:'Bench',unit:'lb',defaultUnit:'kg',weight:135},
    {text:'Bench 60 3x8',name:'Bench',unit:null,defaultUnit:'lb',weight:60},
  ] as const)('$text with default $defaultUnit retains fixture explicit unit and raw name',async({text,name,unit,defaultUnit,weight})=>{
    const h=await setup([pass,record({exercises:[exercise(name,{weight,unit,reps:weight===135?5:8})]})]);
    Object.assign(h.settings,{defaultUnit});const before=await h.repo.list();await h.actions.send(text);
    const m=last(h);expect(m.kind).toBe('confirm_card');
    if(m.kind==='confirm_card'){
      expect(m.payload.draft.exercises[0].rawName).toBe(name);
      expect(m.payload.draft.exercises[0].setGroups[0]).toMatchObject({weight,unit:unit??defaultUnit,explicitUnit:unit,unitInferred:unit===null});
      if(name==='benched')expect(m.payload.draft.exercises[0].match.status).toBe('unmatched');
    }
    const p1=h.requests[1].messages[0].content;
    expect(p1).toContain('Never replace an explicit kg or lb with null');
    expect(p1).toContain('keep raw_name in the user\'s wording, including "benched"');
    expect(p1).toContain('leave its unit null');expect(await h.repo.list()).toEqual(before);
  });
  it('mixed-unit groups keep their own numbers and units despite opposite default',async()=>{
    const h=await setup([pass,record({exercises:[{raw_name:'Bench',set_groups:[{weight:135,unit:'lb',sets:3,reps:5},{weight:60,unit:'kg',sets:3,reps:5}]}]})]);
    Object.assign(h.settings,{defaultUnit:'lb'});const before=await h.repo.list();await h.actions.send('Bench 135lb 3x5 then 60kg 3x5');
    const m=last(h);if(m.kind!=='confirm_card')throw Error('Expected card');
    expect(m.payload.draft.exercises[0].setGroups).toMatchObject([{weight:135,unit:'lb',explicitUnit:'lb',unitInferred:false},{weight:60,unit:'kg',explicitUnit:'kg',unitInferred:false}]);
    expect(h.requests[1].messages[0].content).toContain('one lb group and one kg group');expect(await h.repo.list()).toEqual(before);
  });
  it('pending continuation also sends unit reminder and preserves explicitly supplied kg with lb default',async()=>{
    const h=await setup([pass,record({exercises:[exercise('Bench',{unit:'kg',sets:null,reps:null})]}),pass,record({draft_action:'continue'})]);
    Object.assign(h.settings,{defaultUnit:'lb'});const before=await h.repo.list();await h.actions.send('Bench 60kg');
    expect(last(h).kind).toBe('clarification');await h.actions.send('3x8');const m=last(h);if(m.kind!=='confirm_card')throw Error('Expected card');
    expect(h.requests[3].messages[0].content).toContain('Never replace an explicit kg or lb with null');
    expect(h.requests[3].messages[0].content).toContain('a unitless follow-up must not erase them');
    expect(h.requests[3].messages[1].content).toContain('PENDING_DRAFT');
    expect(m.payload.draft.exercises[0].setGroups[0]).toMatchObject({unit:'kg',explicitUnit:'kg',unitInferred:false});
    expect(await h.repo.list()).toEqual(before);
  });
});
