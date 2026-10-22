import type { TextRequest } from '../llm/client';
import { TEST_CONNECTION_SYSTEM, TEST_CONNECTION_USER, TREND_SYSTEM } from './templates';
import { CLASSIFY_HEAD, CLASSIFY_END, CLASSIFY_END_V2, PENDING_INSTRUCTION } from './templates';
import { loadLlmSection } from '../kb/loader';
import { classificationSchema, riskCheckSchema, type Classification } from '../llm/schemas';
import type { JsonRequest } from '../llm/client';
import type { RecordSlots } from '../pipeline/types';
import { localISO } from '../time/resolve';

const sections = [
  ['Routing rules', 'references/routing-rules.md'], ['Output format', 'references/output-schema.md'],
  ['Time', 'references/time-semantics.md'], ['Body parts', 'references/body-parts.md'],
  ...['record_workout', 'query_training', 'get_advice', 'dangerous_health_query', 'destructive_operation', 'unknown'].map(intent => [`Intent: ${intent}`, `intents/${intent}.md`]),
];
export const cleanQuotes = (text: string): string => text.replace(/"{3,}/g, "''");
function cleanData(value: unknown): unknown {
  if (typeof value === 'string') return cleanQuotes(value);
  if (Array.isArray(value)) return value.map(cleanData);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [cleanQuotes(key), cleanData(item)]));
  return value;
}
export function buildClassify(text: string, pendingDraft: RecordSlots | null, now: Date, version: 'v1' | 'v2' = 'v1'): JsonRequest<Classification> {
  const head = CLASSIFY_HEAD.replace('{today_iso}', localISO(now)).replace('{weekday_name}', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]);
  const system = [head, ...sections.map(([title, path]) => `## ${title}\n\n${loadLlmSection(path)}`), version === 'v2' ? CLASSIFY_END_V2 : CLASSIFY_END].join('\n\n');
  const block = `USER_MESSAGE:\n"""\n${cleanQuotes(text)}\n"""`;
  const user = pendingDraft === null ? block : `PENDING_DRAFT (slots from the user's previous, incomplete workout message):\n${JSON.stringify(cleanData(pendingDraft), null, 2)}\n\n${block}\n\n${PENDING_INSTRUCTION}`;
  return {messages: [{role: 'system', content: system}, {role: 'user', content: user}], temperature: 0, maxTokens: 1200, expectJson: true, schema: classificationSchema};
}

export function buildTestConnection(): TextRequest {
  return {
    messages: [{ role: 'system', content: TEST_CONNECTION_SYSTEM }, { role: 'user', content: TEST_CONNECTION_USER }],
    temperature: 0, maxTokens: 50, expectJson: false,
  };
}

export interface TrendData {
  exercise: string; range: string; mixed_units: boolean;
  sessions: {date: string; top_set: string; top_weight_kg: number; volume_kg: number}[];
  summary: {session_count: number; first_top_weight_kg: number; last_top_weight_kg: number;
    best_top_set: string; best_top_weight_kg: number; best_date: string; change_kg: number;
    change_percent: number | null; sessions_since_last_increase: number};
}
export function buildTrend(data: TrendData): TextRequest {
  return {messages: [{role: 'system', content: TREND_SYSTEM}, {role: 'user', content: `TREND_DATA:\n${JSON.stringify(cleanData(data), null, 2)}`}], temperature: 0.2, maxTokens: 300, expectJson: false};
}
export function cleanInterpretation(text: string): string {
  const plain = text.trim().replace(/^\s*(?:#+\s*|-\s+)/gm, '').replace(/[#*]/g, '').trim();
  return (plain.match(/.+?(?:[.!?](?=\s|$)|$)/gs) ?? []).slice(0, 4).join('').trim();
}

import { ADVICE_SYSTEM, ADVICE_DATA_STRUCTURE, ADVICE_INSUFFICIENT_STRUCTURE, ADVICE_GENERAL_STRUCTURE } from './templates';
import type { AdviceData } from '../intents/advice/dataPrep';
export function buildAdvice(data: AdviceData, adviceType: string, original: string, discomfort: boolean): TextRequest {
  const rules = {data: 'Base your answer on the TRAINING_DATA block. Every number or date you mention about the user must appear in that block exactly as written. In "Where you are", cite at least two specific sessions by date and value.', insufficient: "You have no personal data for this question. Do not mention or guess anything about the user's own training history.", general: "This is a general training question. Do not mention or guess anything about the user's own training history."};
  const structure = {data: ADVICE_DATA_STRUCTURE, insufficient: ADVICE_INSUFFICIENT_STRUCTURE, general: ADVICE_GENERAL_STRUCTURE}[data.mode].replace('{target_label}', cleanQuotes(data.targetLabel));
  const system = ADVICE_SYSTEM.replace('{mode_data_rule}',rules[data.mode]).replace('{mode_structure}',structure);
  const user = `ADVICE_TYPE: ${adviceType}\nTARGET: ${cleanQuotes(data.targetLabel)}\nMENTIONS_DISCOMFORT: ${discomfort}\n\n${data.mode === 'data' ? `TRAINING_DATA:\n${JSON.stringify(cleanData(data.dataJson),null,2)}\n\n` : ''}USER_QUESTION:\n"""\n${cleanQuotes(original)}\n"""`;
  return {messages:[{role:'system',content:system},{role:'user',content:user}],temperature:0.3,maxTokens:700,expectJson:false};
}

import { RISK_CHECK_HEAD } from './templates';
export function buildRiskCheck(text: string) {
  return {messages: [{role: 'system' as const, content: `${RISK_CHECK_HEAD}\n\n${loadLlmSection('references/safety-rules.md', 'risk-check')}`},
    {role: 'user' as const, content: `MESSAGE:\n"""\n${cleanQuotes(text)}\n"""`}], temperature: 0, maxTokens: 400, expectJson: true as const, schema: riskCheckSchema};
}
const v1 = {classify: buildClassify, riskCheck: null, trendInterpretation: buildTrend, advice: buildAdvice};
export const promptSets = {v1, v2: {...v1, classify: (text: string, pendingDraft: RecordSlots | null, now: Date) => buildClassify(text, pendingDraft, now, 'v2'), riskCheck: buildRiskCheck}};
