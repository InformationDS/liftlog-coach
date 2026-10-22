import { expect, it } from 'vitest';
import { exerciseLibrary as library, customKey, matchExercise, normalizeExerciseName as norm, resolveExerciseTarget, similarity } from '../core/kb/exerciseMatcher';
it.each(['Bench press', 'bench', 'BENCH PRESS', 'benchpress', 'bench presss'])('matches %s', raw => expect(matchExercise(raw)).toMatchObject({status: 'matched', standard_exercise_id: 'ex_bench_press'}));
it.each([['incline db press', 'ex_incline_db_press'], ['cable flyes', 'ex_cable_fly'], ['squats', 'ex_back_squat'], ['incline fly', 'ex_incline_db_fly']])('%s exact alias', (raw, id) => expect(matchExercise(raw).standard_exercise_id).toBe(id));
it.each(['press', 'row', 'fly'] as const)('%s ambiguity', raw => expect(matchExercise(raw)).toEqual({status: 'ambiguous', standard_exercise_id: null, candidates: library.ambiguous_aliases[raw]}));
it('uses exact Levenshtein thresholds', () => {
  expect(similarity('benchpress', 'bench press')).toBeCloseTo(1 - 1 / 11);
  expect(similarity('lat pulldown v2', 'lat pulldown')).toBeCloseTo(0.8);
  expect(matchExercise('Lat pulldown V2')).toEqual({status: 'unmatched_with_candidates', standard_exercise_id: null, candidates: ['ex_lat_pulldown']});
  expect(matchExercise('Landmine press').status).not.toBe('matched');
  expect(matchExercise('zercher carry')).toEqual({status: 'unmatched', standard_exercise_id: null, candidates: []});
  expect(matchExercise('').status).toBe('unmatched');
});
it('normalizes punctuation, whole-word abbreviations and fillers without stripping plural s', () => {
  expect(norm(' My_the/db--row! ')).toBe('dumbbell row');
  expect(norm('some BB press of a KB')).toBe('barbell press kettlebell');
  expect(norm('press')).toBe('press');
  expect(norm('dbase')).toBe('dbase');
});
it('has 35 unique IDs and no cross-exercise alias or ambiguous-key collision', () => {
  expect(library.exercises).toHaveLength(35);
  expect(new Set(library.exercises.map(ex => ex.id)).size).toBe(35);
  const owners = new Map<string, string>();
  for (const ex of library.exercises) for (const alias of [ex.name, ...ex.aliases]) {
    expect(owners.get(norm(alias)) ?? ex.id).toBe(ex.id); owners.set(norm(alias), ex.id);
  }
  for (const [alias, candidates] of Object.entries(library.ambiguous_aliases)) {
    expect(owners.has(norm(alias))).toBe(false); expect(candidates.length).toBeLessThanOrEqual(3);
    for (const id of candidates) expect(library.exercises.some(ex => ex.id === id)).toBe(true);
  }
});
it('keeps custom identity limited to trim and lowercase', () => {
  expect(customKey(' Landmine PRESS ')).toBe('landmine press');
  expect(customKey('DB  press!')).toBe('db  press!');
});
it('resolves custom before ambiguity, candidates and fuzzy auto-match, preserving first display name', () => {
  for (const raw of ['Lat pulldown V2', 'press', 'benchpress']) {
    expect(resolveExerciseTarget(` ${raw.toUpperCase()} `, [raw, ` ${raw.toUpperCase()} `])).toEqual({kind: 'custom', name: raw});
  }
  expect(resolveExerciseTarget('lat pulldown v2', [])).toEqual({kind: 'candidates', candidates: ['ex_lat_pulldown']});
  expect(resolveExerciseTarget('benchpress', [])).toEqual({kind: 'standard', id: 'ex_bench_press'});
  expect(resolveExerciseTarget('bench', ['bench'])).toEqual({kind: 'standard', id: 'ex_bench_press'});
  expect(resolveExerciseTarget('zercher carry', [])).toEqual({kind: 'not_found'});
  expect(resolveExerciseTarget('landmine press', ['Landmine  press'])).not.toEqual({kind: 'custom', name: 'Landmine  press'});
});
