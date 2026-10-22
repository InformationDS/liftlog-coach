import { expect, it } from 'vitest';
import md from '../../intent-kb/references/safety-rules.md?raw';
import { getRules } from '../core/safety/regexRules';
function cells(row: string): string[] {
  let code = false, cell = '';
  const result: string[] = [];
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '`') code = !code;
    if (char === '|' && !code && row[i - 1] !== '\\') {result.push(cell.trim()); cell = '';}
    else cell += char;
  }
  result.push(cell.trim());
  return result.slice(1, -1);
}
const parse = (section: string) => section.split('\n').filter(line => /^\| `(DES|MED)-/.test(line)).map(line => {
  const [id, category, pattern] = cells(line);
  return {id: id.replace(/`/g, ''), category, pattern: pattern.slice(1, -1).replace(/\\\|/g, '|')};
});
it('syncs both tables including IDs, categories, patterns, order and versions', () => {
  const v1 = parse(md.split('### 1.1')[1].split('### 1.2')[0]);
  const v2 = parse(md.split('### 1.2')[1].split('### 1.3')[0]);
  expect(v1).toHaveLength(10);
  for (const version of ['v1', 'v2'] as const) expect(getRules(version).map(rule => ({id: rule.id, category: rule.category, pattern: rule.pattern.source}))).toEqual(version === 'v1' ? v1 : [...v1, ...v2]);
});
it('parses DES-01 into exactly four columns', () => expect(cells(md.split('\n').find(line => line.startsWith('| `DES-01`'))!)).toHaveLength(4));
