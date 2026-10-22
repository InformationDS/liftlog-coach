import { afterEach, beforeEach, expect, it } from 'vitest';
import { LiftLogDB, type Draft } from '../core/db/schema';
import { createSessionsRepo } from '../core/db/sessionsRepo';
import { loadSeed } from '../core/db/seed';
import { draft, NOW, session } from './cp3Fixtures';
let db: LiftLogDB;
beforeEach(() => { db = new LiftLogDB(`cp3-${crypto.randomUUID()}`); });
afterEach(async () => { await db.delete(); });
it('saves edited values, strips metadata, merges concurrent same-day saves and enforces unique date', async () => {
  const repo = createSessionsRepo(db), d = draft(); const before = structuredClone(d);
  d.exercises[0].setGroups[0].weight = 62.5; d.exercises[0].setGroups[0].unit = 'lb';
  expect(await repo.saveDraft(d, NOW)).toMatchObject({ok: true});
  const saved = (await repo.list())[0]; expect(saved.exercises[0].setGroups[0]).toEqual({weight: 62.5, unit: 'lb', sets: 4, reps: 8, setType: 'working'});
  await Promise.all([repo.saveDraft(before, NOW), repo.saveDraft(before, NOW)]);
  expect(await db.sessions.count()).toBe(1); expect((await repo.list())[0].exercises[0].setGroups).toHaveLength(3);
  await expect(db.sessions.add({...saved, id: 'other'})).rejects.toThrow();
});
const invalid: [string, (d: Draft) => void][] = [
  ...[-1, 501, NaN, Infinity, -Infinity].map(n => [`weight ${n}`, (d: Draft) => {d.exercises[0].setGroups[0].weight = n;}] as [string, (d: Draft) => void]),
  ['1101 lb', d => {d.exercises[0].setGroups[0].weight = 1101; d.exercises[0].setGroups[0].unit = 'lb';}],
  ...[0, 21, 1.5].map(n => [`sets ${n}`, (d: Draft) => {d.exercises[0].setGroups[0].sets = n;}] as [string, (d: Draft) => void]),
  ...[0, 101, 8.5].map(n => [`reps ${n}`, (d: Draft) => {d.exercises[0].setGroups[0].reps = n;}] as [string, (d: Draft) => void]),
  ...['2026-10-21', '2026-02-30', '2026-2-03', ''].map(date => [`date ${date}`, (d: Draft) => {d.date = date;}] as [string, (d: Draft) => void]),
  ['no exercises', d => {d.exercises = [];}], ['no groups', d => {d.exercises[0].setGroups = [];}], ['unselected', d => {d.exercises[0].chosen = null;}],
  ['unknown standard', d => {d.exercises[0].chosen = {kind: 'standard', id: 'no-such-id'};}], ['empty custom', d => {d.exercises[0].chosen = {kind: 'custom', name: '  '};}],
  ['invalid unit', d => {Object.assign(d.exercises[0].setGroups[0], {unit: 'stone'});}], ['invalid set type', d => {Object.assign(d.exercises[0].setGroups[0], {setType: 'rest'});}],
  ['null non-bodyweight', d => {d.exercises[0].setGroups[0].weight = null;}],
  ['changed to non-bodyweight', d => {d.exercises[0].match.standardExerciseId = 'ex_pull_up'; d.exercises[0].setGroups[0].weight = null;}],
  ['changed to custom', d => {d.exercises[0].match.standardExerciseId = 'ex_pull_up'; d.exercises[0].chosen = {kind: 'custom', name: 'pullups'}; d.exercises[0].setGroups[0].weight = null;}],
];
it.each(invalid)('%s returns issues and never changes empty or existing database', async (_label, change) => {
  const repo = createSessionsRepo(db); const d = draft(); change(d);
  const result = await repo.saveDraft(d, NOW); expect(result.ok).toBe(false); if (!result.ok) expect(result.issues.length).toBeGreaterThan(0);
  expect(await repo.list()).toEqual([]);
  const original = session(); await db.sessions.add(original);
  expect((await repo.saveDraft(d, NOW)).ok).toBe(false); expect(await repo.list()).toEqual([original]);
});
it('normalizes final bodyweight choice and keeps numeric zero distinct', async () => {
  const repo = createSessionsRepo(db), d = draft(); d.exercises[0].chosen = {kind: 'standard', id: 'ex_pull_up'}; d.exercises[0].setGroups[0].weight = null; d.exercises[0].setGroups[0].unit = 'lb';
  await repo.saveDraft(d, NOW); expect((await repo.list())[0].exercises[0].setGroups[0]).toMatchObject({weight: null, unit: 'kg'});
  d.exercises[0].setGroups[0].weight = 0; await repo.saveDraft(d, NOW); expect((await repo.list())[0].exercises[0].setGroups[1]).toMatchObject({weight: 0, unit: 'lb'});
});
it('reads ranges/ids/date/custom targets, deletes only the target day, clears and reloads atomically', async () => {
  const repo = createSessionsRepo(db); await repo.saveDraft(draft(), NOW);
  const d = draft(); d.date = '2026-10-18'; d.exercises[0].chosen = {kind: 'custom', name: ' Landmine press '}; await repo.saveDraft(d, NOW);
  expect(await repo.customNames()).toEqual([' Landmine press ']); expect(await repo.forExercise({kind: 'custom', name: 'LANDMINE PRESS'})).toHaveLength(1);
  expect(await repo.forExercise({kind: 'standard', id: 'ex_bench_press'})).toHaveLength(1);
  const first = (await repo.list())[0]; expect(await repo.getByDate(first.date)).toEqual(first); expect(await repo.getById(first.id)).toEqual(first);
  expect(await repo.inRange('2026-10-19', '2026-10-19')).toHaveLength(1);
  await repo.deleteSession(first.id); expect(await repo.list()).toHaveLength(1);
  await loadSeed(db, NOW); expect(await repo.list()).toHaveLength(27); await loadSeed(db, NOW); expect(await repo.list()).toHaveLength(27);
  await repo.clearAll(); expect(await repo.list()).toEqual([]);
});
it('rolls back a failed bulk load including its clear', async () => {
  const original = session(); await db.sessions.add(original);
  const hook = () => {throw new Error('simulated write failure');}; db.sessions.hook('creating', hook);
  await expect(loadSeed(db, NOW)).rejects.toThrow(); db.sessions.hook('creating').unsubscribe(hook);
  expect(await db.sessions.toArray()).toEqual([original]);
});
it('save failure returns io and leaves prior contents intact', async () => {
  const repo = createSessionsRepo(db); await repo.saveDraft(draft(), NOW); const before = await repo.list();
  const hook = () => {throw new Error('simulated update failure');}; db.sessions.hook('updating', hook);
  expect(await repo.saveDraft(draft(), NOW)).toMatchObject({ok: false, error: 'io'}); db.sessions.hook('updating').unsubscribe(hook);
  expect(await repo.list()).toEqual(before);
});
it('accepts inclusive numeric bounds, local leap dates, and persists across database reopen', async () => {
  const repo = createSessionsRepo(db), d = draft(); d.date = '2024-02-29';
  d.exercises[0].setGroups[0] = {...d.exercises[0].setGroups[0], weight: 500, sets: 20, reps: 100};
  d.exercises[0].setGroups.push({...d.exercises[0].setGroups[0], weight: 1100, unit: 'lb', sets: 1, reps: 1});
  expect((await repo.saveDraft(d, NOW)).ok).toBe(true); const saved = await repo.list(); db.close(); await db.open(); expect(await repo.list()).toEqual(saved);
});
it('snapshots validated final edits before async transaction begins', async () => {
  const repo = createSessionsRepo(db), d = draft(); const promise = repo.saveDraft(d, NOW);
  d.exercises[0].setGroups[0].weight = 999; d.date = '2099-01-01';
  expect((await promise).ok).toBe(true); expect((await repo.list())[0]).toMatchObject({date: '2026-10-19', exercises: [{setGroups: [{weight: 60}]}]});
});
