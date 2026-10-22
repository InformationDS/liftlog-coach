import { adviceReply } from '../intents/advice/replies';
import { copy } from '../copy';
import { reject } from '../intents/reject';
import { buildDraft } from '../intents/record/buildDraft';
import { queryReply } from '../intents/query/replies';
import { resolveExerciseTarget } from '../kb/exerciseMatcher';
import { promptSets } from '../prompts/builder';
import { riskCheck } from '../safety/riskCheck';
import { matchSafetyRule } from '../safety/regexRules';
import { createTrace } from '../trace/trace';
import { matchTimeReply } from '../time/resolve';
import { resume } from './resume';
import { clearContext, emptyResult, nextId, type PipelineContext, type PipelineResult, type AssistantMessage, type ContextState, type ResumeValue } from './types';
export async function handleMessage(text: string, ctx: PipelineContext): Promise<PipelineResult> {
  if (ctx.state.busy || !text.trim()) return emptyResult();
  const trace = createTrace(ctx.settings.apiKey, ctx.clock ?? (() => ctx.now.getTime()), ctx.settings.ruleVersion);
  let state = {...ctx.state};
  let patch: Partial<ContextState> = {};
  const result = (message: AssistantMessage, statePatch = patch): PipelineResult => ({messages: [{...message, trace: trace.finish()}], statePatch});
  const base = () => ({id: nextId(ctx), role: 'assistant' as const, at: ctx.now.toISOString(), trace: trace.value});
  const hit = matchSafetyRule(text, ctx.settings.ruleVersion);
  trace.step(`safety_regex: ${hit ? `hit ${hit.id}` : 'miss'}`);
  if (hit) {trace.value.safetyRuleHit = hit.id; return result({...base(), kind: 'refusal', payload: reject(hit.category, 'regex')}, clearContext());}
  const pending = state.pendingResume;
  if (pending && pending.clarificationId === state.activeClarificationId) {
    let value: ResumeValue | null = null;
    if (pending.missing === 'time') {const time = matchTimeReply(text); if (time) value = {kind: 'time', time};}
    if (pending.missing === 'exercise') {
      const target = resolveExerciseTarget(text, await ctx.repo.customNames());
      if (target.kind === 'standard' || target.kind === 'custom') value = {kind: 'exercise', target};
    }
    if (value) return resume({clarificationId: pending.clarificationId, value, label: text}, ctx, 'typed', trace.finish());
    patch = {pendingResume: null, activeClarificationId: null, clarificationCount: 0};
    state = {...state, ...patch};
  }
  if (!ctx.settings.apiKey.trim()) {trace.step('no_key: stop'); return result({...base(), kind: 'error', payload: {error: 'no_key', retryAction: {type: 'send_text', text}}});}
  const risk = await riskCheck(text, ctx.settings.ruleVersion, ctx.llm, trace);
  if (risk.action === 'reject') return result({...base(), kind: 'refusal', payload: reject(risk.category, 'risk_check')}, clearContext());
  if (risk.action === 'error') return result({...base(), kind: 'error', payload: {error: risk.error, retryAction: {type: 'send_text', text}}});
  const response = await ctx.llm.call('classify', promptSets[ctx.settings.ruleVersion].classify(text, state.pendingDraft?.slots ?? null, ctx.now));
  trace.value.aiCalls.push(...response.logs);
  if (!response.ok) {trace.step(`classify: error (${response.error})`); return result({...base(), kind: 'error', payload: {error: response.error, retryAction: {type: 'send_text', text}}});}
  const c = response.data;
  trace.step(`intent: ${c.intent} (${c.confidence})`);
  if (c.intent === 'dangerous_health_query' || c.intent === 'destructive_operation') {
    trace.step(`reject: ${c.intent}/${c.slots.category}`);
    return result({...base(), kind: 'refusal', payload: reject(c.slots.category, 'model')}, clearContext());
  }
  if (c.confidence < 0.65) {
    trace.step('confidence_gate: ask');
    const count = state.clarificationCount + 1;
    if (count > 2) return result({...base(), kind: 'text', payload: {text: state.pendingDraft ? copy.record.giveUp : copy.unknown.giveUp}}, clearContext());
    const message = base();
    const options = c.clarification.options.length === 2 ? c.clarification.options : copy.clarify.fallbackOptions;
    return result({...message, kind: 'clarification', payload: {clarificationId: message.id, question: c.clarification.question ?? copy.record.askExercises,
      options: options.map(text => ({label: text, action: {type: 'send_text', text}}))}}, {...patch, pendingResume: null, clarificationCount: count, activeClarificationId: message.id});
  }
  if (c.intent !== 'record_workout') {
    if (c.intent === 'unknown' && c.slots.category === 'vague') {
      const count = state.pendingDraft ? 1 : state.clarificationCount + 1;
      trace.step('confidence_gate: vague');
      if (count > 2) return result({...base(), kind: 'text', payload: {text: copy.unknown.giveUp}}, clearContext());
      const message = base();
      const options = c.clarification.options.length === 2 ? c.clarification.options : copy.clarify.fallbackOptions;
      return result({...message, kind: 'clarification', payload: {clarificationId: message.id, question: c.clarification.question ?? copy.record.askExercises,
        options: options.map(text => ({label: text, action: {type: 'send_text', text}}))}}, {...clearContext(), clarificationCount: count, activeClarificationId: message.id});
    }
    const clean = {...ctx, state: {...state, ...clearContext()}};
    if (c.intent === 'get_advice' && !ctx.extensions) return adviceReply(c.slots, text, clean, trace.finish());
    if (c.intent === 'unknown' && !ctx.extensions) {
      trace.step(`unknown: ${c.slots.category}`);
      return result({...base(), kind:'text',payload:{text:c.slots.category === 'chitchat' ? copy.unknown.chitchat : c.slots.category === 'out_of_scope' ? copy.refusal.outOfScope : copy.refusal.unsupported}},clearContext());
    }
    if (c.intent === 'query_training' && !ctx.extensions) return queryReply(c.slots, text, clean, trace.finish());
    if (ctx.extensions) {
      const dispatched = await ctx.extensions.dispatch(c.intent, c.slots, text, clean, trace.finish());
      return {...dispatched, statePatch: {...clearContext(), ...dispatched.statePatch}};
    }
    trace.step(`deferred: ${c.intent}`);
    return result({...base(), kind: 'text', payload: {text: copy.chat.recordingOnly}}, clearContext());
  }
  const old = c.slots.draft_action === 'continue' ? state.pendingDraft : null;
  const rawTexts = [...(old?.rawTexts ?? []), text];
  const count = old ? state.clarificationCount : 0;
  const createdAt = old?.createdAt ?? ctx.now.toISOString();
  if (!c.slots.exercises.length && c.slots.cardio_items.length) {trace.step('record: cardio only'); return result({...base(), kind: 'text', payload: {text: copy.record.cardioOnly}}, clearContext());}
  const built = buildDraft(c.slots, rawTexts, ctx.settings.defaultUnit, ctx.now);
  for (const e of built.draft.exercises) trace.step(`match: "${e.rawName}" = ${e.match.standardExerciseId ?? e.match.candidates.join(',')} (${e.match.status})`);
  if (built.question) {
    trace.step(`record: ${built.question}`);
    if (count + 1 > 2) return result({...base(), kind: 'text', payload: {text: copy.record.giveUp}}, clearContext());
    const message = base();
    return result({...message, kind: 'clarification', payload: {clarificationId: message.id, question: !c.slots.exercises.length ? c.clarification.question ?? built.question : built.question, options: []}}, {
      pendingDraft: {slots: c.slots, rawTexts, createdAt}, pendingResume: null, clarificationCount: count + 1, activeClarificationId: message.id,
    });
  }
  const existing = await ctx.repo.getByDate(built.draft.date);
  built.draft.feelingReplaces = existing?.feeling && built.draft.feeling !== null && existing.feeling !== built.draft.feeling ? existing.feeling : null;
  trace.step(`record: ${existing ? 'append to' : 'draft for'} ${built.draft.date}`);
  return result({...base(), kind: 'confirm_card', payload: {status: 'draft', draft: built.draft, appendTo: existing ? {sessionId: existing.id, date: existing.date, exerciseCount: existing.exercises.length} : null, skippedCardio: c.slots.cardio_items}}, clearContext());
}
