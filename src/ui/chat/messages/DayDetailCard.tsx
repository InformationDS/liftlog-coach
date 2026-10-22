import { copy, fmtDate, fmtSetGroup, formatCopy } from '../../../core/copy';
import type { Session } from '../../../core/db/schema';
import { exerciseLibrary } from '../../../core/kb/exerciseMatcher';
export function DayDetailCard({session, onHistory, now = new Date()}: {session: Session; onHistory: () => void; now?: Date}) {
  const parts = [...new Set(session.exercises.flatMap(entry => {
    const part = exerciseLibrary.exercises.find(e => e.id === entry.standardExerciseId)?.primary_body_part;
    return part ? [copy.bodyPart[part as keyof typeof copy.bodyPart]] : [];
  }))];
  return <div className="space-y-3"><h3 className="font-semibold text-navy">{[fmtDate(session.date, now), ...parts].join(' · ')}</h3>
    {session.feeling && <p>{formatCopy(copy.history.feeling, {feeling: copy.card[session.feeling === 'good' ? 'feelingGood' : session.feeling === 'bad' ? 'feelingBad' : 'feelingNormal']})}</p>}
    {session.exercises.map((entry, i) => {
      const standard = exerciseLibrary.exercises.find(e => e.id === entry.standardExerciseId);
      return <div key={i}><p className="font-medium">{standard?.name ?? entry.customName}</p>{entry.setGroups.map((g, j) => <p key={j} className="tabular-nums">{fmtSetGroup(g, standard?.is_bodyweight ?? false)}{g.setType !== 'working' ? ` · ${g.setType === 'warmup' ? copy.card.setTypeWarmup : copy.card.setTypeDrop}` : ''}</p>)}</div>;
    })}
    {session.notes && <p className="whitespace-pre-wrap">{formatCopy(copy.history.notes, {notes: session.notes})}</p>}
    <button className="rounded border px-3 py-1" onClick={onHistory}>{copy.dayDetail.openInHistory}</button>
  </div>;
}
