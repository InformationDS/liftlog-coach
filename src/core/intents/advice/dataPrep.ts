import { copy, fmtDate, fmtRange, fmtTopSet, fmtWeight, formatCopy } from '../../copy';
import type { Session } from '../../db/schema';
import type { SessionsReadRepo } from '../../db/sessionsRepo';
import { exerciseLibrary, type ExerciseTarget } from '../../kb/exerciseMatcher';
import type { AdviceSlots } from '../../pipeline/types';
import { localDate, localISO, resolveTime } from '../../time/resolve';
import { exerciseBest, exerciseSessions, inRange, topSet, volumeSets } from '../query/calculations';
export type AdviceMode = 'data' | 'insufficient' | 'general';
export interface AdviceData {mode: AdviceMode; dataJson: Record<string, unknown> | null; label: string; targetLabel: string; sessionCount: number}
const parts = Object.keys(copy.bodyPart) as (keyof typeof copy.bodyPart)[];
const library = (id: string | null) => exerciseLibrary.exercises.find(e => e.id === id);
const sets = (s: Session, part: string) => s.exercises.reduce((sum, e) => {const ex = library(e.standardExerciseId); return sum + e.setGroups.reduce((n,g) => n + g.sets, 0) * (ex?.primary_body_part === part ? 1 : ex?.secondary_body_parts.includes(part) ? 0.5 : 0);}, 0);
export async function dataPrep(slots: AdviceSlots, target: ExerciseTarget | undefined, repo: SessionsReadRepo, now: Date): Promise<AdviceData> {
  const ex = target?.kind === 'standard' ? library(target.id) : undefined;
  const targetLabel = slots.advice_type === 'exercise' ? ex?.name ?? (target?.kind === 'custom' ? target.name : '') : slots.advice_type === 'body_part' ? `${slots.body_part} training` : 'your recent training';
  const general = (mode: 'general' | 'insufficient'): AdviceData => ({mode, dataJson: null, label: copy.badge.general, targetLabel, sessionCount: 0});
  if (slots.advice_type === 'general_knowledge') return general('general');
  const days = slots.advice_type === 'exercise' ? 84 : slots.advice_type === 'body_part' ? 28 : 14;
  const resolved = resolveTime({type: 'last_n_days', n: days, raw_text: '', weekday: null, week: null, month: null, day: null}, 'session_count', now);
  if (!resolved.ok || !('start' in resolved)) throw Error('Invalid advice window');
  const range = {start: localISO(resolved.start), end: localISO(resolved.end)};
  const selected = inRange(await repo.list(), range);
  const window = `last ${days === 14 ? '14 days' : days === 28 ? '4 weeks' : '12 weeks'} (${fmtRange(range.start, range.end, now)})`;
  let dataJson: Record<string, unknown>, dates: string[];
  if (slots.advice_type === 'exercise' && target) {
    const found = exerciseSessions(selected, target);
    if (found.length < 3) return general('insufficient');
    const best = exerciseBest(selected, target).best;
    const top = (groups: typeof found[number]['groups']) => {const g = topSet(groups); return g ? fmtTopSet(g.weight!, g.unit, g.reps) : null;};
    dates = found.map(s => s.session.date);
    dataJson = {exercise: targetLabel, window, session_count: found.length, sessions_per_week: Math.round(found.length / 12 * 10) / 10,
      sessions: found.map(({session, groups}) => ({date: fmtDate(session.date, now), set_groups: groups.map(g => `${g.weight === null ? copy.card.bodyweight : `${ex?.is_bodyweight ? 'BW + ' : ''}${fmtWeight(g.weight, g.unit)}`} × ${g.reps} × ${g.sets}`), top_set: top(groups)})),
      summary: {first_top_set: top(found[0].groups), last_top_set: top(found.at(-1)!.groups), best_top_set: best ? fmtTopSet(best.group.weight!, best.group.unit, best.group.reps) : null, best_date: best ? fmtDate(best.date, now) : null,
        sessions_at_or_below_best_since: best ? found.filter(s => s.session.date > best.date && topSet(s.groups) !== null).length : null}};
  } else if (slots.advice_type === 'body_part' && slots.body_part) {
    const part = slots.body_part, found = selected.filter(s => sets(s, part) > 0);
    if (found.length < 2) return general('insufficient');
    dates = found.map(s => s.date);
    const totals = parts.map(id => ({id, total: selected.reduce((n,s) => n + sets(s,id), 0)}));
    const exercises = exerciseLibrary.exercises.filter(e => e.primary_body_part === part || e.secondary_body_parts.includes(part)).flatMap(e => {
      const entries = found.flatMap(s => s.exercises.filter(x => x.standardExerciseId === e.id));
      return entries.length ? [{name: e.name, sessions: found.filter(s => s.exercises.some(x => x.standardExerciseId === e.id)).length, sets: entries.reduce((n,x) => n + x.setGroups.reduce((a,g) => a + g.sets,0),0), role: e.primary_body_part === part ? 'primary' : 'secondary'}] : [];
    }).sort((a,b) => b.sets - a.sets);
    dataJson = {body_part: part, window, sessions_hitting_it: found.length, weighted_sets: found.reduce((n,s) => n + sets(s,part),0), weighted_sets_note: 'primary sets count 1, secondary sets count 0.5',
      sessions: found.map(s => ({date: fmtDate(s.date,now), weighted_sets: sets(s,part), exercises: s.exercises.flatMap(e => {const x=library(e.standardExerciseId); return x && (x.primary_body_part === part || x.secondary_body_parts.includes(part)) ? [x.name] : [];} )})), exercises,
      comparison: Object.fromEntries(totals.filter(x => x.id !== part).sort((a,b) => b.total-a.total).slice(0,2).map(x => [`${x.id}_weighted_sets`,x.total]))};
  } else {
    if (selected.length < 2) return general('insufficient');
    dates = selected.map(s => s.date);
    const primary = (s: Session) => parts.filter(p => s.exercises.some(e => library(e.standardExerciseId)?.primary_body_part === p));
    const calendar = (iso: string) => {const d=localDate(iso); return Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());};
    dataJson = {window, sessions: selected.map(s => ({date: fmtDate(s.date,now), body_parts: primary(s), total_sets: volumeSets([s]).sets})),
      days_since_last_trained: Object.fromEntries(parts.map(p => {const last=selected.filter(s => primary(s).includes(p)).at(-1); return [p,last ? (calendar(localISO(now))-calendar(last.date))/86400000 : null];})),
      days_since_note: 'null means not trained in the last 14 days', today: fmtDate(localISO(now),now)};
  }
  return {mode: 'data', dataJson, targetLabel, sessionCount: dates.length, label: `${formatCopy(copy.badge.basedOnData,{n:dates.length})}, ${fmtRange(dates[0],dates.at(-1)!,now)}`};
}
