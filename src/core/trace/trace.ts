import { scrubSecrets, scrubValue } from '../llm/client';
import type { Trace } from '../pipeline/types';
export function createTrace(key: string, clock: () => number, ruleVersion: Trace['ruleVersion'] = 'v1') {
  const start = clock();
  const value: Trace = {ruleVersion, path: [], safetyRuleHit: null, aiCalls: [], dataSentToAi: null, postCheckFlags: [], totalLatencyMs: 0};
  return {value, step(text: string) {value.path.push(scrubSecrets(text, key));}, finish(): Trace {
    value.totalLatencyMs = Math.max(0, clock() - start);
    return scrubValue(value, key) as Trace;
  }};
}
