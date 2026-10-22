import { copy } from '../../../core/copy';
import type { ErrorPayload } from '../../../core/pipeline/types';
import { llmErrorText } from '../../../core/llm/client';
export function ErrorMessage({id, payload, disabled, onRetry}: {id: string; payload: ErrorPayload; disabled: boolean; onRetry: (id: string) => Promise<void>}) {
  return <div className="border-l-4 border-red-500 pl-3"><p>{llmErrorText(payload.error)}</p><button className="mt-2 rounded border px-3 py-2 disabled:opacity-40" disabled={disabled} onClick={() => void onRetry(id)}>{copy.error.tryAgain}</button></div>;
}
