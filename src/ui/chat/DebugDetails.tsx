import { useEffect, useRef, useState } from 'react';
import { copy, formatCopy } from '../../core/copy';
import type { AssistantMessage } from '../../core/pipeline/types';
import { fullTraceJson, safeTrace, testLogRow } from '../../core/trace/export';

export function DebugDetails({message, userText, apiKey}: {message: AssistantMessage; userText: string; apiKey: string}) {
  const trace = safeTrace(message.trace, apiKey);
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function clipboard(id: string, text: string) {
    try {await navigator.clipboard.writeText(text); clearTimeout(timer.current); setCopied(id);
      timer.current = setTimeout(() => setCopied(null), 1500);
    } catch {setCopied(null);}
  }
  const button = (id: string, label: string, text: string) => <button className="rounded border px-2 py-1" onClick={() => void clipboard(id, text)}>{copied === id ? copy.debug.copied : label}</button>;
  const pre = (text: string) => <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">{text}</pre>;
  return <details className="mt-3 min-w-0 text-xs text-slate-500"><summary className="cursor-pointer">{copy.debug.toggle}</summary>
    <div className="mt-2 min-w-0 space-y-2 rounded border bg-slate-50 p-2">
      <dl className="space-y-1">{[
        [copy.debug.ruleVersion, trace.ruleVersion], [copy.debug.path, trace.path.join(' → ')],
        [copy.debug.safetyRule, trace.safetyRuleHit ?? copy.debug.none],
        [copy.debug.aiCalls, `${trace.aiCalls.length} (${trace.aiCalls.map(c => `${c.purpose} ${Math.round(c.latencyMs)} ms`).join(', ')})`],
        [copy.debug.dataSent, trace.dataSentToAi ?? copy.debug.none], [copy.debug.totalTime, `${Math.round(trace.totalLatencyMs)} ms`],
      ].map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd className="whitespace-pre-wrap break-all">{value}</dd></div>)}
        <dt className="font-semibold">{copy.debug.postCheck}</dt><dd>{trace.postCheckFlags.length ? trace.postCheckFlags.map((flag, i) => <p className="text-red-700" key={i}>{flag}</p>) : copy.debug.none}</dd>
      </dl>
      {trace.aiCalls.map((call, i) => <div key={i} className="space-y-1">
        <details><summary>{formatCopy(copy.debug.rawOutput, {purpose: call.purpose})}</summary>
          {pre(JSON.stringify({...call, request: undefined}, null, 2))}{button(`raw-${i}`, copy.debug.copy, call.rawResponse ?? JSON.stringify(call.error))}
        </details>
        <details><summary>{formatCopy(copy.debug.request, {purpose: call.purpose})}</summary>
          {pre(JSON.stringify(call.request.messages, null, 2))}{button(`request-${i}`, copy.debug.copy, JSON.stringify(call.request.messages, null, 2))}
        </details>
      </div>)}
      <div className="flex flex-wrap gap-2">{button('row', copy.debug.copyRow, testLogRow(userText, message, apiKey))}
        {button('trace', copy.debug.copyTrace, fullTraceJson(trace, apiKey))}</div>
    </div>
  </details>;
}
