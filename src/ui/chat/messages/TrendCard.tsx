import { useState } from 'react';
import { copy, fmtDate, fmtRange, formatCopy } from '../../../core/copy';
import type { TrendPayload } from '../../../core/pipeline/types';
import { LineChart, type ChartMode } from '../../shared/LineChart';
export function TrendCard({payload: p, now = new Date()}: {payload: TrendPayload; now?: Date}) {
  const [mode, setMode] = useState<ChartMode>('top');
  return <div className="space-y-3">
    <h3 className="font-semibold text-navy">{formatCopy(copy.trend.title, {exercise: p.exerciseLabel, range: p.rangeLabel})}</h3>
    {p.notEnoughData ? <><p>{formatCopy(copy.trend.notEnough, {n: p.points.length, exercise: p.exerciseLabel, period: p.periodLabel})}</p>
      <ul className="list-inside list-disc">{p.points.map(point => <li key={point.date}>{fmtDate(point.date, now)} — {point.topWeightDisplay}</li>)}</ul></> : <>
      <div className="flex gap-2">{(['top', 'volume'] as const).map(value => <button key={value} aria-pressed={mode === value} className={`rounded border px-3 py-1 ${mode === value ? 'bg-navy text-white' : ''}`} onClick={() => setMode(value)}>{value === 'top' ? copy.trend.modeTop : copy.trend.modeVolume}</button>)}</div>
      <LineChart points={p.points} exercise={p.exerciseLabel} mode={mode} now={now} />
    </>}
    {p.mixedUnits && <p className="text-xs text-slate-500">{copy.trend.mixedUnits}</p>}
    {p.excludesBodyweight && <p className="text-xs text-slate-500">{copy.query.weightedOnlyNote}</p>}
    {!p.notEnoughData && <div className="space-y-2 border-t pt-3">{p.interpretation && <><span className="inline-block rounded bg-copper px-2 py-1 text-xs font-medium uppercase text-white">{formatCopy(copy.badge.aiInterpretation, {n: p.points.length})}</span><p className="text-xs text-slate-500">{fmtRange(p.points[0].date, p.points.at(-1)!.date, now)}</p></>}
      <p>{p.interpretation ?? copy.trend.interpretationUnavailable}</p></div>}
  </div>;
}
