import { expect, it } from 'vitest';
import routingRules from '../../intent-kb/references/routing-rules.md?raw';

it('imports a non-empty routing-rules Markdown file outside src via ?raw', () => {
  expect(routingRules.trim().length).toBeGreaterThan(0);
  expect(routingRules).toContain('# Routing rules');
});
