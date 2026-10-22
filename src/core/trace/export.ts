import { llmErrorText, scrubValue } from '../llm/client';
import type { AssistantMessage, Trace } from '../pipeline/types';

export const safeTrace = (trace: Trace, key: string): Trace => scrubValue(trace, key) as Trace;
export const fullTraceJson = (trace: Trace, key: string): string => JSON.stringify(safeTrace(trace, key), null, 2);
const cell = (text: string): string => text.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
export function replySummary(message: AssistantMessage): string {
  switch (message.kind) {
    case 'text': case 'refusal': return message.payload.text;
    case 'clarification': return message.payload.question;
    case 'error': return llmErrorText(message.payload.error);
    case 'advice': return message.payload.markdown;
    case 'trend': return `${message.payload.exerciseLabel}: ${message.payload.interpretation ?? message.payload.rangeLabel}`;
    case 'day_detail': return `${message.payload.session.date}: ${message.payload.session.exercises.length} exercises`;
    case 'confirm_card': return `${message.payload.draft.date}: ${message.payload.draft.exercises.map(e => e.rawName).join(', ')}`;
  }
}
export function testLogRow(userText: string, message: AssistantMessage, key: string): string {
  const safe = scrubValue({userText, message}, key) as {userText: string; message: AssistantMessage};
  const trace = safe.message.trace;
  // Limit the plain summary before escaping Markdown table pipes.
  const summary = replySummary(safe.message).replace(/\s+/g, ' ').trim().slice(0, 120);
  return `|  | ${cell(safe.userText)} |  |  | ${cell(summary)} · path: ${cell(trace.path.join(' → '))} · AI calls: ${trace.aiCalls.length} · rules ${trace.ruleVersion} |  |`;
}
