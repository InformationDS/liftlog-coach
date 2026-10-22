import { expect, it } from 'vitest';
import { session, group, NOW } from './cp3Fixtures';
import { exerciseBest, exerciseTrend, exerciseLast, volumeSets, topSet, dayDetail } from '../core/intents/query/calculations';
import { generateSeedSessions } from '../core/db/seed';
import type { ExerciseTarget } from '../core/kb/exerciseMatcher';
const target: ExerciseTarget = {kind: 'standard', id: 'ex_pull_up'};
it('distinguishes no records from pure bodyweight; retains all groups in last/day/sets', () => {
  const sessions = [session('2026-10-18', [group(null)])];
  expect(exerciseBest([], target)).toMatchObject({status: 'no_records', best: null});
  expect(exerciseTrend([], target)).toMatchObject({status: 'no_records', points: [], notEnoughData: true});
  expect(exerciseLast([], target)).toBeNull();
  for (const data of [sessions, generateSeedSessions(NOW)]) {
    expect(exerciseBest(data, target)).toMatchObject({status: 'no_weighted_data', best: null, excludesBodyweight: true});
    expect(exerciseTrend(data, target)).toMatchObject({status: 'no_weighted_data', points: []});
  }
  expect(topSet([group(null)])).toBeNull();
  expect(exerciseLast(sessions, target)?.groups[0].weight).toBeNull(); expect(dayDetail(sessions, '2026-10-18')?.exercises[0].setGroups[0].weight).toBeNull();
  expect(volumeSets(sessions)).toEqual({sessionCount: 1, sets: 3, volume: {}, hasBodyweight: true});
});
it('mixed bodyweight and added-load days retain only weighted points and count increases on retained series', () => {
  const sessions = [session('2026-10-15', [group(null)]), session('2026-10-16', [group(10)]), session('2026-10-17', [group(null), group(20)])];
  const snapshot = structuredClone(sessions);
  expect(exerciseTrend(sessions, target)).toMatchObject({points: [{topWeightKg: 10, volumeKg: 240}, {topWeightKg: 20, volumeKg: 480}], notEnoughData: true, excludesBodyweight: true, sessionCount: 2, sessions_since_last_increase: 0});
  expect(exerciseBest(sessions, target).best?.group.weight).toBe(20);
  expect(exerciseLast(sessions, target)?.groups).toHaveLength(2);
  sessions.push(session('2026-10-18', [group(null)]), session('2026-10-19', [group(20)]));
  expect(exerciseTrend(sessions, target)).toMatchObject({status: 'ok', sessionCount: 3, sessions_since_last_increase: 1});
  expect(sessions.slice(0, 3)).toEqual(snapshot);
});
it.each([
  [[0, 0, 0], 0, null, 2], [[0, 5, 10], 10, null, 0], [[10, 10, 10], 0, 0, 2], [[10, 15, 20], 10, 100, 0],
] as const)('numeric sequence %j uses finite points and defined zero-base semantics', (weights, change, percent, since) => {
  const sessions = weights.map((w, i) => session(`2026-10-${17 + i}`, [group(w)]));
  const result = exerciseTrend(sessions, target);
  expect(result).toMatchObject({status: 'ok', sessionCount: 3, excludesBodyweight: false, change_kg: change, change_percent: percent, sessions_since_last_increase: since});
  expect(result.points.every(p => Number.isFinite(p.volumeKg) && Number.isFinite(p.topWeightKg))).toBe(true);
});
it('standard/custom identity is isolated and custom keys span case/space variations', () => {
  const sessions = ['Landmine press', ' landmine press ', 'LANDMINE PRESS'].map((name, i) => {
    const s = session(`2026-10-${17 + i}`, [group(10 + i)]); s.exercises[0].standardExerciseId = null; s.exercises[0].customName = name; return s;
  });
  sessions.push(session('2026-10-20', [group(999)]));
  for (const name of ['Landmine press', ' landmine press ', 'LANDMINE PRESS']) {
    expect(exerciseTrend(sessions, {kind: 'custom', name}).sessionCount).toBe(3);
    expect(exerciseBest(sessions, {kind: 'custom', name}).best?.group.weight).toBe(12);
  }
  expect(exerciseTrend(sessions, target).sessionCount).toBe(1);
});
it('best tie uses more reps then earliest date, comparisons convert units while groups stay original', () => {
  const sessions = [session('2026-10-19', [group(60, 'kg', 8)]), session('2026-10-18', [group(140, 'lb', 10)]), session('2026-10-17', [group(140, 'lb', 10)]), session('2026-10-16', [group(140, 'lb', 8)])];
  expect(exerciseBest(sessions, target).best).toMatchObject({date: '2026-10-17', group: {weight: 140, unit: 'lb', reps: 10}});
  expect(exerciseTrend(sessions, target).mixedUnits).toBe(true);
  expect(exerciseLast(sessions, target)?.session.date).toBe('2026-10-19');
});
it('keeps unit buckets, sums before rounding, includes warmup/drop, and filters date endpoints', () => {
  const s = session('2026-10-19', [group(62.5, 'kg', 5, 1), {...group(62.5, 'kg', 5, 1), setType: 'warmup'}, {...group(140, 'lb', 10, 1), setType: 'drop'}, group(null)]);
  expect(volumeSets([s])).toEqual({sessionCount: 1, sets: 6, volume: {kg: 625, lb: 1400}, hasBodyweight: true});
  expect(volumeSets([session('2026-10-19', [group(140, 'lb')])]).volume).toEqual({lb: 3360});
  expect(volumeSets([s], {start: '2026-10-20', end: '2026-10-20'})).toMatchObject({sessionCount: 0, volume: {}});
  expect(exerciseTrend([s], target, {start: '2026-10-19', end: '2026-10-19'}).points).toHaveLength(1);
});
