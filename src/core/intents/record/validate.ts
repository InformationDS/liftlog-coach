import type { Draft } from '../../db/schema';
import { exerciseLibrary } from '../../kb/exerciseMatcher';
import { localDate, localISO } from '../../time/resolve';
export interface DraftValidationIssue { code: 'choice' | 'missing' | 'value' | 'date'; exerciseIndex: number | null; setGroupIndex: number | null; field: string }
export type ValidationPhase = 'parse' | 'confirm' | 'save';
export function validateDraft(draft: Draft, now: Date, phase: ValidationPhase = 'save'): DraftValidationIssue[] {
  const issues: DraftValidationIssue[] = [];
  const add = (code: DraftValidationIssue['code'], field: string, exerciseIndex: number | null = null, setGroupIndex: number | null = null) => issues.push({code, field, exerciseIndex, setGroupIndex});
  try { localDate(draft.date); if (!Number.isFinite(now.getTime()) || draft.date > localISO(now)) add('date', 'date'); } catch { add('date', 'date'); }
  if (!draft.exercises.length) return [{code: 'missing', field: 'exercises', exerciseIndex: null, setGroupIndex: null}];
  if (draft.feeling !== null && !['good', 'normal', 'bad'].includes(draft.feeling)) add('value', 'feeling');
  draft.exercises.forEach((exercise, ei) => {
    const target = phase === 'parse' ? (exercise.match.status === 'matched' ? {kind: 'standard' as const, id: exercise.match.standardExerciseId} : null) : exercise.chosen;
    const standard = target?.kind === 'standard' ? exerciseLibrary.exercises.find(item => item.id === target.id) : undefined;
    if (phase !== 'parse') {
      if (!target) add('choice', 'chosen', ei);
      else if (target.kind === 'standard') {if (!standard) add('value', 'chosen', ei);}
      else if (target.kind !== 'custom') add('value', 'chosen', ei);
      else if (!target.name.trim()) add('missing', 'customName', ei);
    }
    if (!exercise.setGroups.length) { add('missing', 'setGroups', ei); return; }
    exercise.setGroups.forEach((group, si) => {
      if (!['kg', 'lb'].includes(group.unit)) add('value', 'unit', ei, si);
      if (!['warmup', 'working', 'drop'].includes(group.setType)) add('value', 'setType', ei, si);
      if (group.weight === null) { if (!standard?.is_bodyweight) add('missing', 'weight', ei, si); }
      else if (!Number.isFinite(group.weight) || group.weight < 0 || group.weight > (group.unit === 'lb' ? 1100 : 500)) add('value', 'weight', ei, si);
      for (const [field, max] of [['sets', 20], ['reps', 100]] as const) {
        if (group[field] === null || group[field] === undefined) add('missing', field, ei, si);
        else if (!Number.isInteger(group[field]) || group[field] < 1 || group[field] > max) add('value', field, ei, si);
      }
    });
  });
  const order = phase === 'parse' ? ['date', 'missing', 'value', 'choice'] : ['choice', 'missing', 'value', 'date'];
  return issues.sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
}

