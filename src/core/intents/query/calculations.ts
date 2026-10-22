import type { ExerciseEntry, Session, SetGroup } from '../../db/schema';
import { customKey, type ExerciseTarget } from '../../kb/exerciseMatcher';
export interface DateRange { start: string; end: string }
const round1 = (value: number) => Math.round(value * 10) / 10;
export const toKg = (weight: number, unit: 'kg' | 'lb'): number => unit === 'lb' ? round1(weight * 0.45359237) : weight;
const exactKg = (g: SetGroup) => (g.weight ?? 0) * (g.unit === 'lb' ? 0.45359237 : 1);
export const inRange = (sessions: readonly Session[], range?: DateRange): Session[] => sessions.filter(s => !range || (s.date >= range.start && s.date <= range.end)).sort((a, b) => a.date.localeCompare(b.date));
export const matchesTarget = (entry: ExerciseEntry, target: ExerciseTarget): boolean => target.kind === 'standard' ? entry.standardExerciseId === target.id : entry.standardExerciseId === null && customKey(entry.customName ?? '') === customKey(target.name);
export function exerciseSessions(sessions: readonly Session[], target: ExerciseTarget, range?: DateRange) {
  return inRange(sessions, range).flatMap(session => {
    const entries = session.exercises.filter(e => matchesTarget(e, target));
    return entries.length ? [{session, groups: entries.flatMap(e => e.setGroups)}] : [];
  });
}
export const sessionCount = (sessions: readonly Session[], range?: DateRange): number => inRange(sessions, range).length;
export function volumeSets(sessions: readonly Session[], range?: DateRange) {
  const selected = inRange(sessions, range);
  const volume: Partial<Record<'kg' | 'lb', number>> = {};
  let sets = 0, hasBodyweight = false;
  for (const group of selected.flatMap(s => s.exercises.flatMap(e => e.setGroups))) {
    sets += group.sets;
    if (group.weight === null) hasBodyweight = true;
    else volume[group.unit] = (volume[group.unit] ?? 0) + group.weight * group.reps * group.sets;
  }
  for (const unit of ['kg', 'lb'] as const) if (volume[unit] !== undefined) volume[unit] = Math.round(volume[unit]);
  return {sessionCount: selected.length, sets, volume, hasBodyweight};
}
export const dayDetail = (sessions: readonly Session[], date: string) => sessions.find(s => s.date === date) ?? null;
export function topSet(groups: readonly SetGroup[]): SetGroup | null {
  return groups.filter((g): g is SetGroup & {weight: number} => g.weight !== null).reduce<SetGroup | null>((best, g) => !best || toKg(g.weight, g.unit) > toKg(best.weight!, best.unit) || (toKg(g.weight, g.unit) === toKg(best.weight!, best.unit) && g.reps > best.reps) ? g : best, null);
}
export function exerciseLast(sessions: readonly Session[], target: ExerciseTarget, range?: DateRange) {
  const latest = exerciseSessions(sessions, target, range).at(-1);
  return latest ? {...latest, topSet: topSet(latest.groups)} : null;
}
export function exerciseBest(sessions: readonly Session[], target: ExerciseTarget, range?: DateRange) {
  const selected = exerciseSessions(sessions, target, range);
  const excludesBodyweight = selected.some(s => s.groups.some(g => g.weight === null));
  let best: {date: string; group: SetGroup} | null = null;
  for (const {session, groups} of selected) {
    const top = topSet(groups);
    if (top && (!best || topSet([best.group, top]) === top)) best = {date: session.date, group: top};
  }
  return {status: !selected.length ? 'no_records' as const : !best ? 'no_weighted_data' as const : 'ok' as const, best, excludesBodyweight};
}
export function exerciseTrend(sessions: readonly Session[], target: ExerciseTarget, range?: DateRange) {
  const selected = exerciseSessions(sessions, target, range);
  const excludesBodyweight = selected.some(s => s.groups.some(g => g.weight === null));
  const units = new Set<string>();
  const points = selected.flatMap(({session, groups}) => {
    const top = topSet(groups); if (!top) return [];
    const weighted = groups.filter(g => g.weight !== null); weighted.forEach(g => units.add(g.unit));
    return [{date: session.date, topSet: top, topWeightKg: toKg(top.weight!, top.unit), volumeKg: Math.round(weighted.reduce((sum, g) => sum + exactKg(g) * g.reps * g.sets, 0))}];
  });
  let high = -Infinity, lastIncrease = 0;
  points.forEach((p, i) => {if (p.topWeightKg > high) {high = p.topWeightKg; lastIncrease = i;}});
  const first = points[0]?.topWeightKg, last = points.at(-1)?.topWeightKg;
  return {status: !selected.length ? 'no_records' as const : !points.length ? 'no_weighted_data' as const : points.length < 3 ? 'not_enough_data' as const : 'ok' as const,
    points, sessionCount: points.length, excludesBodyweight, mixedUnits: units.size > 1, notEnoughData: points.length < 3,
    change_kg: first === undefined || last === undefined ? null : round1(last - first),
    change_percent: first === undefined || last === undefined || first === 0 ? null : round1((last - first) / first * 100),
    sessions_since_last_increase: points.length ? points.length - 1 - lastIncrease : null,
    best: exerciseBest(sessions, target, range).best};
}
