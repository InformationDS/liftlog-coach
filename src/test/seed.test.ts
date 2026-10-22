import { expect, it } from 'vitest';
import { generateSeedSessions } from '../core/db/seed';
import { exerciseLibrary } from '../core/kb/exerciseMatcher';
import plan from '../core/db/seed-plan.json';
import { sessionCount, volumeSets, exerciseBest, exerciseTrend, dayDetail, exerciseLast, toKg } from '../core/intents/query/calculations';
import { NOW } from './cp3Fixtures';
const range = {start: '2026-10-12', end: '2026-10-18'};
const target = (id: string) => ({kind: 'standard' as const, id});
it.each([0, 1, 2, 3, 4, 5, 6])('Monday anchored generation on weekday %i matches totals and excludes today/future', day => {
  const now = new Date(2026, 9, 19 + day, 10), sessions = generateSeedSessions(now);
  expect(sessions).toHaveLength([26, 27, 28, 28, 29, 29, 30][day]);
  expect(sessionCount(sessions, {start: '2026-10-19', end: '2026-10-25'})).toBe([0, 1, 2, 2, 3, 3, 4][day]);
  expect(new Set(sessions.map(s => s.date)).size).toBe(sessions.length);
  expect(sessions.every(s => s.date < `2026-10-${19 + day}`)).toBe(true);
  expect(sessionCount(sessions, range)).toBe(4);
  expect(volumeSets(sessions, range)).toMatchObject({sets: 56, volume: {kg: 23675, lb: 7680}, hasBodyweight: true});
});
it('all plan ids exist and generation preserves names, groups, sample metadata and 19:00 local timestamps', () => {
  for (const s of plan.sessions) for (const e of s.exercises) if (e.id) expect(exerciseLibrary.exercises.some(x => x.id === e.id)).toBe(true);
  for (const s of generateSeedSessions(NOW)) {
    expect(s.source).toBe('seed'); expect(s.rawInputs).toEqual([]); expect(new Date(s.createdAt).getHours()).toBe(19); expect(s.updatedAt).toBe(s.createdAt);
    expect(s.exercises.every(e => e.rawNames[0] === (exerciseLibrary.exercises.find(x => x.id === e.standardExerciseId)?.name ?? e.customName))).toBe(true);
  }
});
it('matches §5.1 fixed sample metrics and §5.3 complete bench/squat series', () => {
  const sessions = generateSeedSessions(NOW);
  expect(sessionCount(sessions, range)).toBe(4);
  expect(dayDetail(sessions, '2026-10-15')).toMatchObject({notes: 'Hotel gym, plates in pounds.', exercises: [
    {setGroups: [{weight: 55, unit: 'lb', sets: 3, reps: 8, setType: 'working'}]},
    {setGroups: [{weight: 140, unit: 'lb', sets: 3, reps: 10, setType: 'working'}]},
    {setGroups: [{weight: null, unit: 'kg', sets: 3, reps: 8, setType: 'working'}]},
    {setGroups: [{weight: 35, unit: 'lb', sets: 3, reps: 12, setType: 'working'}]},
    {setGroups: [{weight: 30, unit: 'lb', sets: 3, reps: 10, setType: 'working'}]},
  ]});
  expect(dayDetail(sessions, '2026-10-14')).toBeNull();
  const bench = exerciseTrend(sessions, target('ex_bench_press'));
  expect(bench.points.map(p => [p.date, p.topWeightKg, p.topSet.reps, p.volumeKg])).toEqual([
    ['2026-08-31',55,8,2080], ['2026-09-07',55,8,2080], ['2026-09-14',57.5,8,2160], ['2026-09-21',57.5,8,2160], ['2026-09-28',60,8,2240], ['2026-10-05',60,8,2240], ['2026-10-12',62.5,6,1820], ['2026-10-19',62.5,7,2070],
  ]);
  expect(bench).toMatchObject({change_kg: 7.5, change_percent: 13.6, sessions_since_last_increase: 1, status: 'ok'});
  const squat = exerciseTrend(sessions, target('ex_back_squat'));
  expect(squat.points.map(p => [p.date, p.topWeightKg, p.volumeKg])).toEqual([
    ['2026-09-01',90,2050], ['2026-09-08',92.5,2088], ['2026-09-15',95,2125], ['2026-09-22',100,2200], ['2026-09-29',100,2100], ['2026-10-06',100,2200], ['2026-10-13',100,2000],
  ]);
  expect(squat).toMatchObject({sessions_since_last_increase: 3, change_kg: 10, change_percent: 11.1});
  expect(exerciseBest(sessions, target('ex_back_squat')).best).toMatchObject({date: '2026-09-22', group: {weight: 100, reps: 5}});
  expect(exerciseBest(sessions, target('ex_lat_pulldown')).best).toMatchObject({date: '2026-10-15', group: {weight: 140, unit: 'lb', reps: 10}});
  expect(exerciseBest(sessions, target('ex_bench_press')).best).toMatchObject({date: '2026-10-19', group: {weight: 62.5, reps: 7}});
  expect(exerciseLast(sessions, target('ex_bench_press'))).toMatchObject({session: {date: '2026-10-19'}, topSet: {weight: 62.5, reps: 7}});
  expect(exerciseTrend(sessions, target('ex_deadlift'))).toMatchObject({sessionCount: 1, status: 'not_enough_data'});
  expect(exerciseBest(generateSeedSessions(new Date('2026-10-19T10:00:00')), target('ex_bench_press')).best).toMatchObject({date: '2026-10-12', group: {weight: 62.5, reps: 6}});
  expect(toKg(140, 'lb')).toBe(63.5);
});
