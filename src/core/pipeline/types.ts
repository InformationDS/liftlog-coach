import type { Classification, TimeSlot } from '../llm/schemas';
import type { Draft, Session } from '../db/schema';
import type { ExerciseTarget } from '../kb/exerciseMatcher';
import type { AiCallLog, LlmClient, LlmError } from '../llm/client';
import type { Settings } from '../settings/settings';
import type { SessionsReadRepo } from '../db/sessionsRepo';
export type RecordSlots = Extract<Classification, {intent: 'record_workout'}>['slots'];
export type QuerySlots = Extract<Classification, {intent: 'query_training'}>['slots'];
export type AdviceSlots = Extract<Classification, {intent: 'get_advice'}>['slots'];
export type ResumeValue = {kind: 'time'; time: TimeSlot} | {kind: 'exercise'; target: ExerciseTarget} | {kind: 'body_part'; id: string};
export interface PendingDraft { slots: RecordSlots; rawTexts: string[]; createdAt: string }
export interface PendingResume {clarificationId: string; intent: 'query_training' | 'get_advice'; slots: QuerySlots | AdviceSlots; originalUserText: string; missing: 'time' | 'exercise' | 'body_part'; createdAt: string}
export type RetryAction = {type: 'send_text'; text: string} | {type: 'resume'; clarificationId: string; value: ResumeValue; label: string};
export interface Trace {ruleVersion: Settings['ruleVersion']; path: string[]; safetyRuleHit: string | null; aiCalls: AiCallLog[]; dataSentToAi: string | null; postCheckFlags: string[]; totalLatencyMs: number}
export interface ConfirmCardPayload {status: 'draft' | 'saved' | 'discarded'; draft: Draft; appendTo: {sessionId: string; date: string; exerciseCount: number} | null; skippedCardio: string[]}
export interface ClarificationPayload {clarificationId: string; question: string; options: {label: string; action: {type: 'send_text'; text: string} | {type: 'resume'; value: ResumeValue}}[]}
export interface RefusalPayload {text: string; label: string; openHistory: boolean}
export interface ErrorPayload {error: LlmError; retryAction: RetryAction}
export interface TrendPayload {
  exerciseId: string | null; exerciseLabel: string; rangeLabel: string; periodLabel: string;
  points: {date: string; topWeightKg: number; topWeightDisplay: string; volumeKg: number}[];
  mixedUnits: boolean; excludesBodyweight: boolean; interpretation: string | null; notEnoughData: boolean;
}
export interface AdvicePayload {mode: 'data' | 'insufficient' | 'general'; label: string; markdown: string; discomfort: boolean}
type Payloads = {advice: AdvicePayload; text: {text: string}; day_detail: {session: Session}; trend: TrendPayload; confirm_card: ConfirmCardPayload; clarification: ClarificationPayload; refusal: RefusalPayload; error: ErrorPayload};
export type AssistantMessage = {[K in keyof Payloads]: {id: string; role: 'assistant'; at: string; kind: K; payload: Payloads[K]; trace: Trace}}[keyof Payloads];
export interface UserMessage {id: string; role: 'user'; text: string; at: string}
export type ChatMessage = AssistantMessage | UserMessage;
export interface ChatStateSnapshot {messages: ChatMessage[]; pendingDraft: PendingDraft | null; pendingResume: PendingResume | null; activeClarificationId: string | null; clarificationCount: number; busy: boolean}
export type ContextState = Pick<ChatStateSnapshot, 'pendingDraft' | 'pendingResume' | 'activeClarificationId' | 'clarificationCount'>;
export interface PipelineResult {messages: AssistantMessage[]; statePatch: Partial<ContextState>}
export interface PipelineContext {settings: Settings; state: ChatStateSnapshot; repo: SessionsReadRepo; now: Date; llm: LlmClient; id?: () => string; clock?: () => number; extensions?: {dispatch: (intent: 'query_training' | 'get_advice' | 'unknown', slots: Classification['slots'], text: string, ctx: PipelineContext, trace: Trace) => Promise<PipelineResult>; resume: (pending: PendingResume, value: ResumeValue, ctx: PipelineContext, trace: Trace) => Promise<PipelineResult>}}
export const clearContext = (): ContextState => ({pendingDraft: null, pendingResume: null, activeClarificationId: null, clarificationCount: 0});
export const emptyResult = (): PipelineResult => ({messages: [], statePatch: {}});
export const nextId = (ctx: PipelineContext): string => ctx.id?.() ?? crypto.randomUUID();
