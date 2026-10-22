import { afterEach, describe, expect, it, vi } from 'vitest';
import { copy, fmtDate } from '../core/copy';
import { generateSeedSessions } from '../core/db/seed';
import { querySlotsSchema, timeSchema } from '../core/llm/schemas';
import { handleMessage } from '../core/pipeline/handleMessage';
import { resume } from '../core/pipeline/resume';
import { createTrace } from '../core/trace/trace';
import { queryReply } from '../core/intents/query/replies';
import { buildTrend, cleanInterpretation, type TrendData } from '../core/prompts/builder';
import { classified, harness, NOW, record, exercise } from './cp4Fixtures';
import { group, session } from './cp3Fixtures';
import type { AssistantMessage, ChatStateSnapshot, PipelineContext, QuerySlots } from '../core/pipeline/types';
const time = (type: string, extra = {}) => timeSchema.parse({type, raw_text: type, ...extra});
const query = (query_type: QuerySlots['query_type'], t: QuerySlots['time'] = null, name: string | null = null) => classified('query_training', {query_type, time: t, exercise_raw_name: name});
const last = (h: ReturnType<typeof harness>): AssistantMessage => {
  const m = h.store.getState().messages.at(-1); if (m?.role !== 'assistant') throw Error('Expected assistant'); return m;
};
const contexts = (s: ChatStateSnapshot) => ({pendingDraft: s.pendingDraft, pendingResume: s.pendingResume, activeClarificationId: s.activeClarificationId, clarificationCount: s.clarificationCount});
const chosen = (m: AssistantMessage, i = 0) => {if (m.kind !== 'clarification') throw Error('Expected question'); return m.payload.options[i].action;};
const dbs: ReturnType<typeof harness>['database'][] = [];
const setup = (responses: unknown[]) => {const h = harness(responses); dbs.push(h.database); return h;};
afterEach(async () => {await Promise.all(dbs.splice(0).map(d => d.delete())); vi.useRealTimers();});
const seeded = async (responses: unknown[]) => {const h = setup(responses); await h.database.sessions.bulkAdd(generateSeedSessions(NOW)); return h;};
const unchanged = async (h: ReturnType<typeof harness>, before: unknown) => expect(await h.repo.list()).toEqual(before);

