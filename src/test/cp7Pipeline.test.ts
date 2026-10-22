import {afterEach,describe,expect,it,vi} from 'vitest';
import {harness,classified,record,exercise,NOW} from './cp4Fixtures';
import {group,session} from './cp3Fixtures';
import {generateSeedSessions} from '../core/db/seed';
import {copy} from '../core/copy';
import {timeSchema} from '../core/llm/schemas';
import type {AdviceSlots,AssistantMessage,QuerySlots} from '../core/pipeline/types';
const pass={risk:'none',confidence:0.95,category:null};
const t=(type:string)=>timeSchema.parse({type,raw_text:type});
const q=(query_type:QuerySlots['query_type'],name:string|null=null,time:QuerySlots['time']=null)=>classified('query_training',{query_type,exercise_raw_name:name,time});
const a=(advice_type:AdviceSlots['advice_type']='exercise',name:string|null='squat')=>classified('get_advice',{advice_type,exercise_raw_name:name,user_question:'REWRITTEN'});
const u=(category='vague',confidence=0.9)=>classified('unknown',{category},confidence);
const md='**Where you are**\n100 kg on Tue 22 Sep and 100 kg on Tue 13 Oct.\n**What it suggests**\nUnchanged.\n**What to try**\n- Keep setup consistent.';
const dbs:ReturnType<typeof harness>['database'][]=[];
const setup=(responses:unknown[])=>{const h=harness(responses);dbs.push(h.database);Object.assign(h.settings,{ruleVersion:'v2'});return h;};
const last=(h:ReturnType<typeof harness>):AssistantMessage=>{const m=h.store.getState().messages.at(-1);if(m?.role!=='assistant')throw Error('assistant required');return m;};
const scope=(h:ReturnType<typeof harness>)=>{const s=h.store.getState();return {pendingDraft:s.pendingDraft,pendingResume:s.pendingResume,clarificationCount:s.clarificationCount,activeClarificationId:s.activeClarificationId};};
const choose=async(h:ReturnType<typeof harness>,i=0)=>{const m=last(h);if(m.kind!=='clarification')throw Error('question required');await h.actions.choose(m.id,m.payload.options[i].action);};
const count=(h:ReturnType<typeof harness>,expected:number)=>{expect(h.fetcher).toHaveBeenCalledTimes(expected);expect(h.requests).toHaveLength(expected);};
afterEach(async()=>{await Promise.all(dbs.splice(0).map(d=>d.delete()));vi.useRealTimers();});
describe('§2.12 v2 integration (actual HTTP counts, read-only snapshots)',()=>{
  it('confirm-card candidates change only local card payload and make no AI/write call',async()=>{
    const h=setup([pass,record({exercises:[exercise('press')]})]);await h.actions.send('Press 60kg 3x8');const m=last(h);expect(m.kind).toBe('confirm_card');
    if(m.kind==='confirm_card'){expect(m.payload.draft.exercises[0].chosen).toBeNull();const id=m.payload.draft.exercises[0].match.candidates[0];const payload=structuredClone(m.payload);payload.draft.exercises[0].chosen={kind:'standard',id};h.store.getState().updateCard(m.id,payload);expect(last(h)).toMatchObject({payload:{draft:{exercises:[{chosen:{kind:'standard',id}}]}}});}
    count(h,2);expect(await h.repo.list()).toEqual([]);
  });
  it.each(['v1','v2'] as const)('switch to %s retains pending resume; new continuation trace uses selected version',async version=>{
    const h=setup([pass,q('session_count')]);await h.actions.send('How many sessions?');const old=last(h);Object.assign(h.settings,{ruleVersion:version});await h.actions.send('This month');
    expect(last(h).trace.ruleVersion).toBe(version);expect(old.trace.ruleVersion).toBe('v2');expect(old.trace.aiCalls).toHaveLength(2);expect(last(h).trace.aiCalls).toHaveLength(0);count(h,2);expect(await h.repo.list()).toEqual([]);
  });
  it.each(['direct','fail-closed'] as const)('P2 %s clears populated pendingResume and invalidates old options',async mode=>{
    const h=setup([pass,q('session_count'),mode==='direct'?{risk:'medical',confidence:0.9}:new TypeError('network')]);await h.actions.send('How many sessions?');const old=last(h);await h.actions.send('Knee sore — squat or rest?');const before=h.store.getState().messages.length;
    expect(scope(h)).toEqual({pendingDraft:null,pendingResume:null,clarificationCount:0,activeClarificationId:null});if(old.kind==='clarification')await h.actions.choose(old.id,old.payload.options[0].action);expect(h.store.getState().messages).toHaveLength(before);count(h,3);expect(await h.repo.list()).toEqual([]);
  });
  it('new-message P2 error after a non-slot answer does not restore discarded resume',async()=>{
    const h=setup([pass,q('session_count'),new Response('',{status:401})]);await h.actions.send('How many sessions?');await h.actions.send('A full different question?');expect(last(h).kind).toBe('error');expect(scope(h)).toMatchObject({pendingResume:null,activeClarificationId:null,clarificationCount:0});count(h,3);expect(await h.repo.list()).toEqual([]);
  });
  it('v2 keeps exact v1 regex false positives and newline misses',async()=>{
    const h=setup([]);for(const text of ['Shoulder hurt but I still benched 60kg 3x8','My shoulder hurts when I bench, how should I adjust my grip?','Remove the warmup and do 3 sets']){await h.actions.send(text);expect(last(h).trace.aiCalls).toHaveLength(0);expect(last(h).trace.safetyRuleHit).not.toBeNull();}
    h.queue.push(pass,u('out_of_scope'));await h.actions.send("Delete\nlast Friday's workout");expect(last(h).trace.path[0]).toBe('safety_regex: miss');count(h,2);expect(await h.repo.list()).toEqual([]);
  });
  it('complete record, clarification continuation and pending draft only sent to P1',async()=>{
    const h=setup([pass,record({exercises:[exercise('bench',{sets:null,reps:null})]}),pass,record({draft_action:'continue'})]);const before=await h.repo.list();
    await h.actions.send('Bench 60kg');expect(last(h).kind).toBe('clarification');await h.actions.send('3x8');expect(last(h).kind).toBe('confirm_card');count(h,4);
    const m=last(h);if(m.kind==='confirm_card')expect(m.payload.draft.rawText).toBe('Bench 60kg / 3x8');
    expect(JSON.stringify(h.requests[2])).not.toContain('PENDING_DRAFT');expect(JSON.stringify(h.requests[3])).toContain('PENDING_DRAFT');expect(await h.repo.list()).toEqual(before);
  });
  it('P1 failure and send_text retry preserve draft, unique texts and every trace',async()=>{
    const h=setup([pass,record({exercises:[exercise('bench',{sets:null})]}),pass,new TypeError('network'),pass,record({draft_action:'continue'})]);
    await h.actions.send('Bench 60kg');const before=structuredClone(scope(h));await h.actions.send('3x8');expect(scope(h)).toEqual(before);const failed=last(h);expect(failed.kind).toBe('error');expect(failed.trace.aiCalls).toHaveLength(2);
    await h.actions.retry(failed.id);const m=last(h);expect(m.kind).toBe('confirm_card');if(m.kind==='confirm_card')expect(m.payload.draft.rawText).toBe('Bench 60kg / 3x8');
    expect(m.trace.aiCalls).toHaveLength(2);expect(failed.trace.aiCalls).toHaveLength(2);count(h,6);expect(await h.repo.list()).toEqual([]);
  });
  it('two incomplete rounds followed by new record restart counts and raw text',async()=>{
    const incomplete=record({exercises:[exercise('bench',{sets:null})]});const h=setup([pass,incomplete,pass,{...incomplete,slots:{...incomplete.slots,draft_action:'continue'}},pass,record({exercises:[exercise('deadlift',{reps:null})]})]);
    await h.actions.send('Bench 60kg');await h.actions.send('not sure');await h.actions.send('Forget that. Yesterday I did deadlifts');count(h,6);
    expect(scope(h)).toMatchObject({clarificationCount:1,pendingDraft:{rawTexts:['Forget that. Yesterday I did deadlifts']}});expect(await h.repo.list()).toEqual([]);
  });
  it.each([
    ['session_count',null,'last_week','text',2],['volume_sets',null,'last_week','text',2],['day_detail',null,'yesterday','day_detail',2],
    ['exercise_last','bench',null,'text',2],['exercise_best','squat',null,'text',2],['exercise_trend','bench',null,'trend',3],
    ['exercise_trend','deadlift',null,'trend',2],['unsupported',null,null,'text',2],
  ] as const)('%s/%s deterministic reply %s',async(type,name,time,kind,n)=>{
    const h=setup([pass,q(type,name,time?t(time):null),'Stable trend.']);await h.database.sessions.bulkAdd(generateSeedSessions(NOW));const before=await h.repo.list();
    await h.actions.send('Current query');expect(last(h).kind).toBe(kind);expect(last(h).trace.aiCalls).toHaveLength(n);count(h,n);expect(await h.repo.list()).toEqual(before);
  });
  it.each([false,true])('zero or rising from zero trend rising=%s sends null percent',async rising=>{
    const h=setup([pass,q('exercise_trend','bench'),'Stable.']);await h.database.sessions.bulkAdd([0,1,2].map((v)=>session(`2026-10-${10+v}`,[group(rising?v*5:0)],'ex_bench_press')));const before=await h.repo.list();
    await h.actions.send('Bench trend');count(h,3);expect(h.requests[2].messages[1].content).toContain('"change_percent": null');expect(await h.repo.list()).toEqual(before);
  });
  it('failed P3 retains all 3 logs and deterministic chart',async()=>{
    const h=setup([pass,q('exercise_trend','bench'),new Response('',{status:503})]);await h.database.sessions.bulkAdd(generateSeedSessions(NOW));const before=await h.repo.list();await h.actions.send('Bench trend');
    expect(last(h)).toMatchObject({kind:'trend',payload:{interpretation:null,notEnoughData:false}});expect(last(h).trace.aiCalls.at(-1)?.error?.kind).toBe('server');count(h,3);expect(await h.repo.list()).toEqual(before);
  });
  it.each(['option','typed'] as const)('time %s resume bypasses P2/P1, consumes only once',async mode=>{
    const h=setup([pass,q('session_count')]);await h.actions.send('How many times have I trained?');const m=last(h);
    if(mode==='typed')await h.actions.send('This month');else await choose(h);expect(last(h).kind).toBe('text');expect(last(h).trace.aiCalls).toHaveLength(0);count(h,2);
    if(m.kind==='clarification')await h.actions.choose(m.id,m.payload.options[0].action);count(h,2);expect(await h.repo.list()).toEqual([]);
  });
  it.each(['how many sessions this week?','How many sets did I do this month?'])('full new question %s runs P2/P1',async text=>{
    const h=setup([pass,q('session_count'),pass,q('volume_sets',null,t('this_month'))]);await h.actions.send('How many times?');await h.actions.send(text);count(h,4);expect(scope(h).pendingResume).toBeNull();expect(last(h).trace.aiCalls).toHaveLength(2);expect(await h.repo.list()).toEqual([]);
  });
  it.each(['option','typed'] as const)('exercise query %s resume adds only interpretation',async mode=>{
    const h=setup([pass,q('exercise_trend',mode==='option'?'press':null),'Stable.']);await h.database.sessions.bulkAdd(generateSeedSessions(NOW));const before=await h.repo.list();await h.actions.send('Trend?');
    if(mode==='typed')await h.actions.send('bench');else await choose(h);count(h,3);expect(last(h).trace.aiCalls).toHaveLength(1);expect(last(h).trace.path.some(p=>p.startsWith('resume: exercise'))).toBe(true);expect(await h.repo.list()).toEqual(before);
  });
  it.each([['exercise','squat','data'],['exercise','deadlift','insufficient'],['body_part',null,'data'],['overall',null,'data'],['next_session',null,'data'],['general_knowledge',null,'general']] as const)('advice %s/%s mode %s',async(type,name,mode)=>{
    const c=type==='body_part'?classified('get_advice',{advice_type:type,body_part:'back',user_question:'REWRITTEN'}):a(type,name);const h=setup([pass,c,md]);await h.database.sessions.bulkAdd(generateSeedSessions(NOW));const before=await h.repo.list();
    await h.actions.send('Advice please');expect(last(h)).toMatchObject({kind:'advice',payload:{mode}});expect(last(h).trace.aiCalls.map(l=>l.purpose)).toEqual(['risk_check','classify','advice']);count(h,3);expect(await h.repo.list()).toEqual(before);
  });
  it.each(['bench','custom','option','body'] as const)('advice resume %s, failure, retry and stale error',async target=>{
    const c=target==='body'?a('body_part',null):a('exercise',target==='option'?'press':null);const h=setup([pass,c,new TypeError('network'),md,pass,u('out_of_scope')]);
    if(target==='custom')await h.database.sessions.add({...session(),exercises:[{...session().exercises[0],standardExerciseId:null,customName:'Lat pulldown V2'}]});const before=await h.repo.list();
    const original='How should I improve this lift?';await h.actions.send(original);const pending=structuredClone(scope(h));
    if(target==='option'||target==='body')await choose(h);else await h.actions.send(target==='custom'?'Lat pulldown V2':'bench');
    const failed=last(h);expect(failed.kind).toBe('error');expect(scope(h)).toEqual(pending);expect(failed.trace.aiCalls).toHaveLength(1);count(h,3);
    await h.actions.retry(failed.id);count(h,4);expect(last(h).trace.aiCalls).toHaveLength(1);expect(last(h).trace.aiCalls[0].request.messages[1].content).toContain(original);
    expect(last(h).trace.aiCalls[0].request.messages[1].content).not.toContain('REWRITTEN');await h.actions.send('Weather?');const messages=h.store.getState().messages.length;await h.actions.retry(failed.id);count(h,6);expect(h.store.getState().messages).toHaveLength(messages);expect(await h.repo.list()).toEqual(before);
  });
  it('old failed advice resume becomes stale after a new unknown question',async()=>{
    const h=setup([pass,a('body_part',null),new TypeError('network'),pass,u('out_of_scope')]);await h.actions.send('Upper body?');await choose(h);const failed=last(h);await h.actions.send('Weather?');const before=structuredClone(h.store.getState().messages);await h.actions.retry(failed.id);count(h,5);expect(h.store.getState().messages).toEqual(before);expect(await h.repo.list()).toEqual([]);
  });
  it('old ambiguity Q1 cannot affect Q2',async()=>{
    const h=setup([pass,q('exercise_trend','press'),pass,q('exercise_trend','row')]);await h.actions.send('Press trend');const old=last(h);await h.actions.send('Row trend');const before=structuredClone(scope(h));const messages=h.store.getState().messages.length;
    if(old.kind==='clarification')await h.actions.choose(old.id,old.payload.options[0].action);expect(scope(h)).toEqual(before);expect(h.store.getState().messages).toHaveLength(messages);count(h,4);expect(await h.repo.list()).toEqual([]);
  });
  it.each(['chitchat','out_of_scope','unsupported_feature'])('unknown %s completes',async category=>{const h=setup([pass,u(category)]);await h.actions.send('Unknown');expect(last(h).kind).toBe('text');count(h,2);expect(scope(h)).toMatchObject({clarificationCount:0,pendingDraft:null,pendingResume:null});expect(await h.repo.list()).toEqual([]);});
  it.each(['low','vague','mixed','draft-low','draft-vague'])('shared clarification chain %s',async kind=>{
    const low=record({},0.5),incomplete=record({exercises:[exercise('bench',{sets:null})]});const seq=kind==='low'?[low,low,low]:kind==='mixed'?[low,u(),u()]:kind==='draft-low'?[incomplete,low,low]:kind==='draft-vague'?[incomplete,{...incomplete,slots:{...incomplete.slots,draft_action:'continue'}},u()]:[u(),u(),u()];
    const h=setup(seq.flatMap(c=>[pass,c]));for(const text of ['first','second','third'])await h.actions.send(text);count(h,6);
    if(kind==='draft-vague')expect(scope(h)).toMatchObject({clarificationCount:1,pendingDraft:null});else{expect(last(h)).toMatchObject({kind:'text',payload:{text:kind==='draft-low'?copy.record.giveUp:copy.unknown.giveUp}});expect(scope(h)).toMatchObject({clarificationCount:0,pendingDraft:null});}expect(await h.repo.list()).toEqual([]);
  });
  it('low-confidence send_text option re-enters full pipeline',async()=>{const h=setup([pass,record({},0.5),pass,record()]);await h.actions.send('Maybe log');await choose(h);count(h,4);expect(last(h).kind).toBe('confirm_card');expect(await h.repo.list()).toEqual([]);});
  it.each(['regex','p2','model'] as const)('%s refusal clears pending draft/resume/counter',async source=>{
    const h=setup([pass,record({exercises:[exercise('bench',{sets:null})]}),...(source==='p2'?[{risk:'medical',confidence:0.8}]:source==='model'?[pass,classified('destructive_operation',{category:'delete'},0.1)]:[])]);
    await h.actions.send('Bench 60kg');await h.actions.send(source==='regex'?'Delete my log':'Knee sore — squat or rest?');expect(last(h).kind).toBe('refusal');expect(scope(h)).toEqual({pendingDraft:null,pendingResume:null,clarificationCount:0,activeClarificationId:null});count(h,source==='regex'?2:source==='p2'?3:4);expect(await h.repo.list()).toEqual([]);
  });
  it.each([true,false])('P1 schema retry good=%s retains 3 HTTP logs',async good=>{const h=setup([pass,record({},true),good?record():'invalid']);await h.actions.send('Bench 60kg 3x8');expect(last(h).kind).toBe(good?'confirm_card':'error');expect(last(h).trace.aiCalls.map(l=>l.purpose)).toEqual(['risk_check','classify','classify']);count(h,3);expect(await h.repo.list()).toEqual([]);});
  it('existing custom queried/advised without standard match or writes',async()=>{
    const h=setup([pass,q('exercise_last','Lat pulldown V2'),pass,a('exercise','Lat pulldown V2'),md]);await h.database.sessions.bulkAdd([10,11,12].map(d=>{const s=session(`2026-10-${d}`,[group(20)]);return {...s,exercises:[{...s.exercises[0],standardExerciseId:null,customName:d===11?' lat pulldown v2 ':'Lat pulldown V2'}]};}));const before=await h.repo.list();
    await h.actions.send('Last custom');expect(last(h).kind).toBe('text');await h.actions.send('Custom advice');expect(last(h)).toMatchObject({kind:'advice',payload:{mode:'data'}});expect(h.requests[4].messages[1].content).not.toContain('ex_lat_pulldown');count(h,5);expect(await h.repo.list()).toEqual(before);
  });
});
