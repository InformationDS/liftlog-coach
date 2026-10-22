import type { Draft, ExerciseEntry, Session } from '../../db/schema';
import { customKey } from '../../kb/exerciseMatcher';
const key = (entry: ExerciseEntry) => entry.standardExerciseId ? `std:${entry.standardExerciseId}` : `custom:${customKey(entry.customName ?? '')}`;
// Call only with a validated final draft. This function never changes its inputs.
export function merge(existing: Session | null, draft: Draft, now: Date, id: string = crypto.randomUUID()): Session {
  const at = now.toISOString();
  const exercises: ExerciseEntry[] = [];
  const append = (entry: ExerciseEntry) => {
    const previous = exercises.find(item => key(item) === key(entry));
    if (previous) { previous.setGroups.push(...entry.setGroups.map(group => ({...group}))); previous.rawNames = [...new Set([...previous.rawNames, ...entry.rawNames])]; }
    else exercises.push({...entry, rawNames: [...entry.rawNames], setGroups: entry.setGroups.map(group => ({...group}))});
  };
  existing?.exercises.forEach(append);
  draft.exercises.forEach(exercise => {
    if (!exercise.chosen) throw new Error('Unvalidated draft');
    append({standardExerciseId: exercise.chosen.kind === 'standard' ? exercise.chosen.id : null, customName: exercise.chosen.kind === 'custom' ? exercise.chosen.name : null,
      rawNames: [exercise.rawName], setGroups: exercise.setGroups.map(({weight, unit, sets, reps, setType}) => ({weight, unit: weight === null ? 'kg' : unit, sets, reps, setType}))});
  });
  return {id: existing?.id ?? id, date: draft.date, exercises, feeling: draft.feeling ?? existing?.feeling ?? null,
    notes: draft.notes !== null ? (existing?.notes ? `${existing.notes}\n${draft.notes}` : draft.notes) : existing?.notes ?? null,
    rawInputs: [...(existing?.rawInputs.map(input => ({...input})) ?? []), {text: draft.rawText, at}], source: existing?.source ?? 'user', createdAt: existing?.createdAt ?? at, updatedAt: at};
}
