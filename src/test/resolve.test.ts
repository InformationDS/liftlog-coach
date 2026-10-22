import { expect, it } from 'vitest';
import { localISO, matchTimeReply, resolveDate, resolveRange, resolveTime } from '../core/time/resolve';
import { timeSchema } from '../core/llm/schemas';
const now = new Date(2026, 9, 20, 10);
const time = (type: string, extra = {}) => timeSchema.parse({raw_text: '', type, ...extra});
it.each([
  [null, '2026-10-20', true], [time('today'), '2026-10-20', false], [time('yesterday'), '2026-10-19', false],
  [time('days_ago', {n: 3}), '2026-10-17', false], [time('weekday', {weekday: 3, week: 'last'}), '2026-10-14', false],
  [time('weekday', {weekday: 1}), '2026-10-19', false], [time('weekday', {weekday: 4}), '2026-10-15', false],
  [time('weekday', {weekday: 2}), '2026-10-20', false], [time('date', {month: 10, day: 5}), '2026-10-05', false],
  [time('date', {month: 12, day: 25}), '2025-12-25', true],
])('single date %j', (slot, date, inferred) => expect(resolveDate(slot, now)).toEqual({ok: true, date, inferred, future: false}));
it('preserves future weekdays for record validation and rejects ranges', () => {
  expect(resolveDate(time('weekday', {weekday: 5, week: 'this'}), now)).toEqual({ok: true, date: '2026-10-23', inferred: false, future: true});
  expect(resolveDate(time('this_week'), now)).toEqual({ok: false, error: 'single_day_required'});
});
it.each([
  ['this_week', {}, '2026-10-19', '2026-10-20'], ['last_week', {}, '2026-10-12', '2026-10-18'],
  ['this_month', {}, '2026-10-01', '2026-10-20'], ['last_month', {}, '2026-09-01', '2026-09-30'],
  ['last_n_days', {n: 7}, '2026-10-14', '2026-10-20'], ['last_n_weeks', {n: 4}, '2026-09-23', '2026-10-20'],
  ['yesterday', {}, '2026-10-19', '2026-10-19'], ['today', {}, '2026-10-20', '2026-10-20'],
  ['days_ago', {n: 3}, '2026-10-17', '2026-10-17'], ['weekday', {weekday: 1}, '2026-10-19', '2026-10-19'],
  ['date', {day: 5, month: 10}, '2026-10-05', '2026-10-05'],
])('range %s', (type, extra, start, end) => {
  const range = resolveRange(time(type, extra), now); expect(range.ok).toBe(true);
  if (!range.ok) throw new Error('Expected range');
  expect(localISO(range.start)).toBe(start); expect(localISO(range.end)).toBe(end);
  expect(range.start.getHours()).toBe(0);
  if (end === '2026-10-20') expect(range.end.getTime()).toBe(now.getTime());
  else expect([range.end.getHours(), range.end.getMinutes(), range.end.getSeconds(), range.end.getMilliseconds()]).toEqual([23, 59, 59, 999]);
});
it('handles Monday-start weeks, month/year rollover, leap days and local midnight', () => {
  const jan = new Date(2026, 0, 1, 1);
  const range = resolveRange(time('last_month'), jan);
  expect(range.ok && [localISO(range.start), localISO(range.end)]).toEqual(['2025-12-01', '2025-12-31']);
  expect(resolveDate(time('yesterday'), jan)).toMatchObject({date: '2025-12-31'});
  const week = resolveRange(time('this_week'), jan);
  expect(week.ok && localISO(week.start)).toBe('2025-12-29');
  expect(resolveDate(time('weekday', {weekday: 7}), new Date(2026, 9, 19))).toMatchObject({date: '2026-10-18'});
  expect(resolveDate(time('date', {month: 2, day: 29}), new Date(2024, 2, 1))).toMatchObject({date: '2024-02-29'});
  expect(localISO(now)).toBe('2026-10-20');
  const original = now.getTime(); resolveRange(time('last_week'), now); expect(now.getTime()).toBe(original);
});
it.each([time('date', {month: 2, day: 30}), time('weekday', {weekday: 8}), time('days_ago', {n: -1}), time('days_ago', {n: 1.5})])('rejects invalid single dates %j', slot => expect(resolveDate(slot, now).ok).toBe(false));
it.each([0, -1, 1.5, null])('rejects invalid range count %s', n => expect(resolveRange(time('last_n_days', {n}), now).ok).toBe(false));
it('applies every null-time default without real clocks', () => {
  expect(resolveTime(null, 'record_workout', now)).toMatchObject({date: '2026-10-20', inferred: true});
  expect(resolveTime(null, 'exercise_last', now)).toEqual({ok: true, allHistory: true});
  for (const [context, start] of [['exercise_best', '2026-08-26'], ['exercise_trend', '2026-08-26'], ['exercise', '2026-07-29'], ['body_part', '2026-09-23'], ['next_session', '2026-10-07'], ['overall', '2026-10-07']] as const) {
    const result = resolveTime(null, context, now);
    expect(result).toMatchObject({ok: true, defaulted: true});
    if ('start' in result) expect(localISO(result.start)).toBe(start);
  }
  for (const context of ['session_count', 'volume_sets', 'day_detail'] as const) expect(resolveTime(null, context, now)).toEqual({ok: false, error: 'missing_time'});
  expect(resolveTime(time('this_week'), 'day_detail', now)).toEqual({ok: false, error: 'single_day_required'});
});
it.each(['Today', 'Yesterday', 'This week', 'Last week', 'This month', 'Last month'])('matches entire reply %s', text => {
  const raw = `  ${text.toUpperCase().replace(' ', '  \n ')}  `;
  expect(matchTimeReply(raw)).toEqual({raw_text: raw, type: text.toLowerCase().replace(' ', '_'), n: null, weekday: null, week: null, month: null, day: null});
});
it.each(['How many sets did I do this month?', 'This month, count my sets', 'last 10 days', 'constructor', 'toString', '', 'today!'])('does not match %s', text => expect(matchTimeReply(text)).toBeNull());
