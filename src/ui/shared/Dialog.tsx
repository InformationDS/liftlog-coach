import { useEffect, useRef } from 'react';
import { copy } from '../../core/copy';
export function Dialog({title, body, confirm, busy, onCancel, onConfirm}: {title: string; body: string; confirm: string; busy: boolean; onCancel: () => void; onConfirm: () => void}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {event.preventDefault(); if (!busy) onCancel();}
      if (event.key === 'Tab') {
        const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault(); buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => {document.removeEventListener('keydown', key); if (previous instanceof HTMLElement) previous.focus();};
  }, [busy, onCancel]);
  return <div data-testid="dialog-backdrop" className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-5" onClick={e => {if (e.target === e.currentTarget && !busy) onCancel();}}>
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-body" className="w-full max-w-sm space-y-4 rounded-lg bg-white p-5 shadow-xl">
      <h3 id="dialog-title" className="font-semibold text-navy">{title}</h3><p id="dialog-body">{body}</p>
      <div className="flex justify-end gap-3"><button disabled={busy} className="rounded border px-3 py-2" onClick={onCancel}>{copy.settings.cancel}</button><button disabled={busy} className="rounded bg-red-700 px-3 py-2 text-white disabled:opacity-50" onClick={onConfirm}>{confirm}</button></div>
    </div>
  </div>;
}
