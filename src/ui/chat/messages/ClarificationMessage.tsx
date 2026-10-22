import { useState } from 'react';
import type { ClarificationPayload } from '../../../core/pipeline/types';
export function ClarificationMessage({payload, activeId, busy, onChoose}: {payload: ClarificationPayload; activeId: string | null; busy: boolean; onChoose: (id: string, action: ClarificationPayload['options'][number]['action']) => Promise<void>}) {
  const [selected, setSelected] = useState<number | null>(null);
  return <><p className="whitespace-pre-line">{payload.question}</p><div className="mt-2 flex flex-wrap gap-2">{payload.options.map((option, i) => <button className={`rounded border px-3 py-2 disabled:opacity-40 ${busy && selected === i ? 'border-navy' : ''}`} key={i} disabled={busy || activeId !== payload.clarificationId} onClick={() => {setSelected(i); void onChoose(payload.clarificationId, option.action);}}>{option.label}</button>)}</div></>;
}
