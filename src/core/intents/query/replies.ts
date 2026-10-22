import { copy, fmtDate, fmtRange, fmtSetGroup, fmtTopSet, formatCopy } from '../../copy';
import { exerciseLibrary, resolveExerciseTarget, type ExerciseTarget } from '../../kb/exerciseMatcher';
import { promptSets, cleanInterpretation, type TrendData } from '../../prompts/builder';
import { localISO, matchTimeReply, resolveTime } from '../../time/resolve';
import { scrubSecrets } from '../../llm/client';
import { clearContext, nextId, type AssistantMessage, type ClarificationPayload, type PendingResume, type PipelineContext, type PipelineResult, type QuerySlots, type ResumeValue, type Trace, type TrendPayload } from '../../pipeline/types';
import { dayDetail, exerciseBest, exerciseLast, exerciseTrend, sessionCount, toKg, volumeSets } from './calculations';

export function periodLabel(time: QuerySlots['time'], start: string, now: Date): string {
  if (!time) return copy.query.lastEightWeeks;
  switch (time.type) {
    case 'this_week': return copy.query.thisWeek;
    case 'last_week': return copy.query.lastWeek;
    case 'this_month': return copy.query.thisMonth;
    case 'last_month': return copy.query.lastMonth;
    case 'last_n_days': return formatCopy(copy.query.lastDays, {n: time.n!});
    case 'last_n_weeks': return formatCopy(copy.query.lastWeeks, {n: time.n!});
    default: return formatCopy(copy.query.onDate, {date: fmtDate(start, now)});
  }
}

