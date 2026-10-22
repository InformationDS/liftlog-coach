import { z } from 'zod';

const decimalNumberPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
export const preprocessNumber = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  return decimalNumberPattern.test(text) ? Number(text) : value;
};
export const finiteNumberSchema = z.preprocess(preprocessNumber, z.number().finite());
export const confidenceSchema = z.preprocess(preprocessNumber, z.number().finite().min(0).max(1));
const nullableNumber = finiteNumberSchema.nullable().default(null);
const nullableText = z.string().nullable().default(null);
export const timeSchema = z.object({
  raw_text: z.string(),
  type: z.enum(['today', 'yesterday', 'days_ago', 'weekday', 'date', 'this_week', 'last_week', 'this_month', 'last_month', 'last_n_days', 'last_n_weeks']),
  n: nullableNumber, weekday: nullableNumber,
  week: z.enum(['this', 'last']).nullable().default(null), month: nullableNumber, day: nullableNumber,
}).passthrough();
export type TimeSlot = z.infer<typeof timeSchema>;
export const setGroupSchema = z.object({
  weight: nullableNumber, unit: z.enum(['kg', 'lb']).nullable().default(null),
  sets: nullableNumber, reps: nullableNumber,
  set_type: z.enum(['warmup', 'working', 'drop']).nullable().default(null),
}).passthrough();
export const recordSlotsSchema = z.object({
  draft_action: z.enum(['new', 'continue']), time: timeSchema.nullable().default(null),
  feeling: z.enum(['good', 'normal', 'bad']).nullable().default(null),
  feeling_text: nullableText, notes: nullableText,
  exercises: z.array(z.object({raw_name: z.string(), set_groups: z.array(setGroupSchema).default([])}).passthrough()).default([]),
  cardio_items: z.array(z.string()).default([]),
}).passthrough();
export const querySlotsSchema = z.object({
  query_type: z.enum(['session_count', 'volume_sets', 'day_detail', 'exercise_last', 'exercise_best', 'exercise_trend', 'unsupported']),
  time: timeSchema.nullable().default(null), exercise_raw_name: nullableText,
}).passthrough();
export const bodyPartSchema = z.enum(['chest', 'back', 'shoulders', 'legs', 'glutes', 'biceps', 'triceps', 'core']);
export const adviceSlotsSchema = z.object({
  advice_type: z.enum(['exercise', 'body_part', 'next_session', 'overall', 'general_knowledge', 'unclear']),
  exercise_raw_name: nullableText, body_part: bodyPartSchema.nullable().default(null),
  mentions_discomfort: z.boolean().default(false), user_question: z.string(),
}).passthrough();
export const medicalSlotsSchema = z.object({category: z.enum(['diagnosis', 'treatment', 'medication_supplement', 'training_with_pain']), body_area: nullableText}).passthrough();
export const destructiveSlotsSchema = z.object({category: z.enum(['delete', 'clear_all', 'edit_record', 'change_date']), target_text: nullableText}).passthrough();
export const unknownSlotsSchema = z.object({category: z.enum(['out_of_scope', 'unsupported_feature', 'vague', 'chitchat'])}).passthrough();
const common = {
  confidence: confidenceSchema, reason: z.string().default(''),
  clarification: z.object({question: nullableText, options: z.array(z.string()).default([]).transform(v => v.slice(0, 2))}).default({question: null, options: []}),
};
export const classificationSchema = z.discriminatedUnion('intent', [
  z.object({...common, intent: z.literal('record_workout'), slots: recordSlotsSchema}),
  z.object({...common, intent: z.literal('query_training'), slots: querySlotsSchema}),
  z.object({...common, intent: z.literal('get_advice'), slots: adviceSlotsSchema}),
  z.object({...common, intent: z.literal('dangerous_health_query'), slots: medicalSlotsSchema}),
  z.object({...common, intent: z.literal('destructive_operation'), slots: destructiveSlotsSchema}),
  z.object({...common, intent: z.literal('unknown'), slots: unknownSlotsSchema}),
]);
export const riskCheckSchema = z.object({risk: z.enum(['medical', 'destructive', 'none']), category: nullableText, confidence: confidenceSchema, reason: z.string().default('')});
export type Classification = z.infer<typeof classificationSchema>;
