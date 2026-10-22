import { expect, it } from 'vitest';
import spec from '../../../prototype-docs/03_UI_SPEC.md?raw';
import { copy, fmtDate, fmtDateLong, fmtRange, fmtWeight, fmtSetGroup, fmtTopSet, formatCopy } from '../core/copy';
const now = new Date(2026, 9, 20, 10);
it('contains every §9 copy key with its specified value', () => {
  const rows = spec.split('## 9. 文案表')[1].matchAll(/^\| `([\w.]+)` \| (.*?) \|$/gm);
  let count = 0;
  for (const [, path, raw] of rows) {
    const [group, key] = path.split('.');
    const value: unknown = (copy as Record<string, Record<string, unknown>>)[group][key];
    expect(value).toEqual(raw.startsWith('[') ? JSON.parse(raw) as unknown : raw.replace(/\\n/g, '\n')); count++;
  }
  expect(count).toBeGreaterThan(180);
});
it('formats local dates with injected year and range endpoints', () => {
  expect(fmtDate('2026-10-20', now)).toBe('Tue 20 Oct');
  expect(fmtDate('2025-12-25', now)).toBe('Thu 25 Dec 2025');
  expect(fmtDateLong('2026-10-20')).toBe('Tue 20 Oct 2026');
  expect(fmtRange('2025-12-31', '2026-01-01', now)).toBe('Wed 31 Dec 2025 – Thu 1 Jan');
});
it('formats weight, normal, bodyweight, added load, single sets and top sets', () => {
  expect(fmtWeight(62.5, 'kg')).toBe('62.5 kg'); expect(fmtWeight(135, 'lb')).toBe('135 lb'); expect(fmtWeight(62.256, 'kg')).toBe('62.26 kg');
  expect(fmtSetGroup({weight: 60, unit: 'kg', reps: 8, sets: 4}, false)).toBe('60 kg × 8 reps × 4 sets');
  expect(fmtSetGroup({weight: null, unit: 'kg', reps: 8, sets: 1}, true)).toBe('Bodyweight × 8 reps × 1 set');
  expect(fmtSetGroup({weight: 10, unit: 'kg', reps: 5, sets: 3}, true)).toBe('BW + 10 kg × 5 reps × 3 sets');
  expect(fmtSetGroup({weight: 0, unit: 'kg', reps: 5, sets: 1}, false)).toBe('0 kg × 5 reps × 1 set');
  expect(fmtTopSet(100, 'kg', 5)).toBe('100 kg × 5');
  expect(formatCopy(copy.app.ruleBadge, {version: 'v2'})).toBe('Rules v2');
});
