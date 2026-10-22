import { copy, fmtDate, formatCopy } from '../../core/copy';
import { localDate } from '../../core/time/resolve';
import type { TrendPayload } from '../../core/pipeline/types';
export type ChartMode = 'top' | 'volume';
export function LineChart({points, exercise, mode, now}: {points: TrendPayload['points']; exercise: string; mode: ChartMode; now: Date}) {
  const values = points.map(p => mode === 'top' ? p.topWeightKg : p.volumeKg);
  const times = points.map(p => localDate(p.date).getTime());
  if (!values.length || values.some(v => !Number.isFinite(v) || v < 0) || times.some(t => !Number.isFinite(t))) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const low = min * 0.95, high = max === 0 ? 1 : max * 1.05;
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) return null;
  const first = times[0], last = times.at(-1)!;
  const xy = values.map((v, i) => ({x: last === first ? 180 : 48 + (times[i] - first) / (last - first) * 256, y: 128 - (v - low) / (high - low) * 112}));
  const modeLabel = mode === 'top' ? copy.trend.modeTop : copy.trend.modeVolume;
  return <svg viewBox="0 0 320 160" className="w-full tabular-nums" role="img" aria-label={formatCopy(copy.trend.chartLabel, {exercise, mode: modeLabel, n: points.length})} data-y-min={low} data-y-max={high}>
    <path d="M48 16V128H304" fill="none" stroke="#94a3b8" />
    <text x="44" y="20" textAnchor="end" fontSize="10">{Number(high.toFixed(2))}</text>
    <text x="44" y="128" textAnchor="end" fontSize="10">{Number(low.toFixed(2))}</text>
    <text x="48" y="148" fontSize="10">{fmtDate(points[0].date, now)}</text>
    {points.length > 1 && <text x="304" y="148" textAnchor="end" fontSize="10">{fmtDate(points.at(-1)!.date, now)}</text>}
    <polyline points={xy.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#C5943A" strokeWidth="2" />
    {xy.map((p, i) => <circle key={`${points[i].date}-${i}`} cx={p.x} cy={p.y} r="3" fill="#1A2744" tabIndex={0}><title>{fmtDate(points[i].date, now)} · {mode === 'top' ? points[i].topWeightDisplay : `${points[i].volumeKg} kg`}</title></circle>)}
  </svg>;
}
