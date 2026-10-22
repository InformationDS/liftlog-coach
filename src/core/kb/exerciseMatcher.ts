import library from '../../../intent-kb/references/exercise-library.json';
export const exerciseLibrary = library;
export function normalizeExerciseName(name: string): string {
  const expansions: Record<string, string> = {db: 'dumbbell', bb: 'barbell', kb: 'kettlebell'};
  return name.toLowerCase().trim().replace(/[-_/]/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\b(db|bb|kb)\b/g, word => expansions[word])
    .replace(/\b(the|some|a|of|my)\b/g, '').replace(/\s+/g, ' ').trim();
}
export const customKey = (name: string): string => name.trim().toLowerCase();
export function similarity(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  let previous = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = row;
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}
const names = library.exercises.map(ex => ({id: ex.id, names: [ex.name, ...ex.aliases].map(normalizeExerciseName)}));
const exactId = (name: string) => names.find(ex => ex.names.includes(name))?.id;
export interface ExerciseMatch { status: 'matched' | 'ambiguous' | 'unmatched_with_candidates' | 'unmatched'; standard_exercise_id: string | null; candidates: string[] }
export function matchExercise(rawName: string): ExerciseMatch {
  const name = normalizeExerciseName(rawName);
  const id = exactId(name);
  if (id) return {status: 'matched', standard_exercise_id: id, candidates: []};
  const ambiguous = Object.entries(library.ambiguous_aliases).find(([key]) => normalizeExerciseName(key) === name)?.[1];
  if (ambiguous) return {status: 'ambiguous', standard_exercise_id: null, candidates: ambiguous.slice(0, 3)};
  const scores = name ? names.map(ex => ({id: ex.id, score: Math.max(...ex.names.map(alias => similarity(name, alias)))})).filter(ex => ex.score >= 0.8).sort((a, b) => b.score - a.score) : [];
  if (scores.length === 1 && scores[0].score >= 0.9) return {status: 'matched', standard_exercise_id: scores[0].id, candidates: []};
  return {status: scores.length ? 'unmatched_with_candidates' : 'unmatched', standard_exercise_id: null, candidates: scores.slice(0, 3).map(ex => ex.id)};
}
export type ExerciseTarget = {kind: 'standard'; id: string} | {kind: 'custom'; name: string};
export type TargetResolution = ExerciseTarget | {kind: 'candidates'; candidates: string[]} | {kind: 'not_found'};
export function resolveExerciseTarget(rawName: string, storedCustomNames: readonly string[]): TargetResolution {
  const id = exactId(normalizeExerciseName(rawName));
  if (id) return {kind: 'standard', id};
  const custom = storedCustomNames.find(name => customKey(name) === customKey(rawName));
  if (custom !== undefined) return {kind: 'custom', name: custom};
  const match = matchExercise(rawName);
  if (match.standard_exercise_id) return {kind: 'standard', id: match.standard_exercise_id};
  return match.candidates.length ? {kind: 'candidates', candidates: match.candidates} : {kind: 'not_found'};
}
