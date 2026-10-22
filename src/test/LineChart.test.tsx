import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LineChart, type ChartMode } from '../ui/shared/LineChart';
import { TrendCard } from '../ui/chat/messages/TrendCard';
import { DayDetailCard } from '../ui/chat/messages/DayDetailCard';
import { MessageList } from '../ui/chat/MessageList';
import { copy } from '../core/copy';
import type { TrendPayload } from '../core/pipeline/types';
import { NOW, harness, record, exercise, classified } from './cp4Fixtures';
import { ConfirmCard } from '../ui/chat/messages/ConfirmCard';
import { group, session } from './cp3Fixtures';
const points = (values: number[]): TrendPayload['points'] => values.map((v, i) => ({date: `2026-10-${10+i*2}`, topWeightKg: v, topWeightDisplay: `${v} kg × 8`, volumeKg: v}));
const trend = (values = [0, 5, 10]): TrendPayload => ({exerciseId: 'ex_bench_press', exerciseLabel: 'Barbell Bench Press', rangeLabel: 'last 8 weeks', periodLabel: 'in the last 8 weeks', points: points(values), mixedUnits: false, excludesBodyweight: false, interpretation: 'It rose by 10 kg.', notEnoughData: values.length < 3});
describe('CP5 native SVG / §2.18', () => {
  for (const mode of ['top', 'volume'] as ChartMode[]) {
    it.each([
      [[0, 0, 0], 0, 1], [[0, 5, 10], 0, 10.5], [[10, 10, 10], 9.5, 10.5], [[10], 9.5, 10.5], [[0], 0, 1],
    ] as const)(`${mode} finite coordinates for %j`, (values, min, max) => {
      const {container} = render(<LineChart exercise="Bench" points={points([...values])} mode={mode} now={NOW} />);
      const svg = screen.getByRole('img'); expect(svg.getAttribute('viewBox')).toBe('0 0 320 160'); expect(Number(svg.getAttribute('data-y-min'))).toBe(min); expect(Number(svg.getAttribute('data-y-max'))).toBe(max);
      expect(svg.outerHTML).not.toMatch(/NaN|Infinity|undefined/); expect(container.querySelectorAll('circle')).toHaveLength(values.length);
      for (const c of container.querySelectorAll('circle')) {expect(Number.isFinite(Number(c.getAttribute('cx')))).toBe(true); expect(Number.isFinite(Number(c.getAttribute('cy')))).toBe(true); expect(c.getAttribute('tabindex')).toBe('0'); expect(c.querySelector('title')?.textContent).toContain(mode === 'top' ? 'kg × 8' : 'kg');}
      if (values.length === 1) expect(container.querySelector('circle')?.getAttribute('cx')).toBe('180');
    });
    it(`${mode} empty series renders no SVG`, () => {const {container}=render(<LineChart exercise="Bench" points={[]} mode={mode} now={NOW}/>);expect(container.querySelector('svg')).toBeNull();});
  }
  it('x coordinates follow actual date spacing', () => {
    const p=points([1,2,3]);p[1].date='2026-10-11'; const {container}=render(<LineChart points={p} exercise="Bench" mode="top" now={NOW}/>);
    expect([...container.querySelectorAll('circle')].map(c=>Number(c.getAttribute('cx')))).toEqual([48,112,304]);
  });
  it.each([NaN,Infinity,-1])('invalid numeric value %s never renders nonfinite SVG', value => {const {container}=render(<LineChart points={points([value])} exercise="Bench" mode="top" now={NOW}/>);expect(container.querySelector('svg')).toBeNull();});
  it('accessible label and first/last dates, original-unit tooltip and finite path', () => {
    const p=points([1,63.5,2]);p[1].topWeightDisplay='140 lb × 10'; const {container}=render(<LineChart points={p} exercise="Lat Pulldown" mode="top" now={NOW}/>);
    expect(screen.getByRole('img',{name:'Lat Pulldown Top set trend, 3 sessions'})).toBeTruthy(); expect(container.querySelectorAll('text')).toHaveLength(4); expect(container.querySelectorAll('title')[1].textContent).toBe('Mon 12 Oct · 140 lb × 10');
  });
});
describe('CP5 query cards and Chat rendering', () => {
  it('UI saves a custom Lat pulldown V2, then query reads only that custom without further writes', async () => {
    const h=harness([record({exercises:[exercise('Lat pulldown V2',{weight:3})]}),classified('query_training',{query_type:'exercise_last',exercise_raw_name:' LAT PULLDOWN V2 '})]);
    await h.database.sessions.add(session('2026-10-19',[group(140,'lb')],'ex_lat_pulldown'));
    const writes=vi.spyOn(h.repo,'saveDraft'); await h.actions.send('Lat pulldown V2 3kg 3x8'); expect(writes).not.toHaveBeenCalled();
    function Card(){const state=h.store(),m=state.messages[1];return m?.role==='assistant'&&m.kind==='confirm_card'?<ConfirmCard id={m.id} payload={m.payload} onUpdate={state.updateCard} onHistory={()=>{}} repo={h.repo} now={()=>NOW}/>:null;}
    const view=render(<Card/>);
    try {
      fireEvent.click(screen.getByRole('button',{name:'Keep as custom: Lat pulldown V2'})); expect(h.fetcher).toHaveBeenCalledTimes(1); expect(writes).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button',{name:'Save'})); await waitFor(()=>expect(screen.getByText(copy.card.saved)).toBeTruthy()); expect(writes).toHaveBeenCalledTimes(1);
      const before=await h.repo.list(); await act(async()=>h.actions.send('Last custom?'));const m=h.store.getState().messages.at(-1);expect(m).toMatchObject({kind:'text',payload:{text:expect.stringContaining('3 kg')}});expect(JSON.stringify(m)).not.toContain('Last Lat Pulldown:');expect(writes).toHaveBeenCalledTimes(1);expect(await h.repo.list()).toEqual(before);expect(h.fetcher).toHaveBeenCalledTimes(2);
    } finally {view.unmount();await h.database.delete();}
  });
  it('switches Top set / Volume with correct scale, label and tooltip', () => {
    const p=trend();p.points[2].volumeKg=240; render(<TrendCard payload={p} now={NOW}/>);
    expect(screen.getByRole('button',{name:copy.trend.modeTop}).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button',{name:copy.trend.modeVolume}));expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Volume'); expect(screen.getByRole('img').getAttribute('data-y-max')).toBe('252');
    fireEvent.click(screen.getByRole('button',{name:copy.trend.modeTop})); expect(screen.getByRole('img').getAttribute('data-y-max')).toBe('10.5'); expect(screen.getByText('AI interpretation · based on 3 sessions')).toBeTruthy();
  });
  it.each([{values:[]},{values:[1]},{values:[1,2]}])('insufficient $values shows data points and no chart, toggles or AI badge', ({values}) => {
    render(<TrendCard payload={trend(values)} now={NOW}/>);expect(screen.queryByRole('img')).toBeNull();expect(screen.queryByRole('button')).toBeNull();expect(screen.getByText(new RegExp(`only ${values.length} session`))).toBeTruthy();expect(screen.queryByText(/AI interpretation/)).toBeNull();
    expect(screen.queryAllByRole('listitem')).toHaveLength(values.length);
  });
  it('failed interpretation still renders chart, controls, mixed units and weighted-only note', () => {
    render(<TrendCard payload={{...trend(),interpretation:null,mixedUnits:true,excludesBodyweight:true}} now={NOW}/>);
    expect(screen.getByRole('img')).toBeTruthy();expect(screen.getByText(copy.trend.interpretationUnavailable)).toBeTruthy();expect(screen.getByText(copy.trend.mixedUnits)).toBeTruthy();expect(screen.getByText(copy.query.weightedOnlyNote)).toBeTruthy();expect(screen.queryByText(/AI interpretation/)).toBeNull();
  });
  it('insufficient weighted series still shows excluded-bodyweight note', () => {render(<TrendCard payload={{...trend([0]),excludesBodyweight:true}} now={NOW}/>);expect(screen.getByText(copy.query.weightedOnlyNote)).toBeTruthy();expect(screen.getByText('Sat 10 Oct — 0 kg × 8')).toBeTruthy();});
  it('day card shows date, primary part, feeling, notes, custom and bodyweight formats; History button works', () => {
    const s=session('2026-10-19',[group(null),group(10),{...group(5,'lb'),setType:'warmup'}]);s.feeling='good';s.notes='Fixture notes';s.exercises.push({standardExerciseId:null,customName:'Landmine',rawNames:[],setGroups:[group(5)]});const open=vi.fn();
    render(<DayDetailCard session={s} onHistory={open} now={NOW}/>);expect(screen.getByRole('heading').textContent).toBe('Mon 19 Oct · Back');expect(screen.getByText('Feeling: Good')).toBeTruthy();expect(screen.getByText('Notes: Fixture notes')).toBeTruthy();expect(screen.getByText('Bodyweight × 8 reps × 3 sets')).toBeTruthy();expect(screen.getByText('BW + 10 kg × 8 reps × 3 sets')).toBeTruthy();expect(screen.getByText('BW + 5 lb × 8 reps × 3 sets · Warm-up')).toBeTruthy();expect(screen.getByText('Landmine')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:copy.dayDetail.openInHistory}));expect(open).toHaveBeenCalledOnce();
  });
  it('new message union renders in Chat with trace retained in state', () => {
    const h=harness(), trace={ruleVersion:'v1' as const,path:['query: exercise_trend'],aiCalls:[],dataSentToAi:null,safetyRuleHit:null,postCheckFlags:[],totalLatencyMs:0};
    h.store.setState({messages:[{id:'day',role:'assistant',at:NOW.toISOString(),kind:'day_detail',payload:{session:session()},trace},{id:'trend',role:'assistant',at:NOW.toISOString(),kind:'trend',payload:trend(),trace}]});
    render(<MessageList store={h.store} actions={h.actions} onHistory={()=>{}} defaultUnit="kg"/>);expect(screen.getByRole('img')).toBeTruthy();expect(screen.getByRole('button',{name:copy.dayDetail.openInHistory})).toBeTruthy();expect(h.store.getState().messages[1]).toHaveProperty('trace.path',['query: exercise_trend']);
  });
});
