import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SettingsScreen } from '../ui/settings/SettingsScreen';
import { createLlmClient } from '../core/llm/client';
import { DEFAULT_SETTINGS, readSettings, SETTINGS_KEY, writeSettings } from '../core/settings/settings';

beforeEach(() => localStorage.clear());
const key = 'sk-test-SECRET123';
it('retains CP2 settings and the official key guide alongside CP3 Data', () => {
  render(<SettingsScreen />);
  for (const label of ['AI model', 'Preferences', 'Developer', 'Data', 'Load sample data', 'Export data', 'Clear all data']) expect(screen.getByText(label)).toBeDefined();
  expect(screen.getByText('Rules')).toBeDefined();
  expect(screen.getByLabelText('API base URL').getAttribute('type')).toBe('url');
  expect(screen.getByRole('link', {name: 'aistudio.google.com'}).getAttribute('href')).toBe('https://aistudio.google.com');
});
it('saves non-key fields immediately, key only on blur, and shows/hides the key', () => {
  render(<SettingsScreen />);
  const input = screen.getByLabelText('API key');
  fireEvent.change(input, {target: {value: key}});
  expect(readSettings().apiKey).toBe('');
  fireEvent.click(screen.getByRole('button', {name: 'Show'})); expect(input.getAttribute('type')).toBe('text');
  fireEvent.click(screen.getByRole('button', {name: 'Hide'})); expect(input.getAttribute('type')).toBe('password');
  fireEvent.blur(input); expect(readSettings().apiKey).toBe(key);
  fireEvent.change(screen.getByLabelText('Model'), {target: {value: 'custom-model'}});
  fireEvent.change(screen.getByLabelText('API base URL'), {target: {value: ' https://example.test/v2/// '}});
  fireEvent.click(screen.getByLabelText('lb')); fireEvent.click(screen.getByRole('switch'));
  expect(readSettings()).toEqual({...DEFAULT_SETTINGS, apiKey: key, model: 'custom-model', apiBaseUrl: 'https://example.test/v2', defaultUnit: 'lb', showDebug: false});
});
it('retains persisted choices when the page is remounted, and presets preserve the key', () => {
  writeSettings({...DEFAULT_SETTINGS, apiKey: key, defaultUnit: 'lb', showDebug: false});
  const view = render(<SettingsScreen />);
  fireEvent.click(screen.getByRole('button', {name: 'Google Gemini'}));
  expect(readSettings()).toMatchObject({apiKey: key, model: 'gemini-2.5-flash', defaultUnit: 'lb', showDebug: false});
  view.unmount(); render(<SettingsScreen />);
  expect((screen.getByLabelText('Model') as HTMLInputElement).value).toBe('gemini-2.5-flash');
  expect((screen.getByLabelText('lb') as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole('switch') as HTMLInputElement).checked).toBe(false);
});
it('renders defaults for malformed browser configuration', () => {
  localStorage.setItem(SETTINGS_KEY, '{'); render(<SettingsScreen />);
  expect((screen.getByLabelText('Model') as HTMLInputElement).value).toBe(DEFAULT_SETTINGS.model);
});
it('allows typing URL slashes while persisting the normalized address', () => {
  render(<SettingsScreen />);
  const input = screen.getByLabelText('API base URL') as HTMLInputElement;
  for (const value of ['https:', 'https:/', 'https://', 'https://example.test/', 'https://example.test/v1/']) {
    fireEvent.change(input, {target: {value}}); expect(input.value).toBe(value);
  }
  expect(readSettings().apiBaseUrl).toBe('https://example.test/v1');
  fireEvent.blur(input); expect(input.value).toBe('https://example.test/v1');
});
it('displays success and disables duplicate testing while busy', async () => {
  let resolve!: (value: Response) => void;
  const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise((done) => {resolve = done;}));
  render(<SettingsScreen makeClient={(settings) => createLlmClient(settings, {fetch: fetcher, now: () => 5})} />);
  fireEvent.change(screen.getByLabelText('API key'), {target: {value: key}});
  fireEvent.click(screen.getByRole('button', {name: 'Test connection'}));
  const testing = screen.getByRole('button', {name: 'Testing…'}) as HTMLButtonElement;
  expect(testing.matches(':disabled')).toBe(true);
  fireEvent.click(testing); expect(fetcher).toHaveBeenCalledOnce();
  expect(readSettings().apiKey).toBe(key);
  resolve(new Response(JSON.stringify({choices: [{message: {content: 'OK'}}]})));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Connected · mimo-v2.6-flash · 0 ms'));
  expect(screen.getByRole('button', {name: 'Test connection'}).matches(':disabled')).toBe(false);
});
it.each([[401, 'Your API key was rejected. Check it in Settings.'], [404, "The model name wasn't found. Check it in Settings."], [429, 'The AI provider is rate-limiting requests. Wait a moment and try again.']])('shows fixed safe failure text and status %s', async (status, reason) => {
  writeSettings({...DEFAULT_SETTINGS, apiKey: key});
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({error: {message: `Incorrect API key: ${key} sk-test-****123`, code: 'invalid_api_key'}}), {status: Number(status)}));
  render(<SettingsScreen makeClient={(settings) => createLlmClient(settings, {fetch: fetcher})} />);
  fireEvent.click(screen.getByRole('button', {name: 'Test connection'}));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe(`Failed: ${reason} (${status})`));
  expect(screen.getByRole('status').textContent).not.toContain('sk-test');
});
it('shows a fixed network failure and clears the result when configuration changes', async () => {
  writeSettings({...DEFAULT_SETTINGS, apiKey: key});
  const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError(`network ${key}`));
  render(<SettingsScreen makeClient={(settings) => createLlmClient(settings, {fetch: fetcher})} />);
  fireEvent.click(screen.getByRole('button', {name: 'Test connection'}));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe("Failed: Couldn't reach the AI provider. Check your connection or API address."));
  fireEvent.click(screen.getByRole('button', {name: 'DeepSeek'})); expect(screen.getByRole('status').textContent).toBe('');
});
it('missing key fails locally with no fetch', async () => {
  const fetcher = vi.fn<typeof fetch>();
  render(<SettingsScreen makeClient={(settings) => createLlmClient(settings, {fetch: fetcher})} />);
  fireEvent.click(screen.getByRole('button', {name: 'Test connection'}));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Failed: Add your API key in Settings'));
  expect(fetcher).not.toHaveBeenCalled();
});