// Structured resumes preserve the resolved target, including custom identity.
export async function queryReply(slots: QuerySlots, originalUserText: string, ctx: PipelineContext, trace: Trace,
  target?: ExerciseTarget, createdAt = ctx.now.toISOString()): Promise<PipelineResult> {
  const started = ctx.clock?.() ?? ctx.now.getTime();
  const step = (text: string) => trace.path.push(scrubSecrets(text, ctx.settings.apiKey));
  const finish = (message: AssistantMessage, statePatch: PipelineResult['statePatch'] = clearContext()): PipelineResult => {
    trace.totalLatencyMs += Math.max(0, (ctx.clock?.() ?? ctx.now.getTime()) - started);
    const safeTrace = JSON.parse(scrubSecrets(JSON.stringify(trace), ctx.settings.apiKey)) as Trace;
    return {messages: [{...message, trace: safeTrace}], statePatch};
  };
  const base = () => ({id: nextId(ctx), role: 'assistant' as const, at: ctx.now.toISOString(), trace});
  const text = (value: string) => finish({...base(), kind: 'text', payload: {text: value}});
  const ask = (missing: PendingResume['missing'], question: string, options: ClarificationPayload['options'] = []) => {
    const message = base(); step(`query: ask ${missing}`);
    return finish({...message, kind: 'clarification', payload: {clarificationId: message.id, question, options}}, {
      ...clearContext(), activeClarificationId: message.id,
      pendingResume: {clarificationId: message.id, intent: 'query_training', slots, originalUserText, missing, createdAt},
    });
  };
  const askTime = () => {
    const day = slots.query_type === 'day_detail';
    const options = (day ? copy.query.askDayOptions : copy.query.askPeriodOptions).map(o => ({label: o.label, action: {type: 'resume' as const, value: {kind: 'time' as const, time: matchTimeReply(o.label)!}}}));
    return ask('time', day ? copy.query.askDay : copy.query.askPeriod, options);
  };
  step(`query: ${slots.query_type}`);
  if (slots.query_type === 'unsupported') return text(copy.query.unsupported);
  const resolved = resolveTime(slots.time, slots.query_type, ctx.now);
  if (!resolved.ok) return askTime();
  if (slots.query_type.startsWith('exercise_') && !target) {
    if (!slots.exercise_raw_name?.trim()) return ask('exercise', copy.query.askExercise);
    const found = resolveExerciseTarget(slots.exercise_raw_name, await ctx.repo.customNames());
    step(`match: ${slots.exercise_raw_name} = ${found.kind}`);
    if (found.kind === 'not_found') return text(formatCopy(copy.query.exerciseNotFound, {raw: slots.exercise_raw_name}));
    if (found.kind === 'candidates') return ask('exercise', copy.query.whichExercise, found.candidates.map(id => ({label: exerciseLibrary.exercises.find(e => e.id === id)!.name,
      action: {type: 'resume', value: {kind: 'exercise', target: {kind: 'standard', id}}}})));
    target = found;
  }
  const range = 'start' in resolved ? {start: localISO(resolved.start), end: localISO(resolved.end)} : undefined;
  const label = periodLabel(slots.time, range?.start ?? ('date' in resolved ? resolved.date : ''), ctx.now);
  const defaultNote = slots.time === null && slots.query_type === 'exercise_best' ? ` ${copy.query.defaultRangeNote}` : '';
  const sessions = await ctx.repo.list();
  if (slots.query_type === 'day_detail' && 'date' in resolved) {
    const session = dayDetail(sessions, resolved.date);
    return session ? finish({...base(), kind: 'day_detail', payload: {session}}) : text(formatCopy(copy.query.dayNone, {date: fmtDate(resolved.date, ctx.now)}));
  }
  if (slots.query_type === 'session_count') {
    const n = sessionCount(sessions, range);
    return text(formatCopy(n ? copy.query.sessionCount : copy.query.sessionCountZero, {n, period: label, range: range ? fmtRange(range.start, range.end, ctx.now) : ''}));
  }
  if (slots.query_type === 'volume_sets') {
    const data = volumeSets(sessions, range);
    if (!data.sessionCount) return text(formatCopy(copy.query.sessionCountZero, {period: label}));
    const volume = (['kg', 'lb'] as const).flatMap(unit => data.volume[unit] === undefined ? [] : [`${data.volume[unit]} ${unit}`]).join(' + ');
    return text(formatCopy(volume ? copy.query.volumeSets : copy.query.volumeNoWeighted, {period: label, sets: data.sets, volume}) + (data.hasBodyweight ? ` ${copy.query.volumeBodyweightNote}` : ''));
  }
  if (!target) return ask('exercise', copy.query.askExercise);
  const standard = target.kind === 'standard' ? exerciseLibrary.exercises.find(e => e.id === target.id) : undefined;
  const exercise = standard?.name ?? (target.kind === 'custom' ? target.name : '');
  if (slots.query_type === 'exercise_last') {
    const data = exerciseLast(sessions, target, range);
    return text(formatCopy(data ? copy.query.exerciseLast : copy.query.exerciseLastNone, {exercise,
      date: data ? fmtDate(data.session.date, ctx.now) : '', setGroups: data?.groups.map(g => fmtSetGroup(g, standard?.is_bodyweight ?? false)).join('; ') ?? ''}));
  }
  if (slots.query_type === 'exercise_best') {
    const data = exerciseBest(sessions, target, range), best = data.best;
    const result = formatCopy(data.status === 'no_records' ? copy.query.exerciseBestNone : !best ? copy.query.noWeightedData : copy.query.exerciseBest,
      {exercise, period: label, topSet: best ? fmtTopSet(best.group.weight!, best.group.unit, best.group.reps) : '', date: best ? fmtDate(best.date, ctx.now) : ''});
    return text(result + defaultNote + (best && data.excludesBodyweight ? ` ${copy.query.weightedOnlyNote}` : ''));
  }
  const data = exerciseTrend(sessions, target, range);
  if (data.status === 'no_weighted_data') return text(formatCopy(copy.query.noWeightedData, {exercise, period: label}));
  const payload: TrendPayload = {exerciseId: target.kind === 'standard' ? target.id : null, exerciseLabel: exercise,
    rangeLabel: slots.time === null ? copy.trend.defaultRange : label, periodLabel: label,
    points: data.points.map(p => ({date: p.date, topWeightKg: p.topWeightKg, topWeightDisplay: fmtTopSet(p.topSet.weight!, p.topSet.unit, p.topSet.reps), volumeKg: p.volumeKg})),
    mixedUnits: data.mixedUnits, excludesBodyweight: data.excludesBodyweight, interpretation: null, notEnoughData: data.notEnoughData};
  if (!data.notEnoughData && data.best && range) {
    const best = data.best;
    const trendData: TrendData = {exercise, range: `${payload.rangeLabel} (${fmtRange(range.start, range.end, ctx.now)})`, mixed_units: data.mixedUnits,
      sessions: payload.points.map(p => ({date: fmtDate(p.date, ctx.now), top_set: p.topWeightDisplay, top_weight_kg: p.topWeightKg, volume_kg: p.volumeKg})),
      summary: {session_count: data.sessionCount, first_top_weight_kg: data.points[0].topWeightKg, last_top_weight_kg: data.points.at(-1)!.topWeightKg,
        best_top_set: fmtTopSet(best.group.weight!, best.group.unit, best.group.reps), best_top_weight_kg: toKg(best.group.weight!, best.group.unit), best_date: fmtDate(best.date, ctx.now),
        change_kg: data.change_kg!, change_percent: data.change_percent, sessions_since_last_increase: data.sessions_since_last_increase!}};
    trace.dataSentToAi = `${exercise}: ${data.sessionCount} sessions, ${data.points[0].date} – ${data.points.at(-1)!.date}`;
    const response = await ctx.llm.call('trend_interpretation', promptSets[ctx.settings.ruleVersion].trendInterpretation(trendData));
    trace.aiCalls.push(...response.logs);
    step(`trend_interpretation: ${response.ok ? 'ok' : `error (${response.error})`}`);
    payload.interpretation = response.ok ? cleanInterpretation(response.data) || null : null;
  } else step('trend_interpretation: skipped (fewer than 3 weighted sessions)');
  return finish({...base(), kind: 'trend', payload});
}

export function resumeQuery(pending: PendingResume, value: ResumeValue, ctx: PipelineContext, trace: Trace): Promise<PipelineResult> {
  const slots = pending.slots as QuerySlots;
  return queryReply(value.kind === 'time' ? {...slots, time: value.time} : slots, pending.originalUserText, ctx, trace,
    value.kind === 'exercise' ? value.target : undefined, pending.createdAt);
}
