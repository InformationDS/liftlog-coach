import type { Draft, DraftExercise, Unit } from '../../db/schema';
import { copy, formatCopy } from '../../copy';
import { exerciseLibrary, matchExercise } from '../../kb/exerciseMatcher';
import type { RecordSlots } from '../../pipeline/types';
import { resolveDate } from '../../time/resolve';
import { validateDraft, type DraftValidationIssue } from './validate';
export function feelingInferred(feeling: Draft['feeling'], text: string | null): boolean {
  if (feeling === null) return false;
  const word = (text ?? '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(w => w && !['felt', 'feel', 'feeling', 'pretty', 'really', 'very', 'quite', 'so', 'a', 'bit', 'overall', 'today'].includes(w)).join(' ');
  const literal: Record<string, string> = {good: 'good', great: 'good', ok: 'normal', fine: 'normal', normal: 'normal', bad: 'bad'};
  return literal[word] !== feeling;
}
export const isBodyweight = (exercise: DraftExercise): boolean => exercise.chosen?.kind === 'standard' && exerciseLibrary.exercises.some(e => e.id === (exercise.chosen?.kind === 'standard' ? exercise.chosen.id : null) && e.is_bodyweight);
export function normalizeGroupUnits(exercise: DraftExercise, defaultUnit: Unit): void {
  const bw = isBodyweight(exercise);
  for (const group of exercise.setGroups) {
    group.unit = bw && group.weight === null ? 'kg' : group.explicitUnit ?? defaultUnit;
    group.unitInferred = group.weight !== null && group.explicitUnit === null;
  }
}
export function buildDraft(slots: RecordSlots, rawTexts: readonly string[], defaultUnit: Unit, now: Date): {draft: Draft; issues: DraftValidationIssue[]; question: string | null} {
  const date = resolveDate(slots.time, now);
  const draft: Draft = {date: date.ok ? date.date : '', dateInferred: date.ok && date.inferred,
    feeling: slots.feeling, feelingInferred: feelingInferred(slots.feeling, slots.feeling_text), feelingText: slots.feeling_text,
    feelingReplaces: null, notes: slots.notes, rawText: rawTexts.join(' / '), exercises: slots.exercises.map(e => {
      const m = matchExercise(e.raw_name);
      const bodyweight = exerciseLibrary.exercises.some(item => item.id === m.standard_exercise_id && item.is_bodyweight);
      return {rawName: e.raw_name, match: {status: m.status, standardExerciseId: m.standard_exercise_id, candidates: m.candidates},
        chosen: m.standard_exercise_id ? {kind: 'standard' as const, id: m.standard_exercise_id} : null,
        setGroups: e.set_groups.map(g => ({weight: g.weight, unit: bodyweight && g.weight === null ? 'kg' : g.unit ?? defaultUnit,
          sets: g.sets as number, reps: g.reps as number, setType: g.set_type ?? 'working',
          explicitUnit: g.unit, unitInferred: g.weight !== null && g.unit === null}))};
    })};
  const issues = validateDraft(draft, now, 'parse');
  if (!draft.exercises.length) return {draft, issues, question: copy.record.askExercises};
  const parts: string[] = [];
  if (issues.some(i => i.code === 'date')) parts.push(date.ok && date.future ? copy.record.futureDate : copy.record.whichDay);
  const fields: Record<string, string> = {weight: copy.record.fieldWeight, sets: copy.record.fieldSets, reps: copy.record.fieldReps};
  const missing = draft.exercises.flatMap((e, ei) => {
    const problems = issues.filter(i => i.code === 'missing' && i.exerciseIndex === ei);
    const names = problems.flatMap(i => i.field === 'setGroups' ? [...(isBodyweight(e) ? [] : [copy.record.fieldWeight]), copy.record.fieldSets, copy.record.fieldReps] : [fields[i.field] ?? i.field]);
    return names.length ? [formatCopy(copy.record.missingItem, {exercise: e.rawName, fields: [...new Set(names)].join(', ')})] : [];
  });
  if (missing.length) parts.push(`${copy.record.missingPrefix} ${missing.join('; ')}. ${copy.record.missingSuffix}`);
  for (const issue of issues.filter(i => i.code === 'value')) {
    const e = draft.exercises[issue.exerciseIndex ?? 0], g = e.setGroups[issue.setGroupIndex ?? 0];
    const value = g?.[issue.field as keyof typeof g];
    parts.push(formatCopy(copy.record.unusualValue, {exercise: e.rawName, value: `${String(value)}${issue.field === 'weight' ? g.unit : ''}`, field: fields[issue.field] ?? issue.field}));
  }
  return {draft, issues, question: parts.length ? parts.join('\n') : null};
}

