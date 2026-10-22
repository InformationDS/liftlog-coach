import { DebugDetails } from './DebugDetails';
import { AdviceCard } from './messages/AdviceCard';
import { useEffect, useRef } from 'react';
import { copy } from '../../core/copy';
import type { ChatStoreApi } from '../../state/chatStore';
import { createChatActions } from '../../state/chatStore';
import { ConfirmCard } from './messages/ConfirmCard';
import { ClarificationMessage } from './messages/ClarificationMessage';
import { ErrorMessage } from './messages/ErrorMessage';
import { RefusalMessage } from './messages/RefusalMessage';
import { UserMessage } from './messages/UserMessage';
import { TextMessage } from './messages/TextMessage';
import { DayDetailCard } from './messages/DayDetailCard';
import { TrendCard } from './messages/TrendCard';
export function MessageList({store, actions, onHistory, defaultUnit, showDebug = false, apiKey = ''}: {store: ChatStoreApi; actions: ReturnType<typeof createChatActions>; onHistory: () => void; defaultUnit: 'kg' | 'lb'; showDebug?: boolean; apiKey?: string}) {
  const state = store(), end = useRef<HTMLDivElement>(null);
  useEffect(() => {end.current?.scrollIntoView?.({block: 'end'});}, [state.messages, state.busy]);
  return <div className="space-y-3" aria-live="polite">{state.messages.map(message => message.role === 'user' ? <UserMessage key={message.id} text={message.text} /> : <article className="break-words rounded border bg-white p-3" key={message.id} data-message-id={message.id}>
    {message.kind === 'text' && <TextMessage text={message.payload.text} />}
    {message.kind === 'day_detail' && <DayDetailCard session={message.payload.session} onHistory={onHistory} />}
    {message.kind === 'advice' && <AdviceCard payload={message.payload} />}
    {message.kind === 'trend' && <TrendCard payload={message.payload} />}
    {message.kind === 'refusal' && <RefusalMessage payload={message.payload} onHistory={onHistory} />}
    {message.kind === 'confirm_card' && <ConfirmCard id={message.id} payload={message.payload} onUpdate={state.updateCard} onHistory={onHistory} defaultUnit={defaultUnit} />}
    {message.kind === 'clarification' && <ClarificationMessage payload={message.payload} activeId={state.activeClarificationId} busy={state.busy} onChoose={actions.choose} />}
    {message.kind === 'error' && <ErrorMessage id={message.id} payload={message.payload} disabled={!actions.canRetry(message.id)} onRetry={actions.retry} />}
    {showDebug && <DebugDetails message={message} userText={state.messages.slice(0, state.messages.indexOf(message)).reverse().find(m => m.role === 'user')?.text ?? ''} apiKey={apiKey} />}
  </article>)}{state.busy && <p role="status">{copy.chat.thinking}</p>}<div ref={end} /></div>;
}
