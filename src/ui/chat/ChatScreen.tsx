import { copy } from '../../core/copy';
import { readSettings } from '../../core/settings/settings';
import { chatActions, useChatStore } from '../../state/chatStore';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
export function ChatScreen({onHistory = () => {}, onSettings = () => {}}: {onHistory?: () => void; onSettings?: () => void}) {
  const state = useChatStore();
  const settings = readSettings();
  return <div className="flex h-full min-h-0 flex-col"><div className="min-h-0 flex-1 overflow-y-auto"><h2 className="mb-3 text-base font-semibold text-navy">{copy.tabs.chat}</h2>
    {!settings.apiKey.trim() && <button className="mb-3 rounded bg-amber-50 p-2 text-left text-sm" onClick={onSettings}>{copy.app.noKeyBanner}</button>}
    <div className="mb-4 rounded bg-slate-50 p-3"><p className="whitespace-pre-line">{copy.chat.welcome}</p><div className="mt-2 flex flex-wrap gap-2">{copy.chat.welcomeExamples.map(text => <button className="rounded border p-2 text-left text-sm" key={text} disabled={state.busy} onClick={() => void chatActions.send(text)}>{text}</button>)}</div></div>
    <MessageList store={useChatStore} actions={chatActions} onHistory={onHistory} defaultUnit={settings.defaultUnit} showDebug={settings.showDebug} apiKey={settings.apiKey} />
    </div>
    <Composer busy={state.busy} pending={!!state.pendingDraft} onSend={chatActions.send} />
  </div>;
}
