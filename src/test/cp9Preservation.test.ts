import {createHash} from 'node:crypto';
import {expect, it} from 'vitest';
import {promptSets} from '../core/prompts/builder';
import {NOW, slots} from './cp4Fixtures';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
it('preserves v1 complete P1 messages with and without pending draft', () => {
  expect([null, slots()].map(pending => hash(promptSets.v1.classify('Bench 60kg 3x8', pending, NOW).messages))).toEqual([
    'fda5fd47a20e5f49296d28e1d0d5497923468c33e45d3f66baddd71b797c4b05',
    'fbea2f78a4b5d36e38124a76601e40b67122db035d898402ba4371b86c981605',
  ]);
  expect(promptSets.v1.riskCheck).toBeNull();
});