describe('CP5 six deterministic query replies + unsupported', () => {
  it.each([
    ['session_count', time('last_week'), null, 'You trained on 4 day(s) last week (Mon 12 Oct – Sun 18 Oct).'],
    ['volume_sets', time('last_week'), null, 'last week: 56 sets, volume 23675 kg + 7680 lb. (bodyweight sets not included in volume)'],
    ['exercise_best', null, 'squat', 'Best Back Squat in the last 8 weeks: 100 kg × 5 on Tue 22 Sep. (last 8 weeks)'],
    ['exercise_best', null, 'lat pulldown', 'Best Lat Pulldown in the last 8 weeks: 140 lb × 10 on Thu 15 Oct. (last 8 weeks)'],
    ['unsupported', null, null, copy.query.unsupported],
  ] as const)('%s returns calculated exact copy without P3', async (type, t, name, expected) => {
    const h = await seeded([query(type, t, name)]), before = await h.repo.list();
    await h.actions.send('Original query'); expect(last(h)).toMatchObject({kind: 'text', payload: {text: expected}});
    expect(h.fetcher).toHaveBeenCalledTimes(1); expect(last(h).trace.aiCalls).toHaveLength(1); expect(last(h).trace.dataSentToAi).toBeNull(); await unchanged(h, before);
  });
  it('day detail returns original units, pure bodyweight, notes and all groups', async () => {
    const h = await seeded([query('day_detail', time('weekday', {weekday: 4, week: 'last'}))]), before = await h.repo.list();
    await h.actions.send('Last Thursday'); const m = last(h); expect(m.kind).toBe('day_detail');
    if (m.kind === 'day_detail') {expect(m.payload.session.date).toBe('2026-10-15'); expect(m.payload.session.notes).toBe('Hotel gym, plates in pounds.'); expect(m.payload.session.exercises[0].setGroups[0].unit).toBe('lb'); expect(m.payload.session.exercises[2].setGroups[0].weight).toBeNull();}
    expect(h.fetcher).toHaveBeenCalledTimes(1); await unchanged(h, before);
  });
  it('last uses all history without a period label and preserves full groups', async () => {
    const h = setup([query('exercise_last', null, 'pull-up')]); await h.database.sessions.add(session('2025-01-01', [group(null), group(10)]));
    const before = await h.repo.list(); await h.actions.send('Last pull-up?');
    expect(last(h)).toMatchObject({kind: 'text', payload: {text: 'Last Pull-up: Wed 1 Jan 2025 — Bodyweight × 8 reps × 3 sets; BW + 10 kg × 8 reps × 3 sets.'}}); await unchanged(h, before);
  });
  it.each(['session_count', 'volume_sets', 'day_detail', 'exercise_last', 'exercise_best', 'exercise_trend'] as const)('empty log: %s never calls interpretation', async type => {
    const h = setup([query(type, time('today'), 'bench')]); await h.actions.send('Empty query');
    expect(h.fetcher).toHaveBeenCalledTimes(1); expect(last(h).kind).toBe(type === 'exercise_trend' ? 'trend' : 'text');
    if (type === 'exercise_trend') expect(last(h)).toMatchObject({payload: {points: [], notEnoughData: true, interpretation: null}});
    else expect(last(h)).toMatchObject({payload: {text: expect.stringMatching(/No |haven't/)} });
    await unchanged(h, []);
  });
  it.each([
    [[group(null)], 'on Tue 20 Oct: 3 sets, no weighted volume. (bodyweight sets not included in volume)'],
    [[group(0)], 'on Tue 20 Oct: 3 sets, volume 0 kg.'],
    [[group(5, 'lb')], 'on Tue 20 Oct: 3 sets, volume 120 lb.'],
    [[group(2), group(5, 'lb')], 'on Tue 20 Oct: 6 sets, volume 48 kg + 120 lb.'],
  ] as const)('volume retains unit bucket and null/zero identity %j', async (groups, expected) => {
    const h = setup([query('volume_sets', time('today'))]); await h.database.sessions.add(session('2026-10-20', [...groups])); const before = await h.repo.list();
    await h.actions.send('Volume today'); expect(last(h)).toMatchObject({payload: {text: expected}}); await unchanged(h, before);
  });
  it('unsupported reps returns capabilities without reading sessions', async () => {
    const h = setup([query('unsupported')]); const read = vi.spyOn(h.repo, 'list');
    await h.actions.send('How many reps did I do last week?'); expect(last(h)).toMatchObject({payload: {text: copy.query.unsupported}}); expect(read).not.toHaveBeenCalled(); expect(h.fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('CP5 time and exercise continuation, state and no writes', () => {
  it.each(['Today', 'Yesterday', 'This week', 'Last week', '  This   month ', 'Last month'])('complete typed time %s resumes without classification', async phrase => {
    const h = await seeded([query('session_count')]), before = await h.repo.list();
    await h.actions.send('  How many times have I trained?  '); const pending = structuredClone(h.store.getState().pendingResume);
    expect(pending?.originalUserText).toBe('  How many times have I trained?  ');
    await h.actions.send(phrase); expect(last(h).kind).toBe('text'); expect(last(h).trace.path).toContainEqual(expect.stringMatching(/^resume: time/));
    expect(last(h).trace.aiCalls).toHaveLength(0); expect(h.fetcher).toHaveBeenCalledTimes(1); expect(h.store.getState().pendingResume).toBeNull(); expect(h.store.getState().activeClarificationId).toBeNull(); await unchanged(h, before);
  });
  it.each(['session_count', 'volume_sets', 'day_detail'] as const)('%s time buttons carry complete structured values', async type => {
    const h = await seeded([query(type)]), before = await h.repo.list(); await h.actions.send('original'); const q = last(h);
    expect(q.kind).toBe('clarification'); const a = chosen(q); expect(a).toMatchObject({type: 'resume', value: {kind: 'time', time: {n: null, weekday: null, week: null, month: null, day: null}}});
    await h.actions.choose(q.id, a); expect(h.fetcher).toHaveBeenCalledTimes(1); expect(h.store.getState().pendingResume).toBeNull(); expect(h.store.getState().clarificationCount).toBe(0); await unchanged(h, before);
  });
  it('range reply to day_detail asks again with fresh ID and original text/time preserved', async () => {
    const h = setup([query('day_detail')]); await h.actions.send('Which workout?'); const first = last(h), created = h.store.getState().pendingResume?.createdAt;
    await h.actions.send('This month'); const second = last(h); expect(second.id).not.toBe(first.id); expect(second).toMatchObject({kind: 'clarification', payload: {question: copy.query.askDay}});
    expect(h.store.getState().pendingResume).toMatchObject({originalUserText: 'Which workout?', createdAt: created, slots: {query_type: 'day_detail', time: {type: 'this_month'}}});
    await h.actions.choose(first.id, chosen(first)); expect(last(h).id).toBe(second.id); expect(h.fetcher).toHaveBeenCalledTimes(1); await unchanged(h, []);
  });
  it.each(['How many sets did I do this month?', 'week', 'this week please'])('non-complete time starts new request: %s', async text => {
    const h = await seeded([query('session_count'), query('volume_sets', time('this_month'))]); const before = await h.repo.list();
    await h.actions.send('How many days?'); await h.actions.send(text); expect(last(h)).toMatchObject({kind: 'text', payload: {text: expect.stringContaining('sets, volume')}}); expect(h.fetcher).toHaveBeenCalledTimes(2); expect(h.store.getState().pendingResume).toBeNull(); await unchanged(h, before);
  });
  it('missing exercise typed bench resumes once then calls P3; keeps original context', async () => {
    const h = await seeded([query('exercise_trend'), 'It rose by 7.5 kg.']), before = await h.repo.list(); await h.actions.send('Is it improving?');
    expect(h.store.getState().pendingResume?.originalUserText).toBe('Is it improving?'); await h.actions.send('bench'); expect(h.fetcher).toHaveBeenCalledTimes(2);
    expect(last(h)).toMatchObject({kind: 'trend', payload: {exerciseId: 'ex_bench_press', interpretation: 'It rose by 7.5 kg.'}}); expect(last(h).trace.path).toContain('resume: exercise = ex_bench_press');
    expect(last(h).trace.aiCalls.map(c => c.purpose)).toEqual(['trend_interpretation']); expect(last(h).trace.dataSentToAi).toMatch(/8 sessions/); await unchanged(h, before);
  });
  it('unmatched typed action becomes a new classified query', async () => {
    const h = await seeded([query('exercise_trend'), query('session_count', time('this_week'))]); const before = await h.repo.list(); await h.actions.send('Is it improving?'); await h.actions.send('how many sessions this week?');
    expect(h.fetcher).toHaveBeenCalledTimes(2); expect(last(h)).toMatchObject({kind: 'text', payload: {text: expect.stringContaining('day(s) this week')}}); expect(h.store.getState().pendingResume).toBeNull(); await unchanged(h, before);
  });
  it('ambiguous press candidate continues without reclassification; old instances and old events expire', async () => {
    const h = await seeded([query('exercise_trend', null, 'press'), query('exercise_trend', null, 'press'), 'Stable.']); const before = await h.repo.list();
    await h.actions.send('Original Q1'); const q1 = last(h); await h.actions.send('Original Q2'); const q2 = last(h), snapshot = contexts(h.store.getState()), length = h.store.getState().messages.length;
    await h.actions.choose(q1.id, chosen(q1)); expect(contexts(h.store.getState())).toEqual(snapshot); expect(h.store.getState().messages).toHaveLength(length); expect(h.fetcher).toHaveBeenCalledTimes(2);
    expect(h.store.getState().pendingResume?.originalUserText).toBe('Original Q2'); await h.actions.choose(q2.id, chosen(q2));
    expect(h.fetcher).toHaveBeenCalledTimes(3); expect(last(h).trace.path).toContainEqual(expect.stringMatching(/^resume: exercise/)); expect(last(h).trace.aiCalls.map(c => c.purpose)).toEqual(['trend_interpretation']);
    const consumed = h.store.getState().messages.length; await h.actions.choose(q2.id, chosen(q2)); expect(h.store.getState().messages).toHaveLength(consumed); await unchanged(h, before);
  });
  it('busy deduplicates candidate clicks and text while P3 is pending', async () => {
    const h = await seeded([query('exercise_trend', null, 'press')]); const before = await h.repo.list(); await h.actions.send('Press trend?'); const q = last(h);
    let release!: (r: Response) => void; h.fetcher.mockImplementationOnce(() => new Promise(resolve => {release = resolve;}));
    const running = h.actions.choose(q.id, chosen(q)); await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await h.actions.choose(q.id, chosen(q)); await h.actions.send('new input'); expect(h.fetcher).toHaveBeenCalledTimes(2); expect(h.store.getState().messages.filter(m => m.role === 'user')).toHaveLength(2);
    release(new Response(JSON.stringify({choices: [{message: {content: 'Stable.'}}]}))); await running; expect(h.store.getState().busy).toBe(false); await unchanged(h, before);
  });
  it('query classification failure preserves active instance and retry replays original text', async () => {
    const h = setup([query('session_count'), new Response('', {status: 503}), query('volume_sets', time('this_month'))]);
    await h.actions.send('Days?'); await h.actions.send('New volume question'); const error = last(h);
    expect(error).toMatchObject({kind: 'error', payload: {retryAction: {type: 'send_text', text: 'New volume question'}}}); expect(h.store.getState().pendingResume).toBeNull();
    expect(error.trace.aiCalls).toHaveLength(1); expect(error.trace.aiCalls[0].error?.status).toBe(503); await h.actions.retry(error.id); expect(h.requests[2].messages[1].content).toContain('New volume question'); await unchanged(h, []);
  });
  it('resume wrapper retains handler failure Trace and structured retry, then expires retry on a new query', async () => {
    const h = setup([query('session_count'), query('session_count', time('this_week'))]); await h.actions.send('Days?'); const q = last(h);
    const context = (state: ChatStateSnapshot): PipelineContext => ({...h.context(state), extensions: {dispatch: async () => ({messages: [], statePatch: {}}), resume: async (_p, _v, ctx, trace) => {
      const response = await ctx.llm.call('trend_interpretation', {messages: [], temperature: 0.2, expectJson: false}); trace.aiCalls.push(...response.logs); trace.path.push('fixture: actual failed request'); trace.dataSentToAi = 'fixture data';
      return {messages: [{id: 'resume-error', role: 'assistant', at: NOW.toISOString(), kind: 'error', payload: {error: 'server', retryAction: {type: 'send_text', text: 'wrong'}}, trace}], statePatch: {}};
    }}});
    h.fetcher.mockImplementationOnce(async () => new Response('', {status: 503})); const r = await resume({clarificationId: q.id, value: {kind: 'time', time: time('today')}, label: 'Today'}, context(h.store.getState()), 'typed');
    expect(r.messages[0].trace.aiCalls).toHaveLength(1); expect(r.messages[0].trace.path).toContain('fixture: actual failed request'); expect(r.messages[0].trace.dataSentToAi).toBe('fixture data'); expect(r.messages[0]).toMatchObject({payload: {retryAction: {type: 'resume', clarificationId: q.id}}}); expect(r.statePatch).toEqual({});
    h.store.setState(s => ({messages: [...s.messages, ...r.messages]})); expect(h.actions.canRetry('resume-error')).toBe(true); await h.actions.send('New question'); expect(h.actions.canRetry('resume-error')).toBe(false);
    const n = h.store.getState().messages.length; await h.actions.retry('resume-error'); expect(h.store.getState().messages).toHaveLength(n); await unchanged(h, []);
  });
});

describe('CP5 custom identity / bodyweight / trend P3', () => {
  it.each(['exercise_last', 'exercise_best', 'exercise_trend'] as const)('stored custom precedes fuzzy standards for %s and queries only same customKey', async type => {
    const h = await seeded([query(type, null, ' LAT PULLDOWN V2 '), 'Custom trend.']);
    for (const [i, name] of ['Lat pulldown V2', ' lat pulldown v2 ', 'LAT PULLDOWN V2'].entries()) {
      const date = `2026-10-${16 + i}`, s = await h.repo.getByDate(date) ?? session(date);
      s.exercises.push({standardExerciseId: null, customName: name, rawNames: [name], setGroups: [group(1 + i)]}); await h.database.sessions.put(s);
    }
    const before = await h.repo.list(); await h.actions.send('Original custom query'); const m = last(h); expect(m.kind).not.toBe('clarification');
    if (m.kind === 'trend') {expect(m.payload.points.map(p => p.topWeightKg)).toEqual([1, 2, 3]); expect(m.payload.exerciseId).toBeNull();}
    else {expect(m).toMatchObject({payload: {text: expect.stringContaining('3 kg')}}); expect(JSON.stringify(m.payload)).not.toContain('140 lb');}
    await unchanged(h, before);
  });
  it('exact standard alias precedes stored custom; ambiguous custom precedes candidates', async () => {
    const h = setup([query('exercise_last', null, 'bench'), query('exercise_last', null, 'press')]);
    const s = session('2026-10-19', [group(99)], 'ex_bench_press');
    s.exercises.push({standardExerciseId: null, customName: 'bench', rawNames: ['bench'], setGroups: [group(1)]}, {standardExerciseId: null, customName: 'press', rawNames: ['press'], setGroups: [group(2)]});
    await h.database.sessions.add(s); const before = await h.repo.list(); await h.actions.send('bench last?'); expect(last(h)).toMatchObject({payload: {text: expect.stringContaining('99 kg')}});
    await h.actions.send('press last?'); expect(last(h)).toMatchObject({kind: 'text', payload: {text: expect.stringContaining('Last press:')}}); await unchanged(h, before);
  });
  it('typed custom resume keeps target kind and only matching history', async () => {
    const h = setup([query('exercise_last')]); const s = session('2026-10-19'); s.exercises[0] = {standardExerciseId: null, customName: 'Lat pulldown V2', rawNames: [], setGroups: [group(3)]}; await h.database.sessions.add(s);
    const before = await h.repo.list(); await h.actions.send('Last lift?'); await h.actions.send(' lat pulldown v2 '); expect(h.fetcher).toHaveBeenCalledTimes(1); expect(last(h)).toMatchObject({kind: 'text', payload: {text: expect.stringContaining('3 kg')}}); await unchanged(h, before);
  });
  it('unmatched target uses prescribed not-found text', async () => {const h = setup([query('exercise_last', null, 'Zorgon')]); await h.actions.send('Zorgon last?'); expect(last(h)).toMatchObject({payload: {text: "I couldn't find 'Zorgon' in your log or the exercise library."}}); await unchanged(h, []);});
  it.each(['exercise_best', 'exercise_trend'] as const)('pure bodyweight %s is text and never P3', async type => {const h = await seeded([query(type, null, 'pull-up')]), before = await h.repo.list(); await h.actions.send('Pull-up query'); expect(last(h)).toMatchObject({kind: 'text', payload: {text: expect.stringContaining('Only bodyweight sets')}}); expect(h.fetcher).toHaveBeenCalledTimes(1); await unchanged(h, before);});
  it('mixed bodyweight removes null days before threshold; best retains load and exclusion note', async () => {
    const h = setup([query('exercise_trend', null, 'pull-up'), query('exercise_best', null, 'pull-up')]);
    await h.database.sessions.bulkAdd([session('2026-10-16', [group(null)]), session('2026-10-17', [group(null), group(0)]), session('2026-10-18', [group(5)])]); const before = await h.repo.list();
    await h.actions.send('Trend?'); expect(last(h)).toMatchObject({kind: 'trend', payload: {notEnoughData: true, excludesBodyweight: true, points: [{date: '2026-10-17', topWeightKg: 0}, {date: '2026-10-18', topWeightKg: 5}]}});
    await h.actions.send('Best?'); expect(last(h)).toMatchObject({payload: {text: expect.stringContaining(copy.query.weightedOnlyNote)}}); expect(h.fetcher).toHaveBeenCalledTimes(2); await unchanged(h, before);
  });
  it.each([[0, 0, 0], [0, 5, 10], [10, 10, 10]])('numeric series %j sends deterministic summary and preserves zero-base null', async (...weights) => {
    const h = setup([query('exercise_trend', null, 'bench'), '# A trend\n**Values** are stable. One. Two. Three. Four.']);
    await h.database.sessions.bulkAdd(weights.map((w, i) => session(`2026-10-${16+i}`, [group(w)], 'ex_bench_press'))); const before = await h.repo.list();
    await h.actions.send('Trend?'); const sent = JSON.parse(h.requests[1].messages[1].content.split('TREND_DATA:\n')[1]) as TrendData;
    expect(sent.summary).toMatchObject({session_count: 3, first_top_weight_kg: weights[0], last_top_weight_kg: weights[2], change_kg: weights[2]-weights[0], change_percent: weights[0] === 0 ? null : 0, sessions_since_last_increase: weights[2] > weights[0] ? 0 : 2});
    expect(last(h).trace.aiCalls.map(c => c.purpose)).toEqual(['classify', 'trend_interpretation']); expect(last(h).trace.postCheckFlags).toEqual([]); expect(h.fetcher).toHaveBeenCalledTimes(2); expect(sent.sessions[0].date).toBe('Fri 16 Oct'); await unchanged(h, before);
  });
  it('mixed-unit P3 keeps original top sets, converted chart values and calculated summary', async () => {
    const h = await seeded([query('exercise_trend', null, 'lat pulldown'), 'Converted pounds for comparison.']), before = await h.repo.list(); await h.actions.send('Lat progress?');
    const sent = JSON.parse(h.requests[1].messages[1].content.slice('TREND_DATA:\n'.length)) as TrendData;
    expect(sent.mixed_units).toBe(true); expect(sent.summary.best_top_set).toBe('140 lb × 10'); expect(sent.summary.best_top_weight_kg).toBe(63.5); expect(sent.summary.best_date).toBe('Thu 15 Oct');
    expect(last(h)).toMatchObject({kind: 'trend', payload: {mixedUnits: true, notEnoughData: false}}); await unchanged(h, before);
  });
  it('P3 sessions and summaries include only retained weighted dates after excluding bodyweight', async () => {
    const h=setup([query('exercise_trend',null,'pull-up'),'Added load rose.']);
    await h.database.sessions.bulkAdd([session('2026-10-15',[group(null)]),session('2026-10-16',[group(null),group(0)]),session('2026-10-17',[group(5)]),session('2026-10-18',[group(10)])]);const before=await h.repo.list();await h.actions.send('Added load trend?');
    const data=JSON.parse(h.requests[1].messages[1].content.slice('TREND_DATA:\n'.length)) as TrendData;expect(data.sessions.map(s=>s.date)).toEqual(['Fri 16 Oct','Sat 17 Oct','Sun 18 Oct']);expect(data.summary).toMatchObject({session_count:3,change_percent:null,change_kg:10,sessions_since_last_increase:0});expect(last(h)).toMatchObject({payload:{excludesBodyweight:true,notEnoughData:false}});await unchanged(h,before);
  });
  it('JSON mode fallback plus successful P3 retains all three actual requests', async () => {
    const h=await seeded([new Response('response_format unsupported',{status:400}),query('exercise_trend',null,'bench'),'Stable.']);h.settings.model='cp5-fallback-fixture';const before=await h.repo.list();await h.actions.send('Bench trend?');
    expect(h.fetcher).toHaveBeenCalledTimes(3);expect(last(h).trace.aiCalls.map(c=>[c.purpose,c.attempt])).toEqual([['classify','first'],['classify','json_mode_fallback'],['trend_interpretation','first']]);await unchanged(h,before);
  });
  it.each([new Response('', {status: 503}), new Error('network fixture')])('P3 failure preserves points and trace without error-card retry', async failure => {
    const h = await seeded([query('exercise_trend', null, 'bench'), failure]), before = await h.repo.list(); await h.actions.send('Bench trend?');
    expect(last(h)).toMatchObject({kind: 'trend', payload: {notEnoughData: false, interpretation: null, points: expect.any(Array)}}); expect(last(h).trace.aiCalls).toHaveLength(2); expect(last(h).trace.aiCalls[1].error).not.toBeNull(); expect(last(h).trace.dataSentToAi).toContain('8 sessions'); await unchanged(h, before);
  });
  it('candidate P3 failure consumes resume successfully and retains failed request trace', async () => {
    const h = await seeded([query('exercise_trend', null, 'press'), new Response('', {status: 503})]); const before = await h.repo.list(); await h.actions.send('Original trend'); const q = last(h); await h.actions.choose(q.id, chosen(q));
    expect(last(h)).toMatchObject({kind: 'trend', payload: {interpretation: null}}); expect(last(h).trace.aiCalls).toHaveLength(1); expect(last(h).trace.aiCalls[0].error?.status).toBe(503); expect(last(h).trace.dataSentToAi).not.toBeNull(); expect(h.store.getState().pendingResume).toBeNull(); await unchanged(h, before);
  });
  it('P3 actual timeout is one failed interpretation and keeps deterministic trend', async () => {
    const h = await seeded([query('exercise_trend', null, 'bench')]); h.fetcher.mockImplementationOnce(async () => new Response(JSON.stringify({choices: [{message: {content: JSON.stringify(query('exercise_trend', null, 'bench'))}}]})));
    h.fetcher.mockImplementationOnce(async (_u, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
    vi.useFakeTimers(); const run = h.actions.send('Bench trend?'); await vi.advanceTimersByTimeAsync(0); await vi.waitFor(() => expect(h.fetcher).toHaveBeenCalledTimes(2)); await vi.advanceTimersByTimeAsync(30000); await run; vi.useRealTimers();
    expect(last(h)).toMatchObject({kind: 'trend', payload: {interpretation: null}}); expect(last(h).trace.aiCalls[1].error?.kind).toBe('timeout');
  });
  it('classification JSON retry and P3 are all retained as actual calls', async () => {
    const h = await seeded(['invalid', query('exercise_trend', null, 'bench'), 'Stable.']); const before = await h.repo.list(); await h.actions.send('Bench trend?');
    expect(last(h).trace.aiCalls.map(c => [c.purpose, c.attempt])).toEqual([['classify', 'first'], ['classify', 'json_retry'], ['trend_interpretation', 'first']]); expect(h.fetcher).toHaveBeenCalledTimes(3); await unchanged(h, before);
  });
  it('core query and P3 traces redact current key; prompt quotes are cleaned and no post-check claimed', async () => {
    const h = setup([]); const name = `Custom """ ${h.settings.apiKey}`; const data = [0,1,2].map((w,i) => {const s=session(`2026-10-${16+i}`, [group(w)]); s.exercises[0].standardExerciseId=null; s.exercises[0].customName=name; return s;}); await h.database.sessions.bulkAdd(data);
    h.queue.push('Stable.'); const ctx = h.context(), trace = createTrace(h.settings.apiKey, () => 0);
    const r = await queryReply(querySlotsSchema.parse({query_type: 'exercise_trend', exercise_raw_name: name}), 'Original', ctx, trace.value);
    expect(JSON.stringify(r.messages[0].trace)).not.toContain(h.settings.apiKey); expect(h.requests[0].messages[1].content).toContain("Custom '' [redacted]"); expect(r.messages[0].trace.postCheckFlags).toEqual([]);
  });
  it('P3 builder follows exact parameters and never sends arbitrary history/notes', () => {
    const data: TrendData = {exercise: 'lift""""', range: 'range', mixed_units: false, sessions: [], summary: {session_count: 0, first_top_weight_kg: 0, last_top_weight_kg: 0, best_top_set: '', best_top_weight_kg: 0, best_date: '', change_kg: 0, change_percent: null, sessions_since_last_increase: 0}};
    const r = buildTrend(data); expect(r).toMatchObject({temperature: 0.2, maxTokens: 300, expectJson: false}); expect(r.messages).toHaveLength(2); expect(r.messages[0].content).toContain('If change_percent is null'); expect(r.messages[1].content).toContain("lift''"); expect(r.messages[1].content).not.toContain('USER_MESSAGE');
  });
  it('P3 postprocessing preserves decimals and first four sentences while removing Markdown', () => {
    expect(cleanInterpretation('# Trend\n**Your** top was 62.5 kg. It rose 7.5 kg! Stable? Fourth. Fifth.')).toBe('Trend\nYour top was 62.5 kg. It rose 7.5 kg! Stable? Fourth.');
    expect(cleanInterpretation('- Plain interpretation without punctuation')).toBe('Plain interpretation without punctuation');
  });
  it('old candidate direct resume validates before any training reads', async () => {
    const h = setup([query('exercise_trend', null, 'press'), query('session_count', time('this_week'))]); await h.actions.send('Q1'); const q=last(h); await h.actions.send('Q2'); const read=vi.spyOn(h.repo,'list'), names=vi.spyOn(h.repo,'customNames');
    const r=await resume({clarificationId:q.id,value:{kind:'exercise',target:{kind:'standard',id:'ex_bench_press'}},label:'Bench'}, h.context(h.store.getState())); expect(r).toEqual({messages:[],statePatch:{}}); expect(read).not.toHaveBeenCalled(); expect(names).not.toHaveBeenCalled(); await unchanged(h, []);
  });
  it('queries discard old record draft and original inputs without saving', async () => {
    const h = setup([record({exercises:[exercise('bench',{sets:null})]}),query('session_count',time('this_week'))]); await h.actions.send('Bench 60kg'); await h.actions.send('Count?'); expect(h.store.getState().pendingDraft).toBeNull(); expect(h.store.getState().clarificationCount).toBe(0); await unchanged(h, []);
  });
  it('single-date and explicit range label resolves with code, including prior-year date', async () => {
    const h = setup([query('session_count',time('date',{month:12,day:25})),query('exercise_trend',time('last_n_days',{n:10}),'bench')]); await h.actions.send('Christmas?'); expect(last(h)).toMatchObject({payload:{text:'No sessions logged on Thu 25 Dec 2025.'}}); await h.actions.send('10 day trend'); expect(last(h)).toMatchObject({kind:'trend',payload:{rangeLabel:'in the last 10 days'}}); await unchanged(h, []);
  });
  it('direct query dispatch uses read-only context and Rules v1', async () => {
    const h = setup([query('session_count',time('today'))]); h.settings.ruleVersion='v1'; const r=await handleMessage('Today?',h.context()); expect(r.messages[0].trace.ruleVersion).toBe('v1'); expect(r.messages[0].trace.path).toContain('risk_check: skipped (v1)'); expect(fmtDate('2026-10-20',NOW)).toBe('Tue 20 Oct');
  });
});
