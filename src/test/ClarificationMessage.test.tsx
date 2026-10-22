import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClarificationMessage } from '../ui/chat/messages/ClarificationMessage';
import { ErrorMessage } from '../ui/chat/messages/ErrorMessage';
import { resume, validResume, extensionError } from '../core/pipeline/resume';
import { handleMessage } from '../core/pipeline/handleMessage';
import { createChatActions } from '../state/chatStore';
import { adviceSlotsSchema, querySlotsSchema, timeSchema } from '../core/llm/schemas';
import type { ChatStateSnapshot, AssistantMessage, ClarificationPayload, PendingResume, PipelineContext, PipelineResult, ResumeValue } from '../core/pipeline/types';
import { NOW, harness, record } from './cp4Fixtures';

const trace = () => ({ruleVersion: 'v1' as const, path: [], aiCalls: [], safetyRuleHit: null, dataSentToAi: null, postCheckFlags: [], totalLatencyMs: 0});
const timeValue: ResumeValue = {kind: 'time', time: timeSchema.parse({raw_text: 'This week', type: 'this_week'})};
function fixture(value: ResumeValue = timeValue, label = 'This week') {
  const h = harness([record()]);
  const payload: ClarificationPayload = {clarificationId: 'q1', question: 'Fixture clarification', options: [{label, action: {type: 'resume', value}}]};
  const pending: PendingResume = {clarificationId: 'q1', intent: value.kind === 'time' ? 'query_training' : 'get_advice', slots: value.kind === 'time' ? querySlotsSchema.parse({query_type: 'session_count'}) : adviceSlotsSchema.parse({advice_type: value.kind === 'body_part' ? 'body_part' : 'exercise', user_question: 'MODEL REWRITE'}), originalUserText: 'Original question with sore shoulder', missing: value.kind, createdAt: NOW.toISOString()};
  const message: AssistantMessage = {id: 'q1', role: 'assistant', at: NOW.toISOString(), kind: 'clarification', payload, trace: trace()};
  h.store.setState({messages: [message], pendingResume: pending, activeClarificationId: 'q1'});
  const invoke = vi.fn<(pending: PendingResume, value: ResumeValue, ctx: PipelineContext) => Promise<PipelineResult>>(async () => ({messages: [], statePatch: {}}));
  const context = (state: ChatStateSnapshot = h.store.getState()): PipelineContext => ({...h.context(state), extensions: {dispatch: async () => ({messages: [], statePatch: {}}), resume: invoke}});
  const actions = createChatActions(h.store, {context});
  return {...h, payload, pending, invoke, context, actions};
}
describe('CP4 structured resume scaffolding / component fixtures §2.17', () => {
  it('current buttons enabled, old ID and busy disabled', () => {
    const h = fixture(); const choose = vi.fn(async () => {});
    const view = render(<ClarificationMessage payload={h.payload} activeId="q1" busy={false} onChoose={choose} />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false); fireEvent.click(screen.getByRole('button')); expect(choose).toHaveBeenCalledWith('q1', h.payload.options[0].action);
    view.rerender(<ClarificationMessage payload={h.payload} activeId="q2" busy={false} onChoose={choose} />); expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    view.rerender(<ClarificationMessage payload={h.payload} activeId="q1" busy onChoose={choose} />); fireEvent.click(screen.getByRole('button')); expect(choose).toHaveBeenCalledTimes(1);
  });
  it.each([timeValue, {kind: 'exercise', target: {kind: 'standard', id: 'ex_back_squat'}}, {kind: 'body_part', id: 'back'}] as ResumeValue[])('structured %j reaches fixture handler without classification', async value => {
    const h = fixture(value, 'Arbitrary label'); await h.actions.choose('q1', h.payload.options[0].action);
    expect(h.invoke).toHaveBeenCalledTimes(1); expect(h.invoke.mock.calls[0][1]).toEqual(value); expect(h.invoke.mock.calls[0][0].originalUserText).toBe(h.pending.originalUserText); expect(h.fetcher).not.toHaveBeenCalled(); expect(await h.repo.list()).toEqual([]);
    expect(h.store.getState().pendingResume).toBeNull(); expect(h.store.getState().messages.filter(m => m.role === 'user')).toMatchObject([{text: 'Arbitrary label'}]);
    const size = h.store.getState().messages.length; await h.actions.choose('q1', h.payload.options[0].action); expect(h.invoke).toHaveBeenCalledTimes(1); expect(h.store.getState().messages).toHaveLength(size);
  });
  it.each(['old-id', 'wrong-kind', 'unoffered-value', 'invalid-standard', 'empty-custom', 'invalid-body-part', 'busy'] as const)('rejects %s before any reads, models, messages or context mutation', async variant => {
    const h = fixture(); let value: ResumeValue = timeValue; let id = 'q1';
    if (variant === 'old-id') id = 'q0';
    if (variant === 'wrong-kind') value = {kind: 'body_part', id: 'back'};
    if (variant === 'unoffered-value') value = {kind: 'time', time: timeSchema.parse({type: 'yesterday', raw_text: 'Yesterday'})};
    if (variant === 'invalid-standard') {h.store.setState({pendingResume: {...h.pending, missing: 'exercise'}}); value = {kind: 'exercise', target: {kind: 'standard', id: 'bad'}};}
    if (variant === 'empty-custom') {h.store.setState({pendingResume: {...h.pending, missing: 'exercise'}}); value = {kind: 'exercise', target: {kind: 'custom', name: ' '}};}
    if (variant === 'invalid-body-part') {h.store.setState({pendingResume: {...h.pending, missing: 'body_part'}}); value = {kind: 'body_part', id: 'arms'};}
    if (variant === 'busy') h.store.setState({busy: true});
    const read = vi.spyOn(h.repo, 'customNames'); const before = structuredClone(h.store.getState().messages), pending = structuredClone(h.store.getState().pendingResume);
    const r = await resume({clarificationId: id, value, label: 'do not send'}, h.context()); expect(r).toEqual({messages: [], statePatch: {}});
    await h.actions.choose(id, {type: 'resume', value}); expect(h.invoke).not.toHaveBeenCalled(); expect(h.fetcher).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled(); expect(h.store.getState().messages).toEqual(before); expect(h.store.getState().pendingResume).toEqual(pending);
  });
  it('Back error retries original structured operation, preserves original question, shared busy and expiry', async () => {
    const h = fixture({kind: 'body_part', id: 'back'}, 'Back');
    h.invoke.mockImplementationOnce(async (_p, _v, ctx) => extensionError(ctx, 'timeout')).mockImplementationOnce(async () => ({messages: [{id: 'done', role: 'assistant', at: NOW.toISOString(), kind: 'text', payload: {text: 'Fixture completed'}, trace: trace()}], statePatch: {}}));
    await h.actions.choose('q1', h.payload.options[0].action); const error = h.store.getState().messages.at(-1);
    expect(error).toMatchObject({kind: 'error', payload: {retryAction: {type: 'resume', clarificationId: 'q1', value: {kind: 'body_part', id: 'back'}, label: 'Back'}}});
    expect(h.store.getState().pendingResume).toEqual(h.pending); expect(h.store.getState().activeClarificationId).toBe('q1');
    const id = error!.id; expect(h.actions.canRetry(id)).toBe(true); h.store.setState({busy: true}); await h.actions.retry(id); expect(h.invoke).toHaveBeenCalledTimes(1); h.store.setState({busy: false});
    await h.actions.retry(id); expect(h.invoke).toHaveBeenCalledTimes(2); expect(h.invoke.mock.calls[1][1]).toEqual({kind: 'body_part', id: 'back'}); expect(h.invoke.mock.calls[1][0].originalUserText).toBe(h.pending.originalUserText); expect(h.fetcher).not.toHaveBeenCalled();
    const size = h.store.getState().messages.length; await h.actions.retry(id); await h.actions.choose('q1', h.payload.options[0].action); expect(h.store.getState().messages).toHaveLength(size);
  });
  it('typed custom failure retries stored validated custom absent from original options; ignores event substitute', async () => {
    const h = fixture({kind: 'exercise', target: {kind: 'standard', id: 'ex_bench_press'}}, 'Bench'); h.payload.options = [];
    vi.spyOn(h.repo, 'customNames').mockResolvedValue(['Lat pulldown V2']);
    h.invoke.mockImplementationOnce(async (_p, _v, ctx) => extensionError(ctx, 'network')).mockImplementationOnce(async () => ({messages: [{id: 'done', role: 'assistant', at: NOW.toISOString(), kind: 'text', payload: {text: 'Fixture completed'}, trace: trace()}], statePatch: {}}));
    const ctx = h.context(); const r = await handleMessage(' lat pulldown v2 ', ctx);
    h.store.setState(s => ({messages: [...s.messages, ...r.messages], ...r.statePatch}));
    expect(h.invoke.mock.calls[0][1]).toEqual({kind: 'exercise', target: {kind: 'custom', name: 'Lat pulldown V2'}}); const id = r.messages[0].id;
    expect(r.messages[0]).toMatchObject({kind: 'error', payload: {retryAction: {type: 'resume', value: {kind: 'exercise', target: {kind: 'custom', name: 'Lat pulldown V2'}}}}});
    // The only accepted event field is the source error ID. A forged extra field cannot replace its saved action.
    await (h.actions.retry as (id: string, forged: ResumeValue) => Promise<void>)(id, {kind: 'body_part', id: 'legs'});
    expect(h.invoke.mock.calls[1][1]).toEqual({kind: 'exercise', target: {kind: 'custom', name: 'Lat pulldown V2'}}); expect(h.fetcher).not.toHaveBeenCalled(); expect(h.store.getState().pendingResume).toBeNull();
  });
  it('old resume retry becomes invalid when a new question takes ownership', async () => {
    const h = fixture({kind: 'body_part', id: 'back'}, 'Back'); h.invoke.mockImplementationOnce(async (_p, _v, ctx) => extensionError(ctx, 'timeout'));
    await h.actions.choose('q1', h.payload.options[0].action); const error = h.store.getState().messages.at(-1)!;
    h.store.setState({pendingResume: {...h.pending, clarificationId: 'q2'}, activeClarificationId: 'q2'}); const before = structuredClone(h.store.getState().messages);
    await h.actions.retry(error.id); expect(h.invoke).toHaveBeenCalledTimes(1); expect(h.store.getState().messages).toEqual(before); expect(h.actions.canRetry(error.id)).toBe(false);
  });
  it('ErrorMessage emits only source ID and obeys disabled', () => {
    const retry = vi.fn(async () => {}); const payload = {error: 'timeout' as const, retryAction: {type: 'send_text' as const, text: 'original'}};
    const view = render(<ErrorMessage id="error1" payload={payload} disabled={false} onRetry={retry} />); fireEvent.click(screen.getByRole('button', {name: 'Try again'})); expect(retry).toHaveBeenCalledWith('error1');
    view.rerender(<ErrorMessage id="error1" payload={payload} disabled onRetry={retry} />); fireEvent.click(screen.getByRole('button')); expect(retry).toHaveBeenCalledTimes(1);
  });
  it('typed time uses exact full phrase; new question clears old resume before classification error', async () => {
    const h = fixture(); await handleMessage('  THIS   month ', h.context()); expect(h.invoke.mock.calls[0][1]).toEqual({kind: 'time', time: timeSchema.parse({type: 'this_month', raw_text: '  THIS   month '})}); expect(h.fetcher).not.toHaveBeenCalled();
    h.queue.splice(0, h.queue.length, new Error()); const r = await handleMessage('How many sets did I do this month?', h.context()); expect(r.messages[0].kind).toBe('error'); expect(r.statePatch).toEqual({pendingResume: null, activeClarificationId: null, clarificationCount: 0});
  });
  it('rapid duplicate clicks share synchronous busy lock, original options restored after failure', async () => {
    const h = fixture({kind: 'body_part', id: 'back'}, 'Back'); let release!: () => void; const pause = new Promise<void>(r => {release = r;});
    h.invoke.mockImplementationOnce(async (_p, _v, ctx) => {await pause; return extensionError(ctx, 'timeout');});
    const first = h.actions.choose('q1', h.payload.options[0].action); await h.actions.choose('q1', h.payload.options[0].action); expect(h.invoke).toHaveBeenCalledTimes(1); expect(h.store.getState().busy).toBe(true);
    await act(async () => release()); await first; expect(h.store.getState().busy).toBe(false); expect(validResume(h.context(), 'q1', timeValue)).toBe(false); expect(h.store.getState().activeClarificationId).toBe('q1');
  });
});

