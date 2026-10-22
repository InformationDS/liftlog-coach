import { expect, it } from 'vitest';
import { classificationSchema, riskCheckSchema, confidenceSchema, finiteNumberSchema, recordSlotsSchema } from '../core/llm/schemas';
const p1 = (confidence: unknown) => ({intent: 'unknown', slots: {category: 'chitchat'}, confidence});
const p2 = (confidence: unknown) => ({risk: 'none', confidence});
it.each([null, true, false, '', '  ', undefined, NaN, Infinity, -Infinity, '0x1', '1e309', -0.1, 1.1, '.65', '+1'])('rejects confidence %s in P1 and P2', value => {
  expect(confidenceSchema.safeParse(value).success).toBe(false);
  expect(classificationSchema.safeParse(p1(value)).success).toBe(false);
  expect(riskCheckSchema.safeParse(p2(value)).success).toBe(false);
});
it.each([0, 1, 0.65, '0.65', ' 0.65 ', '6.5e-1'])('accepts finite decimal confidence %s in P1 and P2', value => {
  const expected = Number(value);
  expect(confidenceSchema.parse(value)).toBe(expected);
  expect(classificationSchema.parse(p1(value)).confidence).toBe(expected);
  expect(riskCheckSchema.parse(p2(value)).confidence).toBe(expected);
});
it('fails unknown intent, missing slots, invalid types and missing P1/P2 confidence', () => {
  for (const value of [{intent: 'unknown', confidence: 1}, {...p1(1), intent: 'other'}, {...p1(1), slots: null}, {...p1(1), slots: []}, {intent: 'unknown', slots: {category: 'chitchat'}}, {risk: 'none'}]) {
    expect(('risk' in value ? riskCheckSchema : classificationSchema).safeParse(value).success).toBe(false);
  }
});
it.each(['new', 'continue'])('requires and accepts draft_action %s', action => expect(recordSlotsSchema.parse({draft_action: action}).draft_action).toBe(action));
it.each([undefined, null, '', 'update'])('rejects draft_action %s', action => {
  expect(recordSlotsSchema.safeParse({draft_action: action}).success).toBe(false);
  expect(classificationSchema.safeParse({intent: 'record_workout', confidence: 1, slots: {draft_action: action}}).success).toBe(false);
});
it('preserves nullable numbers, converts decimals and leaves range validation to recording', () => {
  const parsed = recordSlotsSchema.parse({draft_action: 'new', exercises: [{raw_name: 'squat', set_groups: [{weight: null, sets: '60', reps: 1.5}, {weight: '1000', sets: -1, reps: '6.5e1'}]}]});
  expect(parsed.exercises[0].set_groups[0]).toMatchObject({weight: null, sets: 60, reps: 1.5, unit: null});
  expect(parsed.exercises[0].set_groups[1]).toMatchObject({weight: 1000, sets: -1, reps: 65});
  expect(parsed.time).toBeNull();
});
it.each(['', ' ', true, false, NaN, Infinity, '1e309', '0x10'])('rejects invalid slot number %s', weight => expect(recordSlotsSchema.safeParse({draft_action: 'new', exercises: [{raw_name: 'bench', set_groups: [{weight}]}]}).success).toBe(false));
it('validates all intent slot enums, optional defaults and passthrough metadata', () => {
  const cases = [
    ['query_training', {query_type: 'unsupported'}], ['get_advice', {advice_type: 'exercise', user_question: 'Help', body_part: 'back', mentions_discomfort: true}],
    ['dangerous_health_query', {category: 'training_with_pain'}], ['destructive_operation', {category: 'edit_record'}], ['unknown', {category: 'vague'}],
  ];
  for (const [intent, slots] of cases) {
    expect(classificationSchema.safeParse({intent, slots, confidence: 1}).success).toBe(true);
    expect(classificationSchema.safeParse({intent, slots: {}, confidence: 1}).success).toBe(false);
  }
  expect(classificationSchema.parse({...p1(1), slots: {category: 'chitchat', extra: 'ignored by consumers'}, clarification: {options: ['a', 'b', 'c']}})).toMatchObject({slots: {extra: 'ignored by consumers'}, clarification: {question: null, options: ['a', 'b']}});
  expect(classificationSchema.safeParse({intent: 'get_advice', confidence: 1, slots: {advice_type: 'body_part', body_part: 'arms', user_question: 'Help'}}).success).toBe(false);
  expect(finiteNumberSchema.parse('60')).toBe(60);
});
