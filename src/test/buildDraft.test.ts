import { describe, expect, it } from 'vitest';
import { buildDraft, feelingInferred } from '../core/intents/record/buildDraft';
import { validateDraft } from '../core/intents/record/validate';
import { NOW, slots, exercise } from './cp4Fixtures';
import { copy } from '../core/copy';
import { timeSchema } from '../core/llm/schemas';
const build = (overrides: object = {}) => buildDraft(slots(overrides), ['first', 'second', 'third'], 'kg', NOW);
describe('CP4 buildDraft and shared parse validation §2.6', () => {
  it('builds two uniquely matched exercises; only date inferred, no default feeling', () => {
    const b = build({exercises: [exercise('bench press'), exercise('incline dumbbell fly', {weight: 15, sets: 3, reps: 12})]});
    expect(b.question).toBeNull(); expect(b.draft.date).toBe('2026-10-20'); expect(b.draft.dateInferred).toBe(true);
    expect(b.draft.exercises.map(e => e.match.status)).toEqual(['matched', 'matched']);
    expect(b.draft.exercises.every(e => !e.setGroups[0].unitInferred)).toBe(true);
    expect(b.draft.feeling).toBeNull(); expect(validateDraft(b.draft, NOW, 'confirm')).toEqual([]);
    expect(b.draft.rawText).toBe('first / second / third');
  });
  it.each([['felt great', 'good', false], ['Good', 'good', false], ['not great', 'bad', true], ['smashed it', 'good', true], ['really very fine today', 'normal', false], [null, null, false], ['bad', 'good', true]] as const)('feeling %s -> %s inferred=%s', (text, feeling, inferred) => {
    expect(feelingInferred(feeling, text)).toBe(inferred);
    const b = build({feeling, feeling_text: text}); expect(b.draft.feelingText).toBe(text); expect(b.draft.feelingInferred).toBe(inferred);
  });
  it('uses default load unit, preserves explicit unit metadata and no inferred set type', () => {
    const b = build({exercises: [exercise('squat', {weight: 100, unit: null, sets: 5, reps: 5})], feeling: 'good', feeling_text: 'felt great'});
    expect(b.draft.exercises[0].setGroups[0]).toEqual({weight: 100, unit: 'kg', explicitUnit: null, unitInferred: true, sets: 5, reps: 5, setType: 'working'});
    expect(b.draft.feelingInferred).toBe(false);
  });
  it('lists all missing fields in one question', () => {
    const b = build({exercises: [exercise('cable fly', {weight: null, sets: null, reps: null})]});
    for (const field of [copy.record.fieldWeight, copy.record.fieldSets, copy.record.fieldReps]) expect(b.question).toContain(field);
    expect(b.issues.map(i => i.field)).toEqual(['weight', 'sets', 'reps']);
  });
  it('preserves mixed units and group segments without conversion', () => {
    const b = build({exercises: [{raw_name: 'bench', set_groups: [exercise('x', {weight: 135, unit: 'lb', reps: 5}).set_groups[0], exercise('x', {weight: 60, unit: 'kg', reps: 5}).set_groups[0]]}]});
    expect(b.draft.exercises).toHaveLength(1); expect(b.draft.exercises[0].setGroups.map(g => [g.weight, g.unit])).toEqual([[135, 'lb'], [60, 'kg']]);
  });
  it('normalizes pure bodyweight null to kg, with no unit inference', () => {
    const b = build({exercises: [exercise('pull ups', {weight: null, unit: null})]});
    expect(b.question).toBeNull(); expect(b.draft.exercises[0].setGroups[0]).toMatchObject({weight: null, unit: 'kg', unitInferred: false, explicitUnit: null});
  });
  it.each([{weight: null}, {weight: 501}, {weight: 1101, unit: 'lb'}, {sets: 1.5}, {sets: 21}, {reps: 0}, {reps: 101}, {reps: 8.5}])('asks instead of creating complete draft for %j', group => {
    expect(build({exercises: [exercise('bench', group)]}).question).not.toBeNull();
  });
  it('accepts weight zero and fractional 62.25', () => {for (const weight of [0, 62.25]) expect(build({exercises: [exercise('bench', {weight})]}).question).toBeNull();});
  it.each(['bench', 'pull ups'])('empty groups for %s ask for necessary fields', name => {
    const b = build({exercises: [{raw_name: name, set_groups: []}]}); expect(b.question).toContain(copy.record.fieldSets); expect(b.question).toContain(copy.record.fieldReps);
    expect(b.question?.includes(copy.record.fieldWeight)).toBe(name === 'bench');
  });
  it('ambiguous parameters proceed to card, confirm/save require selection', () => {
    const b = build({exercises: [exercise('press')]}); expect(b.question).toBeNull(); expect(b.draft.exercises[0].chosen).toBeNull();
    expect(validateDraft(b.draft, NOW, 'parse')).toEqual([]); expect(validateDraft(b.draft, NOW, 'confirm')[0].code).toBe('choice'); expect(validateDraft(b.draft, NOW, 'save')[0].code).toBe('choice');
  });
  it('no exercises asks only the exercise question', () => {expect(build({exercises: []}).question).toBe(copy.record.askExercises);});
  it('combines future date before missing sets', () => {
    const b = build({time: timeSchema.parse({raw_text: 'this Friday', type: 'weekday', weekday: 5, week: 'this'}), exercises: [exercise('cable fly', {sets: null})]});
    expect(b.question?.startsWith(copy.record.futureDate)).toBe(true); expect(b.question).toContain(copy.record.fieldSets);
  });
  it('previous-year date remains inferred', () => {const b = build({time: timeSchema.parse({raw_text: '25/12', type: 'date', month: 12, day: 25})}); expect(b.draft).toMatchObject({date: '2025-12-25', dateInferred: true});});
  it('range time asks for a single day', () => {expect(build({time: timeSchema.parse({raw_text: 'this week', type: 'this_week'})}).question).toBe(copy.record.whichDay);});
});
