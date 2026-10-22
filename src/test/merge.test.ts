import { expect, it } from 'vitest';
import { draft, NOW, session } from './cp3Fixtures';
import { merge } from '../core/intents/record/merge';
import { validateDraft } from '../core/intents/record/validate';
it('appends the same standard exercise, raw names, timestamps and metadata without mutation', () => {
  const existing = session(); existing.feeling = 'normal'; existing.notes = 'Felt OK.'; existing.createdAt = '2026-10-19T00:00:00.000Z'; existing.updatedAt = existing.createdAt;
  const d = draft('ex_pull_up'); d.exercises[0].rawName = 'pullups'; d.exercises[0].setGroups[0].weight = 62.5; d.exercises[0].setGroups[0].reps = 5;
  d.feeling = 'good'; d.notes = 'Grip slipped.';
  const snapshot = structuredClone({existing, d}); const result = merge(existing, d, NOW);
  expect(result.exercises).toHaveLength(1); expect(result.exercises[0].setGroups).toHaveLength(2);
  expect(result.exercises[0].rawNames).toEqual(['bench', 'pullups']); expect(result.feeling).toBe('good'); expect(result.notes).toBe('Felt OK.\nGrip slipped.');
  expect(result.rawInputs.at(-1)).toEqual({text: d.rawText, at: NOW.toISOString()}); expect(result.createdAt).toBe(existing.createdAt); expect(result.updatedAt).toBe(NOW.toISOString());
  expect({existing, d}).toEqual(snapshot); result.exercises[0].setGroups[0].weight = 99; expect(existing.exercises[0].setGroups[0].weight).toBe(60);
});
it('appends new standard actions in order and preserves absent feeling/notes', () => {
  const existing = session(); existing.feeling = 'normal'; existing.notes = 'Felt OK.'; existing.createdAt = '2026-10-19T00:00:00.000Z'; existing.updatedAt = existing.createdAt;
  const result = merge(existing, draft('ex_barbell_row'), NOW);
  expect(result.exercises.map(e => e.standardExerciseId)).toEqual(['ex_pull_up', 'ex_barbell_row']); expect(result.feeling).toBe('normal'); expect(result.notes).toBe('Felt OK.');
});
it('folds custom keys both on create and append while preserving display spelling', () => {
  const d = draft(); d.exercises[0].chosen = {kind: 'custom', name: ' Landmine press '}; d.exercises[0].rawName = ' Landmine press ';
  const second = structuredClone(d.exercises[0]); second.chosen = {kind: 'custom', name: 'LANDMINE PRESS'}; second.rawName = 'LANDMINE PRESS'; d.exercises.push(second);
  const first = merge(null, d, NOW); expect(first.exercises).toHaveLength(1); expect(first.exercises[0].setGroups).toHaveLength(2);
  expect(first.exercises[0].customName).toBe(' Landmine press ');
  const result = merge(first, d, NOW); expect(result.exercises).toHaveLength(1); expect(result.exercises[0].setGroups).toHaveLength(4); expect(result.exercises[0].rawNames).toEqual([' Landmine press ', 'LANDMINE PRESS']);
});
it('parse allows unresolved candidates with complete numeric parameters; confirm/save require choices', () => {
  const d = draft(); d.exercises[0].chosen = null; d.exercises[0].match.status = 'ambiguous';
  expect(validateDraft(d, NOW, 'parse')).toEqual([]);
  for (const phase of ['confirm', 'save'] as const) expect(validateDraft(d, NOW, phase)[0]).toMatchObject({code: 'choice', field: 'chosen', exerciseIndex: 0, setGroupIndex: null});
});
it('parse uses unique match but save uses final chosen for bodyweight', () => {
  const d = draft('ex_pull_up'); d.exercises[0].setGroups[0].weight = null;
  expect(validateDraft(d, NOW, 'parse')).toEqual([]);
  d.exercises[0].chosen = {kind: 'standard', id: 'ex_bench_press'};
  expect(validateDraft(d, NOW)).toContainEqual({code: 'missing', field: 'weight', exerciseIndex: 0, setGroupIndex: 0});
  d.exercises[0].chosen = {kind: 'custom', name: 'pullup'}; expect(validateDraft(d, NOW)[0].code).toBe('missing');
});
it('orders parse problems date/missing/value, confirm problems choice/missing/value/date', () => {
  const d = draft(); d.date = '2026-10-21'; d.exercises[0].chosen = null; d.exercises[0].setGroups[0].weight = null; d.exercises[0].setGroups[0].sets = 1.5;
  expect(validateDraft(d, NOW, 'parse').map(i => i.code)).toEqual(['date', 'missing', 'value']);
  expect(validateDraft(d, NOW, 'confirm').map(i => i.code)).toEqual(['choice', 'missing', 'value', 'date']);
});
