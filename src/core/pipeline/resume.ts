import { resumeAdvice } from '../intents/advice/replies';
import { bodyPartSchema, timeSchema } from '../llm/schemas';
import { customKey, exerciseLibrary } from '../kb/exerciseMatcher';
import { createTrace } from '../trace/trace';
import { resumeQuery } from '../intents/query/replies';
import { scrubSecrets } from '../llm/client';
import { clearContext, emptyResult, nextId, type PipelineContext, type PipelineResult, type ResumeValue, type Trace } from './types';
export function validResume(ctx: PipelineContext, clarificationId: string, value: ResumeValue, source: 'option' | 'typed' | 'retry' = 'option'): boolean {
  const pending = ctx.state.pendingResume;
  if (ctx.state.busy || !pending || clarificationId !== ctx.state.activeClarificationId || pending.clarificationId !== clarificationId || pending.missing !== value.kind) return false;
  if (value.kind === 'time' && !timeSchema.safeParse(value.time).success) return false;
  if (value.kind === 'body_part' && !bodyPartSchema.safeParse(value.id).success) return false;
  if (value.kind === 'exercise') {
    if (value.target.kind === 'standard' ? !exerciseLibrary.exercises.some(e => e.id === (value.target.kind === 'standard' ? value.target.id : null)) : value.target.kind !== 'custom' || !customKey(value.target.name)) return false;
  }
  if (source === 'option') {
    const message = ctx.state.messages.find(m => m.id === clarificationId && m.role === 'assistant' && m.kind === 'clarification');
    if (!message || message.role !== 'assistant' || message.kind !== 'clarification' || !message.payload.options.some(o => o.action.type === 'resume' && JSON.stringify(o.action.value) === JSON.stringify(value))) return false;
  }
  return true;
}
export async function resume(input: {clarificationId: string; value: ResumeValue; label: string}, ctx: PipelineContext, source: 'option' | 'typed' | 'retry' = 'option', priorTrace?: Trace): Promise<PipelineResult> {
  if (!validResume(ctx, input.clarificationId, input.value, source)) return emptyResult();
  const trace = createTrace(ctx.settings.apiKey, ctx.clock ?? (() => ctx.now.getTime()), ctx.settings.ruleVersion);
  if (priorTrace) Object.assign(trace.value, priorTrace);
  const v = input.value;
  trace.step(`resume: ${v.kind} = ${v.kind === 'exercise' ? v.target.kind === 'standard' ? v.target.id : v.target.name : v.kind === 'body_part' ? v.id : v.time.type}`);
  const pending = ctx.state.pendingResume!;
  const handled = ctx.extensions ? await ctx.extensions.resume(pending, v, ctx, trace.value) : pending.intent === 'get_advice' ? await resumeAdvice(pending, v, ctx, trace.value) : await resumeQuery(pending, v, ctx, trace.value);
  const result = {...handled, messages: handled.messages.map(m => ({...m, trace: JSON.parse(scrubSecrets(JSON.stringify(m.trace), ctx.settings.apiKey)) as Trace}))};
  // The handler owns its completed Trace, including subsequent calls and failures.
  if (result.messages.some(m => m.kind === 'error')) return {messages: result.messages.map(m => m.kind === 'error' ? {...m, payload: {...m.payload, retryAction: {type: 'resume', ...input}}} : m), statePatch: {}};
  return {...result, statePatch: {...clearContext(), ...result.statePatch}};
}
export function extensionError(ctx: PipelineContext, error: import('../llm/client').LlmError): PipelineResult {
  // Typed fixture/extension helper; no query or advice business implementation.
  const trace = createTrace(ctx.settings.apiKey, ctx.clock ?? (() => ctx.now.getTime()), ctx.settings.ruleVersion);
  return {messages: [{id: nextId(ctx), role: 'assistant', at: ctx.now.toISOString(), kind: 'error', payload: {error, retryAction: {type: 'send_text', text: ''}}, trace: trace.finish()}], statePatch: {}};
}

