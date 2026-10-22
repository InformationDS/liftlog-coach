import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {DebugDetails} from '../ui/chat/DebugDetails';
import {MessageList} from '../ui/chat/MessageList';
import {createTrace} from '../core/trace/trace';
import {fullTraceJson,testLogRow} from '../core/trace/export';
import {harness,record,classified,exercise,NOW} from './cp4Fixtures';
import {ConfirmCard} from '../ui/chat/messages/ConfirmCard';
import {createChatActions,useChatStore,initialChat} from '../state/chatStore';
import {readSettings,writeSettings,DEFAULT_SETTINGS,SETTINGS_KEY} from '../core/settings/settings';
import App from '../App';
import type {AssistantMessage} from '../core/pipeline/types';
const key='sk-test-SECRET123';
const message=():Extract<AssistantMessage,{kind:'text'}>=>({id:'fixture',role:'assistant',at:NOW.toISOString(),kind:'text',payload:{text:`${key} first | line\n${'long '.repeat(45)}`},trace:{...createTrace(key,()=>5,'v2').finish(),path:['safety_regex: miss','risk_check: none (0.9)'],dataSentToAi:key,postCheckFlags:[key,'flag']}});
beforeEach(()=>{localStorage.clear();useChatStore.setState({...initialChat(),usedRetries:[]});});
afterEach(()=>vi.useRealTimers());
it('test row exact six columns, 120 char summary, spaces, escaped pipes and generation version',()=>{
  const m=message();const row=testLogRow(`  input | text\n\t${key}`,m,key);
  expect(row).toBe(`|  | input \\| text [redacted] |  |  | ${m.payload.text.replace(key,'[redacted]').replace(/\s+/g,' ').trim().slice(0,120).replace(/\|/g,'\\|')} · path: safety_regex: miss → risk_check: none (0.9) · AI calls: 0 · rules v2 |  |`);
  expect(row).not.toContain(key);expect(row).not.toMatch(/[\n\r\t]/);expect(row.split(/(?<!\\)\|/)).toHaveLength(8);
  expect(JSON.parse(fullTraceJson(m.trace,key))).toMatchObject({ruleVersion:'v2',dataSentToAi:'[redacted]',postCheckFlags:['[redacted]','flag']});
});
it('copies full trace / row / per-call outputs with 1.5 second confirmation and re-scrubs',async()=>{
  vi.useFakeTimers();const writeText=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
  const m=message();render(<DebugDetails message={m} userText={`user ${key}`} apiKey={key} />);
  fireEvent.click(screen.getByText('Details'));expect(screen.getByText('v2')).toBeDefined();expect(screen.getByText('flag')).toBeDefined();
  fireEvent.click(screen.getByText('Copy full trace JSON'));await act(async()=>{});expect(writeText).toHaveBeenLastCalledWith(fullTraceJson(m.trace,key));expect(screen.getByText('Copied ✓')).toBeDefined();
  act(()=>{vi.advanceTimersByTime(1500);});expect(screen.queryByText('Copied ✓')).toBeNull();fireEvent.click(screen.getByText('Copy as test log row'));await act(async()=>{});expect(writeText).toHaveBeenLastCalledWith(testLogRow(`user ${key}`,m,key));expect(document.body.textContent).not.toContain(key);
});
it('disabled debug omits whole component; each message uses its own trace without duplicate calls',async()=>{
  const h=harness([record(),record()]);await h.actions.send('first');await h.actions.send('second');
  const props={store:h.store,actions:createChatActions(h.store),onHistory:()=>{},defaultUnit:'kg' as const,apiKey:h.settings.apiKey};
  const view=render(<MessageList {...props} showDebug={false} />);expect(screen.queryByText('Details')).toBeNull();expect(view.container.querySelector('pre')).toBeNull();
  view.rerender(<MessageList {...props} showDebug />);expect(screen.getAllByText('Details')).toHaveLength(2);expect(screen.getAllByText('1 (classify 0 ms)')).toHaveLength(2);await h.database.delete();
});
it('per-call request/raw copy use their own scrubbed log and safe error metadata',async()=>{
  const h=harness([record()]);await h.actions.send('Bench 60kg 3x8');const m=h.store.getState().messages.at(-1);if(m?.role!=='assistant')throw Error('assistant');
  const writeText=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
  render(<DebugDetails message={m} userText="Bench" apiKey={h.settings.apiKey}/>);
  const raw=screen.getByText('classify · raw output').parentElement!;const request=screen.getByText('classify · request').parentElement!;
  fireEvent.click(raw.querySelector('button')!);await waitFor(()=>expect(writeText).toHaveBeenCalledWith(m.trace.aiCalls[0].rawResponse));
  fireEvent.click(request.querySelector('button')!);await waitFor(()=>expect(writeText).toHaveBeenLastCalledWith(JSON.stringify(m.trace.aiCalls[0].request.messages,null,2)));
  expect(request.querySelector('pre')?.textContent).not.toContain('Authorization');await h.database.delete();
});
it('v2 custom card saves only on UI confirmation, then query reads exact custom without writes',async()=>{
  const pass={risk:'none',confidence:0.9};const h=harness([pass,record({exercises:[exercise('Lat pulldown V2',{weight:20})]}),pass,classified('query_training',{query_type:'exercise_last',exercise_raw_name:' lat pulldown v2 '})]);Object.assign(h.settings,{ruleVersion:'v2'});
  await h.actions.send('Lat pulldown V2 20kg 3x8');expect(await h.repo.list()).toEqual([]);const card=h.store.getState().messages.at(-1);if(card?.role!=='assistant'||card.kind!=='confirm_card')throw Error('card');
  function Card(){const state=h.store();const m=state.messages.find(m=>m.id===card?.id);return m?.role==='assistant'&&m.kind==='confirm_card'?<ConfirmCard id={m.id} payload={m.payload} onUpdate={state.updateCard} onHistory={()=>{}} repo={h.repo} now={()=>NOW} defaultUnit="kg"/>:null;}
  render(<Card/>);fireEvent.click(screen.getByRole('button',{name:'Keep as custom: Lat pulldown V2'}));expect(await h.repo.list()).toEqual([]);expect(h.fetcher).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button',{name:'Save'}));await screen.findByText('Saved ✓');const saved=await h.repo.list();expect(saved).toHaveLength(1);expect(saved[0].exercises[0]).toMatchObject({standardExerciseId:null,customName:'Lat pulldown V2'});
  await act(async()=>h.actions.send('When did I last do Lat pulldown V2?'));const reply=h.store.getState().messages.at(-1);expect(reply).toMatchObject({kind:'text',trace:{ruleVersion:'v2'}});expect(h.fetcher).toHaveBeenCalledTimes(4);expect(await h.repo.list()).toEqual(saved);await h.database.delete();
});
it('version switch updates badge/toast/persistence, retains all context and historical traces',async()=>{
  writeSettings({...DEFAULT_SETTINGS,apiKey:key,ruleVersion:'v1',defaultUnit:'lb'});
  const h=harness([record({exercises:[]})]);await h.actions.send('pending');const state=h.store.getState();useChatStore.setState(state);
  const before=structuredClone({messages:state.messages,pendingDraft:state.pendingDraft,pendingResume:state.pendingResume,clarificationCount:state.clarificationCount,activeClarificationId:state.activeClarificationId});
  render(<App />);fireEvent.click(screen.getByRole('button',{name:'Rules v1'}));fireEvent.click(screen.getByLabelText('v2 — Safety regex + AI risk check (redesigned)'));
  expect(screen.getByRole('button',{name:'Rules v2'})).toBeDefined();expect(screen.getByText('Now using rules v2.')).toBeDefined();expect(readSettings()).toMatchObject({ruleVersion:'v2',apiKey:key,defaultUnit:'lb'});
  const current=useChatStore.getState();expect({messages:current.messages,pendingDraft:current.pendingDraft,pendingResume:current.pendingResume,clarificationCount:current.clarificationCount,activeClarificationId:current.activeClarificationId}).toEqual(before);
  fireEvent.click(screen.getByRole('tab',{name:'Chat'}));expect(screen.getAllByText('v1')).toHaveLength(1);
  fireEvent.click(screen.getByRole('tab',{name:'Settings'}));expect((screen.getByLabelText('v2 — Safety regex + AI risk check (redesigned)') as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole('switch'));fireEvent.click(screen.getByRole('tab',{name:'Chat'}));expect(screen.queryByText('Details')).toBeNull();const old=current.messages.at(-1);expect(old?.role==='assistant'&&old.trace.ruleVersion).toBe('v1');await h.database.delete();
});
it.each([null,'{','{}'])('new or corrupt settings %s use v2 while valid v1 survives remount',raw=>{
  if(raw!==null)localStorage.setItem(SETTINGS_KEY,raw);expect(readSettings().ruleVersion).toBe('v2');writeSettings({...DEFAULT_SETTINGS,ruleVersion:'v1'});expect(readSettings().ruleVersion).toBe('v1');
});
it('clipboard refusal never announces success',async()=>{
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockRejectedValue(new Error('denied'))}});render(<DebugDetails message={message()} userText="input" apiKey={key}/>);fireEvent.click(screen.getByText('Copy full trace JSON'));await waitFor(()=>expect(screen.queryByText('Copied ✓')).toBeNull());
});
