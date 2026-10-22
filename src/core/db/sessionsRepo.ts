import { db, type Draft, type LiftLogDB } from './schema';
import { validateDraft } from '../intents/record/validate';
import { merge } from '../intents/record/merge';
import { customKey, type ExerciseTarget } from '../kb/exerciseMatcher';
export function createSessionsRepo(database: LiftLogDB) {
  const list = () => database.sessions.orderBy('date').reverse().toArray();
  return {
    list, getById: (id: string) => database.sessions.get(id),
    getByDate: (date: string) => database.sessions.where('date').equals(date).first(),
    inRange: (start: string, end: string) => database.sessions.where('date').between(start, end, true, true).toArray(),
    async customNames() { return [...new Set((await list()).flatMap(s => s.exercises.flatMap(e => e.customName === null ? [] : [e.customName])))]; },
    async forExercise(target: ExerciseTarget) { return (await list()).filter(s => s.exercises.some(e => target.kind === 'standard' ? e.standardExerciseId === target.id : e.standardExerciseId === null && customKey(e.customName ?? '') === customKey(target.name))); },
    async saveDraft(draft: Draft, now: Date) {
      const issues = validateDraft(draft, now, 'save');
      if (issues.length) return {ok: false as const, issues};
      // Snapshot final edits before any asynchronous boundary.
      const snapshot = structuredClone(draft);
      try {
        const session = await database.transaction('rw', database.sessions, async () => {
          const existing = await database.sessions.where('date').equals(snapshot.date).first();
          const result = merge(existing ?? null, snapshot, now);
          await database.sessions.put(result); return result;
        });
        return {ok: true as const, session};
      } catch { return {ok: false as const, issues: [], error: 'io' as const}; }
    },
    deleteSession: async (id: string): Promise<void> => {await database.sessions.delete(id);},
    clearAll: async (): Promise<void> => {await database.sessions.clear();},
  };
}
export type SessionsReadRepo = Pick<ReturnType<typeof createSessionsRepo>, 'list' | 'getById' | 'getByDate' | 'inRange' | 'customNames' | 'forExercise'>;
export const sessionsRepo = createSessionsRepo(db);
