import { useRef, useState } from 'react';
import { copy } from '../../core/copy';
import { db } from '../../core/db/schema';
import { sessionsRepo } from '../../core/db/sessionsRepo';
import { loadSeed } from '../../core/db/seed';
import { Dialog } from '../shared/Dialog';
import { Toast } from '../shared/Toast';
import { useToast } from '../shared/useToast';
export function SettingsData() {
  const [pending, setPending] = useState<'load' | 'clear' | null>(null);
  const [busy, setBusy] = useState(false), guard = useRef(false);
  const {toast, setToast} = useToast();
  const run = async (action: 'load' | 'clear' | 'export' | 'request-load') => {
    if (guard.current) return;
    guard.current = true; setBusy(true);
    try {
      if (action === 'request-load' && (await sessionsRepo.list()).length) {setPending('load'); return;}
      if (action === 'load' || action === 'request-load') {await loadSeed(db, new Date()); setToast(copy.settings.loadSampleDone);}
      else if (action === 'clear') {await sessionsRepo.clearAll(); setToast(copy.settings.cleared);}
      else {
        const sessions = await sessionsRepo.list();
        const url = URL.createObjectURL(new Blob([JSON.stringify(sessions, null, 2)], {type: 'application/json'}));
        const link = document.createElement('a'); link.href = url; link.download = 'liftlog-sessions.json'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setPending(null);
    } catch {setToast(copy.card.saveFailed);} finally {guard.current = false; setBusy(false);}
  };
  return <fieldset disabled={busy} className="space-y-3 rounded-lg border border-slate-200 p-4"><legend className="px-1 font-semibold text-navy">{copy.settings.groupData}</legend>
    <div><button className="rounded border px-3 py-2" onClick={() => void run('request-load')}>{copy.settings.loadSample}</button><p className="mt-1 text-xs text-slate-500">{copy.settings.loadSampleNote}</p></div>
    <div><button className="rounded border px-3 py-2" onClick={() => void run('export')}>{copy.settings.export}</button><p className="mt-1 text-xs text-slate-500">{copy.settings.exportNote}</p></div>
    <button className="rounded border border-red-200 px-3 py-2 text-red-700" onClick={() => setPending('clear')}>{copy.settings.clear}</button>
    {pending && <Dialog title={pending === 'load' ? copy.settings.loadSample : copy.settings.clear} body={pending === 'load' ? copy.settings.loadSampleConfirm : copy.settings.clearConfirm} confirm={copy.settings.continue} busy={busy} onCancel={() => setPending(null)} onConfirm={() => void run(pending)} />}
    <Toast text={toast} />
  </fieldset>;
}

