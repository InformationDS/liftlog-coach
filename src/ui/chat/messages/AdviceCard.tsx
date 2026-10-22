import { copy } from '../../../core/copy';
import type { AdvicePayload } from '../../../core/pipeline/types';
export function AdviceCard({payload}: {payload: AdvicePayload}) {
  const body=payload.discomfort ? payload.markdown.slice(0,-copy.advice.discomfortNote.length).trimEnd() : payload.markdown;
  const lines=body.split('\n');
  const blocks=[];
  for(let i=0;i<lines.length;i++) {
    const line=lines[i];
    if(line.startsWith('- ')) {const items=[line.slice(2)];while(lines[i+1]?.startsWith('- ')) items.push(lines[++i].slice(2));blocks.push(<ul className="list-disc pl-5" key={i}>{items.map((text,j)=><li key={j}>{text}</li>)}</ul>);}
    else if(/^\*\*[^*]+\*\*$/.test(line)) blocks.push(<h3 className="font-semibold" key={i}>{line.slice(2,-2)}</h3>);
    else if(line.trim()) blocks.push(<p className="whitespace-pre-wrap" key={i}>{line}</p>);
  }
  return <div className="space-y-3"><p className={`text-xs font-semibold ${payload.mode==='data' ? 'text-blue-700' : 'text-slate-600'}`}>{payload.label}</p>{blocks}{payload.discomfort && <p className="rounded bg-amber-50 p-3 text-amber-900">{copy.advice.discomfortNote}</p>}<p className="border-t pt-2 text-xs text-slate-500">{copy.advice.footer}</p></div>;
}
