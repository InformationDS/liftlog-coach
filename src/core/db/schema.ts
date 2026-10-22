import Dexie, { type Table } from 'dexie';
import type { ExerciseTarget } from '../kb/exerciseMatcher';
export type Unit = 'kg' | 'lb';
export type Feeling = 'good' | 'normal' | 'bad';
export type SetType = 'warmup' | 'working' | 'drop';
export interface SetGroup { weight: number | null; unit: Unit; sets: number; reps: number; setType: SetType }
export interface ExerciseEntry { standardExerciseId: string | null; customName: string | null; rawNames: string[]; setGroups: SetGroup[] }
export interface RawInput { text: string; at: string }
export interface Session { id: string; date: string; feeling: Feeling | null; notes: string | null; exercises: ExerciseEntry[]; rawInputs: RawInput[]; source: 'user' | 'seed'; createdAt: string; updatedAt: string }
export interface DraftExercise {
  rawName: string;
  match: {status: 'matched' | 'ambiguous' | 'unmatched_with_candidates' | 'unmatched'; standardExerciseId: string | null; candidates: string[]};
  chosen: ExerciseTarget | null;
  setGroups: (SetGroup & {unitInferred: boolean; explicitUnit: Unit | null})[];
}
export interface Draft { date: string; dateInferred: boolean; feeling: Feeling | null; feelingInferred: boolean; feelingText: string | null; feelingReplaces: Feeling | null; notes: string | null; rawText: string; exercises: DraftExercise[] }
export class LiftLogDB extends Dexie {
  sessions!: Table<Session, string>;
  constructor(name = 'liftlog') { super(name); this.version(1).stores({sessions: 'id, &date'}); }
}
export const db = new LiftLogDB();
