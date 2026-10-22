import { vi } from 'vitest';
import { createLlmClient } from '../core/llm/client';
import { classificationSchema, recordSlotsSchema } from '../core/llm/schemas';
import { DEFAULT_SETTINGS } from '../core/settings/settings';
import { LiftLogDB } from '../core/db/schema';
import { createSessionsRepo } from '../core/db/sessionsRepo';
import { initialChat, createChatStore, createChatActions } from '../state/chatStore';
import type { ChatStateSnapshot, PipelineContext, RecordSlots } from '../core/pipeline/types';
export const NOW = new Date('2026-10-20T10:00:00');
export const slots = (overrides: object = {}): RecordSlots => recordSlotsSchema.parse({draft_action: 'new', exercises: [{raw_name: 'Bench', set_groups: [{weight: 60, unit: 'kg', sets: 3, reps: 8}]}], ...overrides});
export const record = (overrides: object = {}, confidence: unknown = 0.95) => ({intent: 'record_workout', confidence, reason: '', slots: slots(overrides), clarification: {question: null, options: []}});
export const classified = (intent: string, intentSlots: object, confidence = 0.95, clarification = {question: null as string | null, options: [] as string[]}) => classificationSchema.parse({intent, slots: intentSlots, confidence, clarification});
export const exercise = (raw_name: string, group: object = {}) => ({raw_name, set_groups: [{weight: 60, unit: 'kg', sets: 3, reps: 8, ...group}]});
export function harness(responses: unknown[] = []) {
  const database = new LiftLogDB(`cp4-${crypto.randomUUID()}`), repo = createSessionsRepo(database);
  const requests: {messages: {role: string; content: string}[]}[] = [];
  const queue = [...responses];
  const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
    requests.push(JSON.parse(String(init?.body)) as typeof requests[number]);
    const next = queue.shift();
    if (next instanceof Error) throw next;
    if (next instanceof Response) return next;
    return new Response(JSON.stringify({choices: [{message: {content: typeof next === 'string' ? next : JSON.stringify(next)}}]}), {status: 200});
  });
  const settings = {...DEFAULT_SETTINGS, apiKey: 'cp4-fixture-key', ruleVersion: 'v1' as const};
  const llm = createLlmClient(settings, {fetch: fetcher, now: () => NOW.getTime()});
  const context = (state: ChatStateSnapshot = initialChat()): PipelineContext => ({settings, state, repo, now: NOW, llm});
  const store = createChatStore(), actions = createChatActions(store, {context});
  return {database, repo, requests, fetcher, queue, settings, llm, context, store, actions};
}
