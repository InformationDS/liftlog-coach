import { expect, it } from 'vitest';
import { kbMarkdown, llmSection, loadLlmSection } from '../core/kb/loader';
const paths = ['references/routing-rules.md', 'references/output-schema.md', 'references/time-semantics.md', 'references/body-parts.md', ...['record_workout', 'query_training', 'get_advice', 'dangerous_health_query', 'destructive_operation', 'unknown'].map(intent => `intents/${intent}.md`)];
it.each(paths)('loads ordinary section %s without code contract', path => {
  const section = loadLlmSection(path); expect(section.trim().length).toBeGreaterThan(0); expect(section).not.toContain('Code contract'); expect(section).not.toContain('LLM:BEGIN');
});
it('preserves record relation and unsupported reps contracts', () => {
  expect(loadLlmSection('intents/record_workout.md')).toContain('draft_action="continue"');
  expect(loadLlmSection('intents/record_workout.md')).toContain('draft_action="new"');
  expect(loadLlmSection('intents/query_training.md').split('\n').find(line => line.startsWith('| `unsupported`'))).toContain('How many reps did I do last week?');
  expect(loadLlmSection('intents/query_training.md').split('\n').find(line => line.startsWith('| `volume_sets`'))).not.toContain('total reps');
});
it('requires risk-check tag and never leaks it into ordinary sections', () => {
  const section = loadLlmSection('references/safety-rules.md', 'risk-check');
  expect(section).toContain('You are a safety screen'); expect(section).not.toContain('Code contract');
  expect(() => loadLlmSection('references/safety-rules.md')).toThrow();
  expect(paths.map(path => loadLlmSection(path)).join('\n')).not.toContain(section);
});
it.each(['none', '<!-- LLM:BEGIN -->broken', '<!-- LLM:END -->', '<!-- LLM:BEGIN --> <!-- LLM:END -->', '<!-- LLM:BEGIN -->one<!-- LLM:BEGIN -->two<!-- LLM:END -->'])('fails malformed marker input %s', md => expect(() => llmSection(md)).toThrow());
it('concatenates only requested segments in source order', () => {
  const md = 'Code contract<!-- LLM:BEGIN -->one<!-- LLM:END -->not sent<!-- LLM:BEGIN risk-check -->risk<!-- LLM:END risk-check --><!-- LLM:BEGIN -->two<!-- LLM:END -->';
  expect(llmSection(md)).toBe('one\n\ntwo'); expect(llmSection(md, 'risk-check')).toBe('risk');
  expect(() => loadLlmSection('absent.md')).toThrow(); expect(Object.keys(kbMarkdown)).toHaveLength(14);
});
