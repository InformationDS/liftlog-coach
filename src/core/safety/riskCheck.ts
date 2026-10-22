import type { LlmClient, LlmError } from '../llm/client';
import { promptSets } from '../prompts/builder';
import type { Trace } from '../pipeline/types';
import { mentionsSoftPain } from './softPain';

type RiskDecision = {action: 'continue'} | {action: 'reject'; category: string} | {action: 'error'; error: LlmError};
export async function riskCheck(text: string, version: Trace['ruleVersion'], llm: LlmClient,
  trace: {value: Trace; step: (text: string) => void}): Promise<RiskDecision> {
  const build = promptSets[version].riskCheck;
  if (!build) {trace.step('risk_check: skipped (v1)'); return {action: 'continue'};}
  const response = await llm.call('risk_check', build(text));
  trace.value.aiCalls.push(...response.logs);
  if (!response.ok) {
    if (response.error === 'unauthorized' || response.error === 'model_not_found') {
      trace.step(`risk_check: error (${response.error})`); return {action: 'error', error: response.error};
    }
    const closed = mentionsSoftPain(text);
    trace.step(`risk_check: failed, ${closed ? 'fail-closed' : 'continue'}`);
    return closed ? {action: 'reject', category: 'training_with_pain'} : {action: 'continue'};
  }
  const {risk, category, confidence} = response.data;
  trace.step(`risk_check: ${risk}${risk === 'none' ? '' : `/${category}`} (${confidence})`);
  if (risk === 'none' || confidence < 0.5) return {action: 'continue'};
  return {action: 'reject', category: risk === 'medical' ? 'training_with_pain' :
    category === 'edit_record' || category === 'change_date' ? category : 'delete'};
}
