import { useEffect, useState } from 'react';
import { copy } from './core/copy';
import { readSettings } from './core/settings/settings';
import { ChatScreen } from './ui/chat/ChatScreen';
import { HistoryScreen } from './ui/history/HistoryScreen';
import { SettingsScreen } from './ui/settings/SettingsScreen';

const tabs = ['chat', 'history', 'settings'] as const;
type Tab = (typeof tabs)[number];

const screens = { chat: ChatScreen, history: HistoryScreen, settings: SettingsScreen };

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [version, setVersion] = useState(() => readSettings().ruleVersion);
  useEffect(() => {const sync = () => setVersion(readSettings().ruleVersion);
    window.addEventListener('liftlog-settings', sync); window.addEventListener('storage', sync);
    return () => {window.removeEventListener('liftlog-settings', sync); window.removeEventListener('storage', sync);};
  }, []);
  const Screen = screens[activeTab];

  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col bg-white shadow-sm">
      <header className="flex shrink-0 items-center justify-between gap-3 bg-navy px-5 py-4 text-white">
        <h1 className="text-base font-semibold">{copy.app.title}</h1>
        <button onClick={() => {setActiveTab('settings'); requestAnimationFrame(() => document.getElementById('settings-rules')?.scrollIntoView?.());}} className={`rounded ${version === 'v2' ? 'bg-copper' : 'bg-slate-600'} px-2 py-1 text-xs font-medium tracking-wide text-white`}>
          {copy.app.ruleBadge.replace('{version}', version)}
        </button>
      </header>
      <main
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="min-h-0 flex-1 overflow-y-auto p-5 focus-visible:outline-navy"
        tabIndex={0}
      >
        {activeTab === 'chat' ? <ChatScreen onHistory={() => setActiveTab('history')} onSettings={() => setActiveTab('settings')} /> : <Screen />}
      </main>
      <nav role="tablist" aria-label={copy.app.title} className="flex shrink-0 border-t border-slate-200 bg-white">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            id={`tab-${tab}`}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`panel-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)}
            onKeyDown={(event) => {
              let nextIndex: number;
              if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
              else if (event.key === 'ArrowLeft') nextIndex = (index + tabs.length - 1) % tabs.length;
              else if (event.key === 'Home') nextIndex = 0;
              else if (event.key === 'End') nextIndex = tabs.length - 1;
              else return;
              event.preventDefault();
              const nextTab = tabs[nextIndex];
              setActiveTab(nextTab);
              document.getElementById(`tab-${nextTab}`)?.focus();
            }}
            className={`flex-1 border-t-2 px-2 py-4 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-navy ${activeTab === tab ? 'border-copper text-copper' : 'border-transparent text-slate-500'}`}
          >
            {copy.tabs[tab]}
          </button>
        ))}
      </nav>
    </div>
  );
}
