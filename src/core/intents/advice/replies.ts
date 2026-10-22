import { copy, formatCopy } from '../../copy';
import { exerciseLibrary, resolveExerciseTarget, type ExerciseTarget } from '../../kb/exerciseMatcher';
import { promptSets } from '../../prompts/builder';
import { mentionsSoftPain } from '../../safety/softPain';
import { scrubSecrets } from '../../llm/client';
import { clearContext, nextId, type AdviceSlots, type AssistantMessage, type ClarificationPayload, type PendingResume, type PipelineContext, type PipelineResult, type ResumeValue, type Trace } from '../../pipeline/types';
import { dataPrep } from './dataPrep';
import { postCheck } from './postCheck';
export async function adviceReply(slots: AdviceSlots, originalUserText: string, ctx: PipelineContext, trace: Trace, target?: ExerciseTarget, createdAt = ctx.now.toISOString()): Promise<PipelineResult> {
  const started=ctx.clock?.() ?? ctx.now.getTime();
  const base = () => ({id: nextId(ctx), role: 'assistant' as const, at: ctx.now.toISOString(), trace});
  const finish = (message: AssistantMessage, statePatch: PipelineResult['statePatch'] = clearContext()): PipelineResult => {
    trace.totalLatencyMs+=Math.max(0,(ctx.clock?.() ?? ctx.now.getTime())-started);
    return {messages:[{...message,trace:JSON.parse(scrubSecrets(JSON.stringify(trace),ctx.settings.apiKey)) as Trace}],statePatch};
  };
  const ask = (missing: PendingResume['missing'], question: string, options: ClarificationPayload['options'] = []) => {
    const message=base(); trace.path.push(`advice: ask ${missing}`);
    return finish({...message,kind:'clarification',payload:{clarificationId:message.id,question,options}}, {...clearContext(),activeClarificationId:message.id,pendingResume:{clarificationId:message.id,intent:'get_advice',slots,originalUserText,missing,createdAt}});
  };
  if (slots.advice_type === 'unclear') {
    const message=base(); trace.path.push('advice: ask type');
    return finish({...message,kind:'clarification',payload:{clarificationId:message.id,question:copy.advice.askType,options:copy.advice.askTypeOptions.map(text=>({label:text,action:{type:'send_text',text}}))}}, {...clearContext(),activeClarificationId:message.id});
  }
  if (slots.advice_type === 'exercise' && !target) {
    if (!slots.exercise_raw_name?.trim()) return ask('exercise',copy.advice.askLift);
    const found=resolveExerciseTarget(slots.exercise_raw_name,await ctx.repo.customNames()); trace.path.push(`match: ${slots.exercise_raw_name} = ${found.kind}`);
    if(found.kind==='not_found') return finish({...base(),kind:'text',payload:{text:formatCopy(copy.query.exerciseNotFound,{raw:slots.exercise_raw_name})}});
    if(found.kind==='candidates') return ask('exercise',copy.query.whichExercise,found.candidates.map(id=>({label:exerciseLibrary.exercises.find(e=>e.id===id)!.name,action:{type:'resume',value:{kind:'exercise',target:{kind:'standard',id}}}})));
    target=found;
  }
  if(slots.advice_type==='body_part' && !slots.body_part) return ask('body_part',copy.advice.askBodyPart,Object.entries(copy.bodyPart).map(([id,label])=>({label,action:{type:'resume',value:{kind:'body_part',id}}})));
  const data=await dataPrep(slots,target,ctx.repo,ctx.now);
  trace.path.push(`advice: mode=${data.mode}, ${data.sessionCount} sessions`);
  const discomfort=slots.mentions_discomfort || mentionsSoftPain(originalUserText);
  const request=promptSets[ctx.settings.ruleVersion].advice(data,slots.advice_type,originalUserText,discomfort);
  trace.dataSentToAi=data.mode==='data' ? JSON.stringify(data.dataJson) : null;
  const response=await ctx.llm.call('advice',request); trace.aiCalls.push(...response.logs);
  trace.path.push(`advice: ${response.ok ? 'ok' : `error (${response.error})`}`);
  if(!response.ok) return finish({...base(),kind:'error',payload:{error:response.error,retryAction:{type:'send_text',text:originalUserText}}});
  let markdown=response.data.trim().replace(/^```[^\n]*\n?/gm,'').trim();
  const titles=data.mode==='data' ? ['Where you are','What it suggests','What to try'] : data.mode==='general' ? ['Short answer','What to try'] : ['What to try'];
  if(titles.some(t=>!markdown.includes(`**${t}**`))) trace.path.push('advice: structure_mismatch');
  if(discomfort) {markdown+=`\n\n${copy.advice.discomfortNote}`;trace.path.push('advice: discomfort note added');}
  if(data.mode==='data' && data.dataJson) {trace.postCheckFlags=postCheck(markdown,data.dataJson);trace.path.push(`advice: post_check ${trace.postCheckFlags.length} flag`);}
  return finish({...base(),kind:'advice',payload:{mode:data.mode,label:data.label,markdown,discomfort}});
}
export function resumeAdvice(pending: PendingResume, value: ResumeValue, ctx: PipelineContext, trace: Trace): Promise<PipelineResult> {
  const slots=pending.slots as AdviceSlots;
  return adviceReply(value.kind==='body_part' ? {...slots,body_part:value.id as AdviceSlots['body_part']} : slots,pending.originalUserText,ctx,trace,value.kind==='exercise' ? value.target : undefined,pending.createdAt);
}
