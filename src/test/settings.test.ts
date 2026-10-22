import { beforeEach, expect, it, vi } from 'vitest';
import { applyPreset, DEFAULT_SETTINGS, normalizeApiBaseUrl, PROVIDER_PRESETS, readSettings, SETTINGS_KEY, writeSettings } from '../core/settings/settings';

beforeEach(() => localStorage.clear());
it('uses the user-verified MiMo default and retains the exact documented provider presets', () => {
  expect(readSettings()).toEqual({apiBaseUrl: 'https://api.xiaomimo.com/v1', apiKey: '', model: 'mimo-v2.6-flash', defaultUnit: 'kg', ruleVersion: 'v2', showDebug: true});
  expect(PROVIDER_PRESETS).toEqual([
    {label: 'OpenAI', apiBaseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini'},
    {label: 'Google Gemini', apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash'},
    {label: 'DeepSeek', apiBaseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat'},
  ]);
});
it('persists validated settings at the specified key, strips unknown fields and trailing slashes', () => {
  const settings = {...DEFAULT_SETTINGS, apiBaseUrl: ' https://example.test/v1/// ', apiKey: 'fixture-only', defaultUnit: 'lb' as const, showDebug: false};
  expect(writeSettings(settings)).toBe(true);
  expect(readSettings()).toEqual({...settings, apiBaseUrl: 'https://example.test/v1'});
  expect(localStorage.length).toBe(1);
  expect(localStorage.getItem(SETTINGS_KEY)).not.toBeNull();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({...settings, untrusted: 'ignored'}));
  expect(readSettings()).not.toHaveProperty('untrusted');
});
it.each(['{', 'null', '[]', '{}', '"bad"'])('falls back on damaged configuration %s', (raw) => {
  localStorage.setItem(SETTINGS_KEY, raw); expect(readSettings()).toEqual(DEFAULT_SETTINGS);
});
it.each([
  {apiBaseUrl: 1}, {apiKey: null}, {model: false}, {defaultUnit: 'oz'}, {ruleVersion: 'v3'}, {showDebug: 'yes'},
])('validates every field: %j', (patch) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({...DEFAULT_SETTINGS, ...patch}));
  expect(readSettings()).toEqual(DEFAULT_SETTINGS);
  expect(writeSettings({...DEFAULT_SETTINGS, ...patch} as typeof DEFAULT_SETTINGS)).toBe(false);
});
it('handles unavailable browser storage without throwing or exposing configuration', () => {
  const getItem = vi.fn(() => {throw new Error('denied');});
  const setItem = vi.fn(() => {throw new Error('quota');});
  expect(readSettings({getItem})).toEqual(DEFAULT_SETTINGS);
  expect(writeSettings({...DEFAULT_SETTINGS}, {setItem})).toBe(false);
});
it.each(PROVIDER_PRESETS)('preset $label changes only address and model', (preset) => {
  const original = {...DEFAULT_SETTINGS, apiKey: 'fixture-only', defaultUnit: 'lb' as const, ruleVersion: 'v1' as const, showDebug: false};
  expect(applyPreset(original, preset)).toEqual({...original, apiBaseUrl: preset.apiBaseUrl, model: preset.model});
  expect(original.apiBaseUrl).toBe(DEFAULT_SETTINGS.apiBaseUrl);
});
it('normalizes address whitespace and trailing slashes without appending or changing paths', () => {
  expect(normalizeApiBaseUrl(' https://example.test/custom/v2/// ')).toBe('https://example.test/custom/v2');
  expect(normalizeApiBaseUrl('')).toBe('');
});
