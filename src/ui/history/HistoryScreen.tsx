import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { copy, fmtDate, fmtSetGroup, formatCopy } from '../../core/copy';
import { exerciseLibrary } from '../../core/kb/exerciseMatcher';
import { sessionsRepo } from '../../core/db/sessionsRepo';
import type { Session } from '../../core/db/schema';
import { Dialog } from '../shared/Dialog';
import { Toast } from '../shared/Toast';
import { useToast } from '../shared/useToast';
export function HistoryScreen() {
  const sessions = useLiveQuery(() => sessionsRepo.list(), []);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [target, setTarget] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false), guard = useRef(false);
  const {toast, setToast} = useToast();
  const remove = async () => {
    if (!target || guard.current) return;
    guard.current = true; setBusy(true);
    try {await sessionsRepo.deleteSession(target.id); setTarget(null); setExpanded(null); setToast(copy.history.deleted);}
    catch {setToast(copy.card.saveFailed);} finally {guard.current = false; setBusy(false);}
  };
  return <div className="space-y-4"><div className="flex justify-between"><h2 className="font-semibold text-navy">{copy.history.title}</h2><span>{formatCopy(copy.history.count, {n: sessions?.length ?? 0})}</span></div>
    {sessions?.length === 0 && <p className="py-10 text-center text-slate-500">{copy.history.empty}</p>}
    {sessions?.map(session => {
      const parts = new Map<string, number>();
      session.exercises.forEach(e => {const part = exerciseLibrary.exercises.find(ex => ex.id === e.standardExerciseId)?.primary_body_part; if (part) parts.set(part, (parts.get(part) ?? 0) + e.setGroups.reduce((n, g) => n + g.sets, 0));});
      const labels = [...parts].sort((a, b) => b[1] - a[1]).map(([p]) => copy.bodyPart[p as keyof typeof copy.bodyPart]);
      return <article key={session.id} className="rounded-lg border border-slate-200 p-3">
        <button className="w-full text-left" aria-expanded={expanded === session.id} onClick={() => setExpanded(expanded === session.id ? null : session.id)}>
          <span className="font-semibold text-navy">{expanded === session.id ? '▾' : '▸'} {fmtDate(session.date, new Date())}{labels.length ? ` · ${labels.join(' · ')}` : ''}</span>
          {session.source === 'seed' && <span className="ml-2 rounded bg-slate-100 px-1 text-xs">{copy.badge.sample}</span>}
          <span className="block text-sm text-slate-500">{formatCopy(copy.history.summary, {exercises: session.exercises.length, sets: session.exercises.flatMap(e => e.setGroups).reduce((n, g) => n + g.sets, 0)})}</span>
        </button>
        {expanded === session.id && <div className="mt-3 space-y-3">
          {session.feeling && <p>{formatCopy(copy.history.feeling, {feeling: copy.card[session.feeling === 'good' ? 'feelingGood' : session.feeling === 'bad' ? 'feelingBad' : 'feelingNormal']})}</p>}
          {session.exercises.map((entry, index) => {
            const standard = exerciseLibrary.exercises.find(e => e.id === entry.standardExerciseId);
            return <div key={index}><p className="font-medium">{standard?.name ?? entry.customName} {!standard && <span className="rounded bg-slate-100 px-1 text-xs">{copy.badge.custom}</span>}</p>
              {entry.setGroups.map((group, i) => <p key={i} className="text-sm">{fmtSetGroup(group, standard?.is_bodyweight ?? false)} · {group.setType === 'warmup' ? copy.card.setTypeWarmup : group.setType === 'drop' ? copy.card.setTypeDrop : copy.card.setTypeWorking}</p>)}</div>;
          })}
          {session.notes && <p className="whitespace-pre-wrap">{formatCopy(copy.history.notes, {notes: session.notes})}</p>}
          {!!session.rawInputs.length && <div><p>{copy.history.loggedFrom}</p>{[...session.rawInputs].sort((a, b) => a.at.localeCompare(b.at)).map((input, i) => <p key={i} className="break-words whitespace-pre-wrap text-sm text-slate-500">{new Date(input.at).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})} “{input.text}”</p>)}</div>}
          <button className="text-red-700" onClick={() => setTarget(session)}>{copy.history.delete}</button>
        </div>}
      </article>;
    })}
    {target && <Dialog title={copy.history.deleteTitle} body={formatCopy(copy.history.deleteBody, {date: fmtDate(target.date, new Date())})} confirm={copy.history.delete} busy={busy} onCancel={() => setTarget(null)} onConfirm={() => void remove()} />}
    <Toast text={toast} />
  </div>;
}

