import { copy } from '../../../core/copy';
import type { RefusalPayload } from '../../../core/pipeline/types';
export function RefusalMessage({payload, onHistory}: {payload: RefusalPayload; onHistory: () => void}) {
  return <><span className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">{payload.label}</span><p className="mt-2">{payload.text}</p>{payload.openHistory && <button className="mt-2 underline" onClick={onHistory}>{copy.refusal.openHistory}</button>}</>;
}
