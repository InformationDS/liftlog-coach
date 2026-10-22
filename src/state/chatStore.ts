import { create } from 'zustand';
import { handleMessage } from '../core/pipeline/handleMessage';
import { resume, validResume } from '../core/pipeline/resume';
import { createLlmClient } from '../core/llm/client';
import { readSettings } from '../core/settings/settings';
import { sessionsRepo } from '../core/db/sessionsRepo';
import { clearContext, type ChatStateSnapshot, type PipelineContext, type PipelineResult, type ConfirmCardPayload, type ClarificationPayload } from '../core/pipeline/types';
export interface ChatStore extends ChatStateSnapshot {usedRetries: string[]; updateCard: (id: string, payload: ConfirmCardPayload) => void}
export const initialChat = (): ChatStateSnapshot => ({messages: [], ...clearContext(), busy: false});
export const createChatStore = () => create<ChatStore>((set) => ({...initialChat(), usedRetries: [], updateCard: (id, payload) => set(s => ({messages: s.messages.map(m => m.id === id && m.role === 'assistant' && m.kind === 'confirm_card' ? {...m, payload} : m)}))}));
export const useChatStore = createChatStore();
export type ChatStoreApi = ReturnType<typeof createChatStore>;
export function createChatActions(store: ChatStoreApi, dependencies: {context?: (state: ChatStateSnapshot) => PipelineContext} = {}) {
  const context = (state: ChatStateSnapshot): PipelineContext => {
    if (dependencies.context) return dependencies.context(state);
    const settings = readSettings();
    return {settings, state, repo: sessionsRepo, now: new Date(), clock: () => performance.now(), llm: createLlmClient(settings)};
  };
  async function run(label: string, task: (ctx: PipelineContext) => Promise<PipelineResult>, retryId?: string): Promise<void> {
    const state = store.getState();
    if (state.busy) return;
    const ctx = context(state);
    store.setState({busy: true, messages: [...state.messages, {id: crypto.randomUUID(), role: 'user', text: label, at: ctx.now.toISOString()}]});
    try {
      const result = await task(ctx);
      store.setState(s => ({...result.statePatch, messages: [...s.messages, ...result.messages],
        usedRetries: result.messages.length && !result.messages.some(m => m.kind === 'error')
          ? [...new Set([...s.usedRetries, ...state.messages.filter(m => m.role === 'assistant' && m.kind === 'error').map(m => m.id), ...(retryId ? [retryId] : [])])] : s.usedRetries}));
    } finally {store.setState({busy: false});}
  }
  const send = async (text: string) => {if (text.trim() && text.length <= 500) await run(text, ctx => handleMessage(text, ctx));};
  const choose = async (clarificationId: string, action: ClarificationPayload['options'][number]['action']) => {
    const state = store.getState();
    if (state.busy || state.activeClarificationId !== clarificationId) return;
    const message = state.messages.find(m => m.id === clarificationId);
    if (message?.role !== 'assistant' || message.kind !== 'clarification') return;
    const option = message.payload.options.find(o => JSON.stringify(o.action) === JSON.stringify(action));
    if (!option) return;
    if (action.type === 'resume' && !validResume(context(state), clarificationId, action.value)) return;
    await run(option.label, async ctx => {
      if (action.type === 'resume') return resume({clarificationId, value: action.value, label: option.label}, ctx);
      const result = await handleMessage(action.text, {...ctx, state: {...ctx.state, pendingResume: null}});
      return {...result, statePatch: {pendingResume: null, ...result.statePatch}};
    });
  };
  const canRetry = (id: string): boolean => {
    const state = store.getState(), m = state.messages.find(m => m.id === id);
    if (state.busy || state.usedRetries.includes(id) || m?.role !== 'assistant' || m.kind !== 'error') return false;
    const a = m.payload.retryAction;
    return a.type === 'send_text' || validResume(context(state), a.clarificationId, a.value, 'retry');
  };
  const retry = async (id: string) => {
    if (!canRetry(id)) return;
    const m = store.getState().messages.find(m => m.id === id);
    if (m?.role !== 'assistant' || m.kind !== 'error') return;
    const a = m.payload.retryAction;
    await run(a.type === 'send_text' ? a.text : a.label, ctx => a.type === 'send_text' ? handleMessage(a.text, ctx) : resume(a, ctx, 'retry'), id);
  };
  return {send, choose, retry, canRetry};
}
export const chatActions = createChatActions(useChatStore);
