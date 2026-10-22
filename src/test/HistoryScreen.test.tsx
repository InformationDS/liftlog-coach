import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { db } from '../core/db/schema';
import { sessionsRepo } from '../core/db/sessionsRepo';
import { HistoryScreen } from '../ui/history/HistoryScreen';
import { SettingsScreen } from '../ui/settings/SettingsScreen';
import { DEFAULT_SETTINGS, readSettings, writeSettings } from '../core/settings/settings';
import { NOW, session, group } from './cp3Fixtures';
import * as seed from '../core/db/seed';
beforeEach(async () => {
  vi.useFakeTimers({toFake: ['Date']}); vi.setSystemTime(NOW);
  await db.sessions.clear(); localStorage.clear();
  const a = session('2026-10-19'), b = session('2026-10-18');
  b.exercises[0].standardExerciseId = null; b.exercises[0].customName = 'Landmine press'; b.source = 'seed';
  await db.sessions.bulkAdd([a, b]);
});
afterEach(async () => { vi.restoreAllMocks(); vi.useRealTimers(); await db.sessions.clear(); });
async function openDelete() {
  fireEvent.click(await screen.findByRole('button', {name: /Mon 19 Oct/}));
  fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
  return screen.getByRole('dialog');
}
function cancel(mode: string) {
  if (mode === 'Cancel') fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name: 'Cancel'}));
  if (mode === 'Esc') fireEvent.keyDown(document, {key: 'Escape'});
  if (mode === 'backdrop') fireEvent.click(screen.getByTestId('dialog-backdrop'));
}
it.each(['Cancel', 'Esc', 'backdrop'])('History %s cancels without writes; opening is read-only', async mode => {
  const spy = vi.spyOn(sessionsRepo, 'deleteSession'); const initial = await sessionsRepo.list(); render(<HistoryScreen />);
  await openDelete(); expect(spy).not.toHaveBeenCalled(); expect(await sessionsRepo.list()).toEqual(initial);
  cancel(mode); expect(screen.queryByRole('dialog')).toBeNull(); expect(spy).not.toHaveBeenCalled(); expect(await sessionsRepo.list()).toEqual(initial);
});
it('History confirms exactly once, disables buttons while pending and only deletes selected day', async () => {
  const original = sessionsRepo.deleteSession;
  let release!: () => void; const pause = new Promise<void>(resolve => {release = resolve;});
  const spy = vi.spyOn(sessionsRepo, 'deleteSession').mockImplementation(async id => {await pause; await original(id);});
  render(<HistoryScreen />); const dialog = await openDelete(); const confirm = within(dialog).getByRole('button', {name: 'Delete'});
  fireEvent.click(confirm); fireEvent.click(confirm); expect(confirm.hasAttribute('disabled')).toBe(true); expect(spy).toHaveBeenCalledTimes(1);
  expect(await db.sessions.count()).toBe(2); release();
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect((await sessionsRepo.list()).map(s => s.date)).toEqual(['2026-10-18']);
  expect(screen.getByRole('status').textContent).toBe('Session deleted.');
});
it('History single expansion renders raw inputs, sample/custom, feeling, notes and all set types/bodyweight', async () => {
  const s = await sessionsRepo.getByDate('2026-10-19'); if (!s) throw new Error('fixture');
  s.feeling = 'good'; s.notes = 'note'; s.exercises[0].setGroups = [group(null), {...group(10), setType: 'warmup'}, {...group(0), setType: 'drop'}]; await db.sessions.put(s);
  render(<HistoryScreen />); fireEvent.click(await screen.findByRole('button', {name: /Mon 19 Oct/}));
  expect(screen.getByText('Logged from chat:')).toBeDefined(); expect(screen.getByText(/Bench 60kg/)).toBeDefined(); expect(screen.getByText('Feeling: Good')).toBeDefined(); expect(screen.getByText('Notes: note')).toBeDefined();
  expect(screen.getByText(/Bodyweight ×/)).toBeDefined(); expect(screen.getByText(/BW \+ 10 kg/)).toBeDefined(); expect(screen.getByText(/BW \+ 0 kg/)).toBeDefined();
  fireEvent.click(screen.getByRole('button', {name: /Sun 18 Oct/})); expect(screen.queryByText('Notes: note')).toBeNull(); expect(screen.getByText('custom')).toBeDefined(); expect(screen.getByText('sample')).toBeDefined();
});
it.each(['clear', 'load'] as const)('Settings %s opens read-only, all cancel modes preserve sessions and settings', async action => {
  writeSettings({...DEFAULT_SETTINGS, apiKey: 'fake-ui-test-value', defaultUnit: 'lb'});
  const initial = await sessionsRepo.list(), settings = readSettings();
  const clear = vi.spyOn(sessionsRepo, 'clearAll'), load = vi.spyOn(seed, 'loadSeed'); render(<SettingsScreen />);
  for (const mode of ['Cancel', 'Esc', 'backdrop']) {
    fireEvent.click(screen.getByRole('button', {name: action === 'clear' ? 'Clear all data' : 'Load sample data'}));
    await screen.findByRole('dialog'); expect(clear).not.toHaveBeenCalled(); expect(load).not.toHaveBeenCalled(); expect(await sessionsRepo.list()).toEqual(initial);
    cancel(mode); expect(screen.queryByRole('dialog')).toBeNull(); expect(await sessionsRepo.list()).toEqual(initial); expect(readSettings()).toEqual(settings);
  }
});
it.each(['clear', 'load'] as const)('Settings %s only writes once after confirmation, keeps settings/key', async action => {
  writeSettings({...DEFAULT_SETTINGS, apiKey: 'fake-ui-test-value', defaultUnit: 'lb'}); const settings = readSettings();
  let release!: () => void; const pause = new Promise<void>(resolve => {release = resolve;});
  const originalClear = sessionsRepo.clearAll, originalLoad = seed.loadSeed;
  const spy = action === 'clear' ? vi.spyOn(sessionsRepo, 'clearAll').mockImplementation(async () => {await pause; await originalClear();}) : vi.spyOn(seed, 'loadSeed').mockImplementation(async (database, now) => {await pause; await originalLoad(database, now);});
  render(<SettingsScreen />); fireEvent.click(screen.getByRole('button', {name: action === 'clear' ? 'Clear all data' : 'Load sample data'}));
  const dialog = await screen.findByRole('dialog'); const confirm = within(dialog).getByRole('button', {name: 'Continue'});
  expect(spy).not.toHaveBeenCalled(); fireEvent.click(confirm); fireEvent.click(confirm); expect(spy).toHaveBeenCalledTimes(1); expect(confirm.hasAttribute('disabled')).toBe(true);
  expect(await db.sessions.count()).toBe(2); release(); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  const sessions = await sessionsRepo.list(); expect(sessions).toHaveLength(action === 'clear' ? 0 : 27);
  if (action === 'load') expect(sessions.every(s => s.source === 'seed' && s.rawInputs.length === 0)).toBe(true);
  expect(readSettings()).toEqual(settings);
});
it('explicit sample load on empty database requires no replacement dialog', async () => {
  await db.sessions.clear(); const spy = vi.spyOn(seed, 'loadSeed'); render(<SettingsScreen />);
  fireEvent.click(screen.getByRole('button', {name: 'Load sample data'}));
  await waitFor(() => expect(spy).toHaveBeenCalledTimes(1)); await screen.findByText('Sample data loaded.');
  expect(screen.queryByRole('dialog')).toBeNull(); expect(await db.sessions.count()).toBe(27);
});
it('exports only training sessions, no settings, credentials, chats or logs', async () => {
  writeSettings({...DEFAULT_SETTINGS, apiKey: 'fake-ui-test-value'});
  let blob: Blob | undefined;
  Object.defineProperty(URL, 'createObjectURL', {configurable: true, value: vi.fn((value: Blob) => {blob = value; return 'blob:test';})});
  Object.defineProperty(URL, 'revokeObjectURL', {configurable: true, value: vi.fn()});
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  render(<SettingsScreen />); fireEvent.click(screen.getByRole('button', {name: 'Export data'}));
  await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
  const text = await new Promise<string>(resolve => {const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob!);});
  expect(JSON.parse(text)).toEqual(await sessionsRepo.list()); expect(text).not.toContain('fake-ui-test-value');
  for (const field of ['apiKey', 'apiBaseUrl', 'messages', 'aiCalls']) expect(text).not.toContain(`"${field}"`);
});
