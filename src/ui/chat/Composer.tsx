import { useLayoutEffect, useRef, useState } from 'react';
import { copy } from '../../core/copy';
export function Composer({busy, pending, onSend}: {busy: boolean; pending: boolean; onSend: (text: string) => Promise<void>}) {
  const [text, setText] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const resize = () => {
      const element = field.current;
      if (!element) return;
      element.style.height = 'auto';
      element.style.height = `${Math.min(114, Math.max(42, element.scrollHeight + 2))}px`;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [text]);
  const send = () => {if (!busy && text.trim()) {const value = text; setText(''); void onSend(value);}};
  return <div className="sticky bottom-0 border-t bg-white py-3"><div className="flex items-end gap-2">
    <textarea ref={field} aria-label={copy.composer.placeholder} className="min-w-0 flex-1 resize-none rounded border p-2 leading-6" rows={1} maxLength={500} disabled={busy} placeholder={pending ? copy.composer.placeholderPending : copy.composer.placeholder} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => {if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {e.preventDefault(); send();}}} />
    <button className="rounded bg-navy p-2 text-white disabled:opacity-40" disabled={busy || !text.trim()} onClick={send}>{copy.composer.send}</button>
    </div><small>{text.length}/500</small></div>;
}
