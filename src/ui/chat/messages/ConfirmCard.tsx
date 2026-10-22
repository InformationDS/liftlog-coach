import { useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { copy, formatCopy, fmtDate, fmtSetGroup } from '../../../core/copy';
import { sessionsRepo } from '../../../core/db/sessionsRepo';
import type { Draft, DraftExercise, Feeling, SetType, Unit } from '../../../core/db/schema';
import { exerciseLibrary, type ExerciseTarget } from '../../../core/kb/exerciseMatcher';
import { isBodyweight, normalizeGroupUnits } from '../../../core/intents/record/buildDraft';
import { validateDraft, type DraftValidationIssue } from '../../../core/intents/record/validate';
import type { ConfirmCardPayload } from '../../../core/pipeline/types';
import { localISO } from '../../../core/time/resolve';
const savingCards = new Set<string>();
const displayDate = (date: string, now: Date): string => {try {return fmtDate(date, now);} catch {return date || copy.card.feelingNone;}};
const nameOf = (e: DraftExercise) => e.chosen?.kind === 'standard' ? exerciseLibrary.exercises.find(x => x.id === (e.chosen?.kind === 'standard' ? e.chosen.id : null))?.name ?? e.rawName : e.chosen?.kind === 'custom' ? e.chosen.name : e.rawName;
function Inferred({active, children}: {active: boolean; children: ReactNode}) {return <span data-inferred={active || undefined} title={active ? copy.card.inferredTooltip : undefined} className={active ? 'rounded bg-amber-100 p-1' : ''}>{active && <span aria-hidden="true">≈ </span>}{children}</span>;}
function issueCopy(issues: DraftValidationIssue[], draft: Draft): string | null {
  const first = issues[0];
  if (!first) return null;
  return first.code === 'choice' ? formatCopy(copy.card.chooseExerciseFor, {raw: draft.exercises[first.exerciseIndex ?? 0]?.rawName ?? ''}) : first.code === 'missing' ? copy.card.fixMissing : first.code === 'date' ? copy.card.fixDate : copy.card.fixValues;
}
export function ConfirmCard({id, payload, onUpdate, onHistory, repo = sessionsRepo, now = () => new Date(), defaultUnit = 'kg'}: {
  id: string; payload: ConfirmCardPayload; onUpdate: (id: string, payload: ConfirmCardPayload) => void; onHistory: () => void;
  repo?: typeof sessionsRepo; now?: () => Date; defaultUnit?: Unit;
}) {
  const [saving, setSaving] = useState(false), [failure, setFailure] = useState<string | null>(null);
  const lock = useRef(false), [changing, setChanging] = useState<number | null>(null);
  const draft = payload.draft, editable = payload.status === 'draft';
  const existing = useLiveQuery(() => /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? repo.getByDate(draft.date).then(value => value ?? null) : null, [draft.date, repo]);
  const issues = validateDraft(draft, now(), 'confirm'), reason = issueCopy(issues, draft);
  const edit = (mutate: (d: Draft) => void) => {
    if (!editable || lock.current || savingCards.has(id)) return;
    const next = structuredClone(draft); mutate(next); setFailure(null);
    onUpdate(id, {...payload, draft: next});
  };
  const choose = (ei: number, target: ExerciseTarget) => {edit(d => {d.exercises[ei].chosen = target; normalizeGroupUnits(d.exercises[ei], defaultUnit);}); setChanging(null);};
  const save = async () => {
    if (!editable || lock.current || savingCards.has(id)) return;
    const errors = validateDraft(draft, now(), 'save');
    if (errors.length) {setFailure(issueCopy(errors, draft)); return;}
    lock.current = true; savingCards.add(id); setSaving(true); setFailure(null);
    try {
      const result = await repo.saveDraft(draft, now());
      if (result.ok) onUpdate(id, {...payload, status: 'saved'});
      else setFailure(result.issues.length ? issueCopy(result.issues, draft) : copy.card.saveFailed);
    } catch {setFailure(copy.card.saveFailed);}
    finally {lock.current = false; savingCards.delete(id); setSaving(false);}
  };
  const numeric = (raw: string): number => raw === '' ? null as unknown as number : Number(raw);
  return <div className={payload.status === 'discarded' ? 'opacity-50' : ''}>
    <span className="rounded bg-slate-100 px-2 py-1 text-xs">{copy.badge.aiDraft}</span>
    {editable && existing && <div className="my-2 rounded bg-slate-100 p-2"><p>{formatCopy(copy.card.appendNotice, {date: fmtDate(existing.date, now()), n: existing.exercises.length})}</p><details><summary>{copy.card.appendShow}</summary>{existing.exercises.map((e, i) => <p key={i}>{exerciseLibrary.exercises.find(x => x.id === e.standardExerciseId)?.name ?? e.customName}: {e.setGroups.map(g => fmtSetGroup(g, exerciseLibrary.exercises.some(x => x.id === e.standardExerciseId && x.is_bodyweight))).join('; ')}</p>)}</details></div>}
    <blockquote className="my-3 whitespace-pre-wrap border-l-2 pl-2 italic text-slate-500">{draft.rawText}</blockquote>
    <fieldset disabled={!editable || saving} className="space-y-3 disabled:opacity-90">
    <label className="block">{copy.card.date} <Inferred active={draft.dateInferred}>{editable ? <input aria-label={copy.card.date} type="date" max={localISO(now())} value={draft.date} onChange={e => edit(d => {d.date = e.target.value; d.dateInferred = false;})} /> : displayDate(draft.date, now())}</Inferred></label>
    <label className="block">{copy.card.feeling} <Inferred active={draft.feelingInferred}>{editable ? <select aria-label={copy.card.feeling} value={draft.feeling ?? ''} onChange={e => edit(d => {d.feeling = e.target.value === '' ? null : e.target.value as Feeling; d.feelingInferred = false;})}>{[['', copy.card.feelingNone], ['good', copy.card.feelingGood], ['normal', copy.card.feelingNormal], ['bad', copy.card.feelingBad]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : draft.feeling ?? copy.card.feelingNone}</Inferred></label>
    {draft.feelingInferred && <p>{formatCopy(copy.card.feelingMapped, {text: draft.feelingText ?? '', feeling: draft.feeling ?? ''})}</p>}
    {editable && existing?.feeling && draft.feeling !== null && existing.feeling !== draft.feeling && <p className="bg-amber-100 p-1">{formatCopy(copy.card.feelingReplace, {old: existing.feeling, new: draft.feeling})}</p>}
    {draft.exercises.map((exercise, ei) => <section className="border-t py-3" key={ei}>
      <div className="flex justify-between gap-2"><strong>{nameOf(exercise)}</strong>{editable && <button aria-label={`${copy.card.removeExercise}: ${exercise.rawName}`} disabled={draft.exercises.length <= 1} onClick={() => edit(d => {d.exercises.splice(ei, 1);})}>×</button>}</div>
      <small>{formatCopy(copy.card.youWrote, {raw: exercise.rawName})}</small>
      {editable && exercise.chosen && <button className="ml-2 underline" onClick={() => setChanging(ei)}>{copy.card.change}</button>}
      {editable && (!exercise.chosen || changing === ei) && <div className="my-2 space-y-2"><p>{exercise.match.status === 'unmatched' ? copy.card.notInLibrary : copy.card.chooseExercise}</p>
        <div className="flex flex-wrap gap-2">{(exercise.match.status === 'matched' ? [exercise.match.standardExerciseId!] : exercise.match.candidates).map(candidate => <button className="rounded border p-2" key={candidate} onClick={() => choose(ei, {kind: 'standard', id: candidate})}>{exerciseLibrary.exercises.find(x => x.id === candidate)?.name}</button>)}
        {exercise.match.status.startsWith('unmatched') && <button className="rounded border p-2" onClick={() => choose(ei, {kind: 'custom', name: exercise.rawName})}>{formatCopy(copy.card.keepCustom, {raw: exercise.rawName})}</button>}</div>
        {exercise.match.status === 'unmatched' && <select aria-label={copy.card.selectFromList} value="" onChange={e => {if (e.target.value) choose(ei, {kind: 'standard', id: e.target.value});}}><option value="">{copy.card.selectFromList}</option>{Object.entries(copy.bodyPart).map(([part, label]) => <optgroup key={part} label={label}>{exerciseLibrary.exercises.filter(x => x.primary_body_part === part).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}</select>}
      </div>}
      {exercise.setGroups.map((group, si) => !editable ? <p key={si}>{fmtSetGroup(group, isBodyweight(exercise))} {group.setType === 'working' ? '' : group.setType === 'warmup' ? copy.card.setTypeWarmup : copy.card.setTypeDrop}</p> : <div className="my-2 flex flex-wrap items-center gap-1" key={si}>
        {isBodyweight(exercise) && group.weight === null && <span>{copy.card.bodyweight}</span>}
        <input className="w-20 rounded border p-1" aria-label={`${copy.record.fieldWeight} ${ei + 1}.${si + 1}`} type="number" step="any" min={0} max={group.unit === 'kg' ? 500 : 1100} value={group.weight === null || !Number.isFinite(group.weight) ? '' : group.weight} onChange={e => edit(d => {const x = d.exercises[ei]; x.setGroups[si].weight = e.target.value === '' ? null : Number(e.target.value); normalizeGroupUnits(x, defaultUnit);})} />
        {!(isBodyweight(exercise) && group.weight === null) && <Inferred active={group.unitInferred}><select aria-label={`${copy.card.unit} ${ei + 1}.${si + 1}`} value={group.unit} onChange={e => edit(d => {const g = d.exercises[ei].setGroups[si]; g.unit = e.target.value as Unit; g.explicitUnit = g.unit; g.unitInferred = false;})}><option>kg</option><option>lb</option></select></Inferred>}
        × <input className="w-14 rounded border p-1" aria-label={`${copy.card.reps} ${ei + 1}.${si + 1}`} type="number" step={1} min={1} max={100} value={Number.isNaN(group.reps) ? '' : group.reps ?? ''} onChange={e => edit(d => {d.exercises[ei].setGroups[si].reps = numeric(e.target.value);})} />{copy.card.reps}
        × <input className="w-14 rounded border p-1" aria-label={`${copy.card.sets} ${ei + 1}.${si + 1}`} type="number" step={1} min={1} max={20} value={Number.isNaN(group.sets) ? '' : group.sets ?? ''} onChange={e => edit(d => {d.exercises[ei].setGroups[si].sets = numeric(e.target.value);})} />{copy.card.sets}
        <select aria-label={`${copy.card.setType} ${ei + 1}.${si + 1}`} value={group.setType} onChange={e => edit(d => {d.exercises[ei].setGroups[si].setType = e.target.value as SetType;})}>{[['working', copy.card.setTypeWorking], ['warmup', copy.card.setTypeWarmup], ['drop', copy.card.setTypeDrop]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </div>)}
    </section>)}
    {(editable || draft.notes !== null) && <label className="block">{copy.card.notes} {editable ? <input className="w-full rounded border p-1" aria-label={copy.card.notes} value={draft.notes ?? ''} onChange={e => edit(d => {d.notes = e.target.value || null;})} /> : draft.notes}</label>}
    </fieldset>
    {payload.skippedCardio.length > 0 && <p>{formatCopy(copy.card.skippedCardio, {items: payload.skippedCardio.join(', ')})}</p>}
    {editable ? <><p role={failure ? 'alert' : undefined} className="my-2 text-sm text-red-700">{failure ?? reason}</p><div className="flex justify-end gap-2"><button className="rounded border px-3 py-2" disabled={saving} onClick={() => {if (!lock.current && !savingCards.has(id)) onUpdate(id, {...payload, status: 'discarded'});}}>{copy.card.discard}</button><button className="rounded bg-navy px-3 py-2 text-white disabled:opacity-40" disabled={saving || !!reason} onClick={() => void save()}>{saving ? copy.card.saving : existing ? copy.card.addToSession : copy.card.save}</button></div></> : <p className="mt-3">{payload.status === 'saved' ? <><span>{copy.card.saved}</span> · <button className="underline" onClick={onHistory}>{copy.card.viewInHistory}</button></> : copy.card.discarded}</p>}
  </div>;
}




