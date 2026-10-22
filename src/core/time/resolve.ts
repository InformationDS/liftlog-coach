import type { TimeSlot } from '../llm/schemas';
export const localISO = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function localDate(iso: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('Invalid local date');
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (localISO(date) !== iso) throw new Error('Invalid local date');
  return date;
}
const midnight = (now: Date): Date => new Date(now.getFullYear(), now.getMonth(), now.getDate());
const shift = (date: Date, days: number): Date => { const result = new Date(date.getTime()); result.setDate(result.getDate() + days); return result; };
const positive = (n: number | null): number => { if (n === null || !Number.isSafeInteger(n) || n < 1) throw new Error('Expected a positive integer'); return n; };
const monday = (now: Date): Date => shift(midnight(now), -((now.getDay() + 6) % 7));
export function matchTimeReply(text: string): TimeSlot | null {
  const types = Object.entries({today: 'today', yesterday: 'yesterday', 'this week': 'this_week', 'last week': 'last_week', 'this month': 'this_month', 'last month': 'last_month'} as const);
  const type = types.find(([phrase]) => phrase === text.trim().toLowerCase().replace(/\s+/g, ' '))?.[1];
  return type ? {raw_text: text, type, n: null, weekday: null, week: null, month: null, day: null} : null;
}
export type DateResolution = {ok: true; date: string; inferred: boolean; future: boolean} | {ok: false; error: 'single_day_required' | 'invalid_time'};
export function resolveDate(time: TimeSlot | null, now: Date): DateResolution {
  try {
    if (!Number.isFinite(now.getTime())) throw new Error('Invalid clock');
    const today = midnight(now);
    let date = today;
    let inferred = time === null;
    if (time) switch (time.type) {
      case 'today': break;
      case 'yesterday': date = shift(today, -1); break;
      case 'days_ago': date = shift(today, -positive(time.n)); break;
      case 'weekday': {
        const day = positive(time.weekday);
        if (day > 7) throw new Error('Invalid weekday');
        date = time.week === null ? shift(today, -(((today.getDay() || 7) - day + 7) % 7)) : shift(monday(now), day - 1 - (time.week === 'last' ? 7 : 0));
        break;
      }
      case 'date': {
        const month = positive(time.month), day = positive(time.day);
        if (month > 12 || day > 31) throw new Error('Invalid date');
        // Compare month/day before construction so invalid dates cannot roll over.
        const previousYear = month > today.getMonth() + 1 || (month === today.getMonth() + 1 && day > today.getDate());
        const year = today.getFullYear() - (previousYear ? 1 : 0);
        date = localDate(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        inferred = previousYear;
        break;
      }
      default: return {ok: false, error: 'single_day_required'};
    }
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid date');
    return {ok: true, date: localISO(date), inferred, future: date > today};
  } catch { return {ok: false, error: 'invalid_time'}; }
}
export type RangeResolution = {ok: true; start: Date; end: Date} | {ok: false; error: 'invalid_time'};
export function resolveRange(time: TimeSlot, now: Date): RangeResolution {
  try {
    if (!Number.isFinite(now.getTime())) throw new Error('Invalid clock');
    const today = midnight(now);
    let start: Date, end = new Date(now.getTime());
    switch (time.type) {
      case 'this_week': start = monday(now); break;
      case 'last_week': start = shift(monday(now), -7); end = shift(monday(now), -1); end.setHours(23, 59, 59, 999); break;
      case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'last_month': start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999); break;
      case 'last_n_days': start = shift(today, -(positive(time.n) - 1)); break;
      case 'last_n_weeks': start = shift(today, -(7 * positive(time.n) - 1)); break;
      default: {
        const single = resolveDate(time, now);
        if (!single.ok) return {ok: false, error: 'invalid_time'};
        start = localDate(single.date);
        if (time.type !== 'today') { end = new Date(start.getTime()); end.setHours(23, 59, 59, 999); }
      }
    }
    if (!Number.isFinite(start.getTime())) throw new Error('Invalid range');
    return {ok: true, start, end};
  } catch { return {ok: false, error: 'invalid_time'}; }
}
export type TimeContext = 'record_workout' | 'exercise_last' | 'exercise_best' | 'exercise_trend' | 'session_count' | 'volume_sets' | 'day_detail' | 'exercise' | 'body_part' | 'next_session' | 'overall';
export function resolveTime(time: TimeSlot | null, context: TimeContext, now: Date) {
  if (context === 'record_workout') return resolveDate(time, now);
  if (time) return context === 'day_detail' ? resolveDate(time, now) : resolveRange(time, now);
  if (context === 'exercise_last') return {ok: true as const, allHistory: true as const};
  const n = context === 'exercise_best' || context === 'exercise_trend' ? 8 : context === 'exercise' ? 12 : context === 'body_part' ? 4 : context === 'next_session' || context === 'overall' ? 14 : null;
  if (n === null) return {ok: false as const, error: 'missing_time' as const};
  const type = context === 'next_session' || context === 'overall' ? 'last_n_days' : 'last_n_weeks';
  return {...resolveRange({raw_text: '', type, n, weekday: null, week: null, month: null, day: null}, now), defaulted: true, defaultLabel: `last ${n} ${type === 'last_n_days' ? 'days' : 'weeks'}`};
}

