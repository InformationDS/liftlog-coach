import plan from './seed-plan.json';
import type { Feeling, LiftLogDB, Session, SetGroup } from './schema';
import { exerciseLibrary } from '../kb/exerciseMatcher';
import { localISO } from '../time/resolve';
export function generateSeedSessions(now: Date): Session[] {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid clock');
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7);
  return plan.sessions.flatMap(item => {
    const date = new Date(monday.getTime()); date.setDate(date.getDate() + item.week * 7 + item.weekday - 1);
    const iso = localISO(date); if (iso >= localISO(now)) return [];
    date.setHours(19, 0, 0, 0); const at = date.toISOString();
    return [{id: crypto.randomUUID(), date: iso, feeling: item.feeling as Feeling, notes: item.notes, source: 'seed' as const, rawInputs: [], createdAt: at, updatedAt: at,
      exercises: item.exercises.map(exercise => {
        const id = 'id' in exercise ? exercise.id ?? null : null;
        const name = 'custom' in exercise ? exercise.custom ?? null : null;
        const standard = exerciseLibrary.exercises.find(ex => ex.id === id);
        if (id && !standard) throw new Error('Unknown seed exercise');
        return {standardExerciseId: id, customName: name, rawNames: [standard?.name ?? name ?? ''], setGroups: exercise.sg.map(group => {
          const [weight, unit, sets, reps, setType] = group;
          return {weight, unit, sets, reps, setType} as SetGroup;
        })};
      })}];
  });
}
export async function loadSeed(db: LiftLogDB, now: Date): Promise<void> {
  const sessions = generateSeedSessions(now);
  await db.transaction('rw', db.sessions, async () => { await db.sessions.clear(); await db.sessions.bulkAdd(sessions); });
}

