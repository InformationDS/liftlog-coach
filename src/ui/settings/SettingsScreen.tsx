import { Toast } from '../shared/Toast';
import { useToast } from '../shared/useToast';
import { SettingsData } from './SettingsData';
import { useRef, useState } from 'react';
import { copy, formatCopy } from '../../core/copy';
import { createLlmClient, llmErrorText, scrubSecrets, type LlmClient } from '../../core/llm/client';
import { buildTestConnection } from '../../core/prompts/builder';
import { applyPreset, normalizeApiBaseUrl, PROVIDER_PRESETS, readSettings, writeSettings, type Settings } from '../../core/settings/settings';

export function SettingsScreen({ makeClient = createLlmClient }: { makeClient?: (settings: Settings) => LlmClient }) {
  const [settings, setSettings] = useState(readSettings);
  const {toast, setToast} = useToast();
  const [urlDraft, setUrlDraft] = useState(settings.apiBaseUrl);
  const [keyDraft, setKeyDraft] = useState(settings.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [result, setResult] = useState<{ok: boolean; text: string} | null>(null);
  const update = (next: Settings) => {
    setSettings(next); writeSettings(next); setResult(null);
  };
  const test = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setResult(null);
    const current = { ...settings, apiKey: keyDraft, apiBaseUrl: normalizeApiBaseUrl(settings.apiBaseUrl) };
    // A pointer click blurs the key field; explicitly commit for keyboard activation too.
    setSettings(current); setUrlDraft(current.apiBaseUrl); writeSettings(current);
    try {
      const response = await makeClient(current).call('test_connection', buildTestConnection());
      setResult(response.ok ? {ok: true, text: formatCopy(copy.settings.testOk, {
        model: scrubSecrets(current.model, current.apiKey), ms: Math.round(response.log?.latencyMs ?? 0),
      })} : {ok: false, text: formatCopy(copy.settings.testFail, {
        reason: `${llmErrorText(response.error)}${response.log?.error?.status ? ` (${response.log.error.status})` : ''}`,
      })});
    } finally { busyRef.current = false; setBusy(false); }
  };
  const field = 'mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-800 disabled:opacity-60';
  const button = 'rounded border border-slate-300 px-3 py-2 text-navy disabled:opacity-60';
  return <div className="space-y-5">
    <h2 className="text-base font-semibold text-navy">{copy.tabs.settings}</h2>
    <fieldset disabled={busy} className="space-y-4 rounded-lg border border-slate-200 p-4">
      <legend className="px-1 font-semibold text-navy">{copy.settings.groupModel}</legend>
      <div><div className="mb-2">{copy.settings.presets}</div>
        <div className="flex flex-wrap gap-2">{PROVIDER_PRESETS.map((preset) => <button className={button} key={preset.label} onClick={() => {setUrlDraft(preset.apiBaseUrl); update(applyPreset(settings, preset));}}>{preset.label}</button>)}</div>
      </div>
      <label className="block">{copy.settings.baseUrl}<input className={field} type="url" value={urlDraft} onChange={(event) => {setUrlDraft(event.target.value); update({...settings, apiBaseUrl: normalizeApiBaseUrl(event.target.value)});}} onBlur={() => setUrlDraft(normalizeApiBaseUrl(urlDraft))} /></label>
      <div><label className="block" htmlFor="api-key">{copy.settings.apiKey}</label>
        <div className="flex items-center gap-2"><input id="api-key" className={field} type={showKey ? 'text' : 'password'} value={keyDraft} autoComplete="off" spellCheck={false} onChange={(event) => {setKeyDraft(event.target.value); setResult(null);}} onBlur={() => update({...settings, apiKey: keyDraft})} />
          <button className={button} aria-pressed={showKey} onClick={() => setShowKey(!showKey)}>{showKey ? copy.settings.hide : copy.settings.show}</button></div>
        <p className="mt-2 text-xs text-slate-500">{copy.settings.keyNote}</p>
      </div>
      <label className="block">{copy.settings.model}<input className={field} value={settings.model} onChange={(event) => update({...settings, model: event.target.value})} /></label>
      <p className="text-xs text-slate-500">{copy.settings.modelNote}</p>
      <button className="rounded bg-navy px-4 py-2 text-white disabled:opacity-60" onClick={() => void test()}>{busy ? copy.settings.testing : copy.settings.test}</button>
      <div role="status" aria-live="polite" className={result?.ok ? 'text-emerald-700' : 'text-red-700'}>{result?.text}</div>
      <details><summary className="cursor-pointer text-navy">{copy.settings.geminiHelpTitle}</summary>
        <p className="mt-2 whitespace-pre-line text-xs leading-6">{copy.settings.geminiHelp.split('aistudio.google.com')[0]}<a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="underline">aistudio.google.com</a>{copy.settings.geminiHelp.split('aistudio.google.com')[1]}</p>
      </details>
    </fieldset>
    <fieldset className="rounded-lg border border-slate-200 p-4"><legend className="px-1 font-semibold text-navy">{copy.settings.groupPrefs}</legend>
      <div className="mb-2">{copy.settings.defaultUnit}</div><div className="flex gap-5">{(['kg', 'lb'] as const).map((unit) => <label key={unit} className="flex gap-2"><input type="radio" name="unit" checked={settings.defaultUnit === unit} onChange={() => update({...settings, defaultUnit: unit})} />{unit}</label>)}</div>
    </fieldset>
    <fieldset id="settings-rules" className="space-y-2 rounded-lg border border-slate-200 p-4"><legend className="px-1 font-semibold text-navy">{copy.settings.groupRules}</legend>
      <div>{copy.settings.ruleVersion}</div>{(['v2', 'v1'] as const).map(version => <label key={version} className="flex gap-2"><input type="radio" name="rules" checked={settings.ruleVersion === version} onChange={() => {
        update({...settings, ruleVersion: version}); setToast(formatCopy(copy.settings.ruleSwitched, {version}));
      }} />{version === 'v2' ? copy.settings.ruleV2 : copy.settings.ruleV1}</label>)}
    </fieldset>
    <Toast text={toast} />
    <SettingsData />
    <fieldset className="rounded-lg border border-slate-200 p-4"><legend className="px-1 font-semibold text-navy">{copy.settings.groupDev}</legend>
      <label className="flex items-center justify-between gap-3">{copy.settings.showDebug}<input type="checkbox" role="switch" checked={settings.showDebug} onChange={(event) => update({...settings, showDebug: event.target.checked})} /></label>
    </fieldset>
  </div>;
}

