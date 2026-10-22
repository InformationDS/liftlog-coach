import type { Draft, Session, SetGroup } from '../core/db/schema';
import { merge } from '../core/intents/record/merge';
export const NOW = new Date('2026-10-20T10:00:00');
export function draft(id = 'ex_bench_press'): Draft {
  return {date: '2026-10-19', dateInferred: false, feeling: null, feelingInferred: false, feelingText: null, feelingReplaces: null, notes: null, rawText: 'Bench 60kg 4x8', exercises: [{rawName: 'bench', match: {status: 'matched', standardExerciseId: id, candidates: []}, chosen: {kind: 'standard', id}, setGroups: [{weight: 60, unit: 'kg', sets: 4, reps: 8, setType: 'working', unitInferred: false, explicitUnit: 'kg'}]}]};
}
export function session(date = '2026-10-19', groups?: SetGroup[], id = 'ex_pull_up'): Session {
  const d = draft(id); d.date = date;
  if (groups) d.exercises[0].setGroups = groups.map(g => ({...g, unitInferred: false, explicitUnit: g.unit}));
  return merge(null, d, NOW);
}
export const group = (weight: number | null, unit: 'kg' | 'lb' = 'kg', reps = 8, sets = 3): SetGroup => ({weight, unit, reps, sets, setType: 'working'});
