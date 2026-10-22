import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ConfirmCard } from '../ui/chat/messages/ConfirmCard';
import { buildDraft } from '../core/intents/record/buildDraft';
import { copy } from '../core/copy';
import type { ConfirmCardPayload, PendingResume } from '../core/pipeline/types';
import { NOW, exercise, harness, record, slots } from './cp4Fixtures';
import { querySlotsSchema } from '../core/llm/schemas';
import { db } from '../core/db/schema';
import { sessionsRepo } from '../core/db/sessionsRepo';
import { useChatStore } from '../state/chatStore';
import { ChatScreen } from '../ui/chat/ChatScreen';
afterEach(async () => {await db.sessions.clear(); useChatStore.setState({messages: [], pendingDraft: null, pendingResume: null, activeClarificationId: null, clarificationCount: 0, busy: false, usedRetries: []}); vi.useRealTimers();});
function mount(overrides: object = {}, unit: 'kg' | 'lb' = 'kg') {
  const h = harness();
  const payload: ConfirmCardPayload = {status: 'draft', draft: buildDraft(slots(overrides), ['Bench 60kg 3x8'], unit, NOW).draft, appendTo: null, skippedCardio: []};
  h.store.setState({messages: [{id: 'card', role: 'assistant', at: NOW.toISOString(), kind: 'confirm_card', payload, trace: {ruleVersion: 'v1', path: [], aiCalls: [], safetyRuleHit: null, dataSentToAi: null, postCheckFlags: [], totalLatencyMs: 0}}]});
  function Card() {const state = h.store(); const m = state.messages[0]; return m.role === 'assistant' && m.kind === 'confirm_card' ? <ConfirmCard id={m.id} payload={m.payload} onUpdate={state.updateCard} onHistory={() => {}} repo={h.repo} now={() => NOW} defaultUnit={unit} /> : null;}
  render(<Card />);
  const current = () => {const m = h.store.getState().messages[0]; if (m.role !== 'assistant' || m.kind !== 'confirm_card') throw Error(); return m.payload;};
  return {...h, current};
}
const saveButton = () => screen.getByRole('button', {name: /^(Save|Add to session)$/}) as HTMLButtonElement;
it('unselected ambiguous candidate blocks Save; local choice makes no model call', () => {
  const h = mount({exercises: [exercise('press')]}); expect(saveButton().disabled).toBe(true); expect(screen.getByText('Choose an exercise for: press')).toBeDefined(); fireEvent.click(screen.getByRole('button', {name: 'Overhead Press'})); expect(saveButton().disabled).toBe(false); expect(h.fetcher).not.toHaveBeenCalled();
});
it('editing inferred date/feeling/unit clears highlight only on modification', () => {
  mount({feeling: 'good', feeling_text: 'smashed it', exercises: [exercise('bench', {unit: null})]});
  for (const [label, value] of [[copy.card.date, '2026-10-19'], [copy.card.feeling, 'bad'], ['unit 1.1', 'lb']]) {
    const input = screen.getByLabelText(label); expect(input.closest('[data-inferred]')).not.toBeNull(); fireEvent.focus(input); expect(input.closest('[data-inferred]')).not.toBeNull(); fireEvent.change(input, {target: {value}}); expect(input.closest('[data-inferred]')).toBeNull();
  }
});
it.each([['weight 1.1', '501'], ['sets 1.1', '1.5'], ['sets 1.1', '21'], ['reps 1.1', '8.5'], ['reps 1.1', '101']])('shared validation disables for %s=%s and restores', (label, value) => {
  mount(); fireEvent.change(screen.getByLabelText(label), {target: {value}}); expect(saveButton().disabled).toBe(true); expect(screen.getByText(copy.card.fixValues)).toBeDefined(); fireEvent.change(screen.getByLabelText(label), {target: {value: label.startsWith('weight') ? '62.25' : '3'}}); expect(saveButton().disabled).toBe(false);
});
it('missing/invalid/nonfinite input is prevented by shared validation, zero remains valid', () => {
  mount(); fireEvent.change(screen.getByLabelText('weight 1.1'), {target: {value: ''}}); expect(saveButton().disabled).toBe(true); expect(screen.getByText(copy.card.fixMissing)).toBeDefined(); fireEvent.change(screen.getByLabelText('weight 1.1'), {target: {value: '0'}}); expect(saveButton().disabled).toBe(false);
});
it('unit edit applies corresponding limit immediately', () => {
  mount({exercises: [exercise('bench', {weight: 600, unit: 'lb'})]}); expect(saveButton().disabled).toBe(false); fireEvent.change(screen.getByLabelText('unit 1.1'), {target: {value: 'kg'}}); expect(saveButton().disabled).toBe(true);
});
it.each(['', '2026-10-21'])('date %s prevents Save; valid date restores', value => {
  mount(); fireEvent.change(screen.getByLabelText(copy.card.date), {target: {value}}); expect(saveButton().disabled).toBe(true); expect(screen.getByText(copy.card.fixDate)).toBeDefined(); fireEvent.change(screen.getByLabelText(copy.card.date), {target: {value: '2026-10-19'}}); expect(saveButton().disabled).toBe(false);
});
it('bodyweight hides unit; added weight restores inferred default; explicit selection survives clear/re-add', () => {
  const h = mount({exercises: [exercise('pull ups', {weight: null, unit: null})]}, 'lb'); expect(screen.queryByLabelText('unit 1.1')).toBeNull(); expect(screen.getByText(copy.card.bodyweight)).toBeDefined();
  fireEvent.change(screen.getByLabelText('weight 1.1'), {target: {value: '0'}}); let unit = screen.getByLabelText('unit 1.1'); expect((unit as HTMLSelectElement).value).toBe('lb'); expect(unit.closest('[data-inferred]')).not.toBeNull(); fireEvent.change(unit, {target: {value: 'kg'}});
  fireEvent.change(screen.getByLabelText('weight 1.1'), {target: {value: ''}}); expect(h.current().draft.exercises[0].setGroups[0]).toMatchObject({weight: null, unit: 'kg', explicitUnit: 'kg', unitInferred: false});
  fireEvent.change(screen.getByLabelText('weight 1.1'), {target: {value: '10'}}); unit = screen.getByLabelText('unit 1.1'); expect((unit as HTMLSelectElement).value).toBe('kg'); expect(unit.closest('[data-inferred]')).toBeNull();
});
it('original explicit lb returns after pure bodyweight with no inferred highlight', () => {mount({exercises: [exercise('pull ups', {weight: null, unit: 'lb'})]}); fireEvent.change(screen.getByLabelText('weight 1.1'), {target: {value: '10'}}); expect((screen.getByLabelText('unit 1.1') as HTMLSelectElement).value).toBe('lb'); expect(screen.getByLabelText('unit 1.1').closest('[data-inferred]')).toBeNull();});
it('change chosen bodyweight to custom/nonbodyweight applies missing-weight rule', () => {
  mount({exercises: [exercise('alien movement', {weight: 10})]}); fireEvent.click(screen.getByRole('button', {name: /Keep as custom/})); expect(saveButton().disabled).toBe(false); fireEvent.click(screen.getByRole('button', {name: 'Change'})); fireEvent.change(screen.getByLabelText(copy.card.selectFromList), {target: {value: 'ex_pull_up'}}); fireEvent.change(screen.getByLabelText('weight 1.1'), {target: {value: ''}}); expect(saveButton().disabled).toBe(false);
  fireEvent.click(screen.getByRole('button', {name: 'Change'})); fireEvent.click(screen.getByRole('button', {name: /Keep as custom/})); expect(saveButton().disabled).toBe(true); expect(screen.getByText(copy.card.fixMissing)).toBeDefined();
});
it('unmatched list grouped by body part and custom selection preserves display name', () => {const h = mount({exercises: [exercise('Zorgon lift')]}); expect(screen.getByText(copy.card.notInLibrary)).toBeDefined(); expect(screen.getByLabelText(copy.card.selectFromList).querySelectorAll('optgroup')).toHaveLength(8); expect(screen.getByLabelText(copy.card.selectFromList).querySelectorAll('option')).toHaveLength(36); fireEvent.click(screen.getByRole('button', {name: 'Keep as custom: Zorgon lift'})); expect(h.current().draft.exercises[0].chosen).toEqual({kind: 'custom', name: 'Zorgon lift'});});
it('remove affects only draft, final exercise remove is disabled', async () => {
  const h = mount({exercises: [exercise('bench'), exercise('squat')]}); fireEvent.click(screen.getByRole('button', {name: 'Remove from draft: bench'})); expect(h.current().draft.exercises).toHaveLength(1); expect((screen.getByRole('button', {name: 'Remove from draft: squat'}) as HTMLButtonElement).disabled).toBe(true); expect(await h.repo.list()).toEqual([]);
});
it('append notice/show/feeling replacement refreshes on date edit', async () => {
  const h = mount({feeling: 'bad'}); const d = structuredClone(h.current().draft); d.feeling = 'good'; await act(async () => {await h.repo.saveDraft(d, NOW);});
  expect(await screen.findByRole('button', {name: 'Add to session'})).toBeDefined(); expect(screen.getByText(/Will be added to your session/)).toBeDefined(); expect(screen.getByText('Feeling: good → bad (will replace)')).toBeDefined(); fireEvent.click(screen.getByText('Show')); expect(screen.getByText(/60 kg × 8 reps/)).toBeDefined();
  fireEvent.change(screen.getByLabelText(copy.card.date), {target: {value: '2026-10-19'}}); await waitFor(() => expect(screen.getByRole('button', {name: 'Save'})).toBeDefined()); expect(screen.queryByText(/Will be added/)).toBeNull();
});
it('Save writes final edits once, pending double click blocked, saved is read only', async () => {
  const h = mount(); const actual = h.repo.saveDraft; let release!: () => void; const pause = new Promise<void>(r => {release = r;});
  const spy = vi.spyOn(h.repo, 'saveDraft').mockImplementation(async (...args) => {await pause; return actual(...args);});
  fireEvent.change(screen.getByLabelText('weight 1.1'), {target: {value: '62.25'}}); fireEvent.change(screen.getByLabelText('unit 1.1'), {target: {value: 'lb'}});
  expect(await h.repo.list()).toEqual([]); fireEvent.click(saveButton()); fireEvent.click(screen.getByRole('button', {name: 'Saving…'})); expect(spy).toHaveBeenCalledTimes(1);
  await act(async () => release()); await screen.findByText('Saved ✓'); expect(screen.queryByRole('button', {name: 'Save'})).toBeNull(); expect(screen.queryByLabelText('weight 1.1')).toBeNull();
  const all = await h.repo.list(); expect(all).toHaveLength(1); expect(all[0].exercises[0].setGroups[0]).toMatchObject({weight: 62.25, unit: 'lb'});
});
it('save I/O failure keeps editable card; write-boundary validation displays its reason', async () => {
  const h = mount(); vi.spyOn(h.repo, 'saveDraft').mockResolvedValueOnce({ok: false, issues: [], error: 'io'}).mockResolvedValueOnce({ok: false, issues: [{code: 'value', exerciseIndex: 0, setGroupIndex: 0, field: 'weight'}]});
  fireEvent.click(saveButton()); await screen.findByText(copy.card.saveFailed); fireEvent.click(saveButton()); await screen.findByText(copy.card.fixValues); expect(h.current().status).toBe('draft'); expect(await h.repo.list()).toEqual([]);
});
it.each(['Save', 'Discard'])('old card %s preserves subsequent incomplete record, later continuation contains only B', async operation => {
  const h = mount(); h.queue.push(record({exercises: [exercise('squat', {sets: null, reps: null})]}), record({draft_action: 'continue', exercises: [exercise('squat', {sets: 5, reps: 5})]}));
  await act(async () => {await h.actions.send('B squat 60kg');});
  const snapshot = structuredClone({pendingDraft: h.store.getState().pendingDraft, pendingResume: h.store.getState().pendingResume, clarificationCount: h.store.getState().clarificationCount, activeClarificationId: h.store.getState().activeClarificationId});
  fireEvent.change(screen.getByLabelText('weight 1.1'), {target: {value: '62.5'}}); fireEvent.click(screen.getByRole('button', {name: operation})); await screen.findByText(operation === 'Save' ? 'Saved ✓' : 'Discarded');
  for (const key of ['pendingDraft', 'pendingResume', 'clarificationCount', 'activeClarificationId'] as const) expect(h.store.getState()[key]).toEqual(snapshot[key]);
  expect(await h.repo.list()).toHaveLength(operation === 'Save' ? 1 : 0); if (operation === 'Save') expect((await h.repo.list())[0].exercises[0].setGroups[0].weight).toBe(62.5);
  await act(async () => {await h.actions.send('5x5');}); const last = h.store.getState().messages.at(-1); expect(last).toMatchObject({kind: 'confirm_card', payload: {draft: {rawText: 'B squat 60kg / 5x5'}}}); expect(await h.repo.list()).toHaveLength(operation === 'Save' ? 1 : 0);
});
it.each(['Save', 'Discard'])('old card %s leaves nonempty pendingResume and instance untouched', async operation => {
  const h = mount(); const pending: PendingResume = {clarificationId: 'later', intent: 'query_training', missing: 'exercise', originalUserText: 'original', slots: querySlotsSchema.parse({query_type: 'exercise_best'}), createdAt: NOW.toISOString()};
  act(() => h.store.setState({pendingResume: pending, activeClarificationId: 'later'})); fireEvent.click(screen.getByRole('button', {name: operation})); await screen.findByText(operation === 'Save' ? 'Saved ✓' : 'Discarded'); expect(h.store.getState().pendingResume).toEqual(pending); expect(h.store.getState().activeClarificationId).toBe('later');
});
it('full timeout/retry combination: save button alone writes one expected record', async () => {
  vi.useFakeTimers({toFake: ['Date']}); vi.setSystemTime(NOW);
  const h = harness([record({exercises: [exercise('bench', {sets: null, reps: null})]}), record({draft_action: 'continue'})]);
  // Real Chat and real repo, only client transport is substituted.
  const llm = h.llm; const client = await import('../core/llm/client'); vi.spyOn(client, 'createLlmClient').mockReturnValue(llm);
  localStorage.setItem('liftlog.settings.v1', JSON.stringify(h.settings)); render(<ChatScreen />);
  const input = screen.getByRole('textbox', {name: copy.composer.placeholder});
  fireEvent.change(input, {target: {value: 'Bench 60kg'}}); fireEvent.click(screen.getByRole('button', {name: 'Send'})); await screen.findByText(/A few details are missing/, {selector: 'p'});
  const snapshot = structuredClone(useChatStore.getState().pendingDraft);
  vi.spyOn(llm, 'call').mockResolvedValueOnce({ok: false, error: 'timeout', log: null, logs: []});
  fireEvent.change(input, {target: {value: '3x8'}}); fireEvent.keyDown(input, {key: 'Enter'}); await screen.findByText(copy.error.timeout); expect(useChatStore.getState().pendingDraft).toEqual(snapshot); expect(useChatStore.getState().clarificationCount).toBe(1);
  fireEvent.click(screen.getByRole('button', {name: 'Try again'})); await screen.findByText('Bench 60kg / 3x8'); expect(await sessionsRepo.list()).toEqual([]); expect(useChatStore.getState().clarificationCount).toBe(0);
  const spy = vi.spyOn(sessionsRepo, 'saveDraft'); fireEvent.click(screen.getByRole('button', {name: 'Save'})); await screen.findByText('Saved ✓'); expect(spy).toHaveBeenCalledTimes(1); const all = await sessionsRepo.list(); expect(all).toHaveLength(1); expect(all[0].rawInputs.map(x => x.text)).toEqual(['Bench 60kg / 3x8']); expect(all[0].exercises[0].setGroups[0]).toMatchObject({weight: 60, sets: 3, reps: 8});
  expect((screen.getByRole('button', {name: 'Try again'}) as HTMLButtonElement).disabled).toBe(true); localStorage.clear();
});
it('Discard remains safe after date is cleared; no writes', async () => {
  const h = mount(); fireEvent.change(screen.getByLabelText(copy.card.date), {target: {value: ''}}); fireEvent.click(screen.getByRole('button', {name: 'Discard'})); expect(screen.getByText('Discarded')).toBeDefined(); expect(await h.repo.list()).toEqual([]);
});

it.each([NaN, Infinity, -Infinity])('nonfinite final weight %s cannot pass UI or save boundary', async weight => {
  const h = mount(); act(() => {const p = structuredClone(h.current()); p.draft.exercises[0].setGroups[0].weight = weight; h.store.getState().updateCard('card', p);});
  expect(saveButton().disabled).toBe(true); expect(screen.getByText(copy.card.fixValues)).toBeDefined(); expect(await h.repo.list()).toEqual([]);
});
