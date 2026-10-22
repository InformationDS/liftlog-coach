import { z } from 'zod';

export const INITIAL_RULE_VERSION = 'v2' as const;
export const SETTINGS_KEY = 'liftlog.settings.v1';
export const PROVIDER_PRESETS = [
  { label: 'OpenAI', apiBaseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'Google Gemini', apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  { label: 'DeepSeek', apiBaseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
] as const;
export const normalizeApiBaseUrl = (value: string): string => value.trim().replace(/\/+$/, '');
const settingsSchema = z.object({
  apiBaseUrl: z.string().transform(normalizeApiBaseUrl), apiKey: z.string(), model: z.string(),
  defaultUnit: z.enum(['kg', 'lb']), ruleVersion: z.enum(['v1', 'v2']), showDebug: z.boolean(),
});
export type Settings = z.infer<typeof settingsSchema>;
// User-selected default after browser P6 verification on 2026-10-22; presets stay intact.
export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  apiBaseUrl: 'https://api.xiaomimo.com/v1', apiKey: '', model: 'mimo-v2.6-flash',
  defaultUnit: 'kg', ruleVersion: INITIAL_RULE_VERSION, showDebug: true,
});
export function readSettings(storage: Pick<Storage, 'getItem'> = localStorage): Settings {
  try {
    const raw: unknown = JSON.parse(storage.getItem(SETTINGS_KEY) ?? 'null');
    const parsed = settingsSchema.safeParse(raw);
    return parsed.success ? parsed.data : { ...DEFAULT_SETTINGS };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
export function writeSettings(settings: Settings, storage: Pick<Storage, 'setItem'> = localStorage): boolean {
  const parsed = settingsSchema.safeParse(settings);
  if (!parsed.success) return false;
  try { storage.setItem(SETTINGS_KEY, JSON.stringify(parsed.data));
    if (storage === localStorage) window.dispatchEvent(new Event('liftlog-settings'));
    return true; }
  catch { return false; }
}
export function applyPreset(settings: Settings, preset: typeof PROVIDER_PRESETS[number]): Settings {
  return { ...settings, apiBaseUrl: preset.apiBaseUrl, model: preset.model };
}
