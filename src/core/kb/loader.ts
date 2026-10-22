const files = import.meta.glob('../../../intent-kb/**/*.md', {query: '?raw', import: 'default', eager: true}) as Record<string, string>;
export const kbMarkdown: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(files).map(([path, md]) => [path.replace('../../../intent-kb/', ''), md]));
export function llmSection(md: string, tag?: string): string {
  const suffix = tag === undefined ? '' : ` ${tag}`;
  const begin = `<!-- LLM:BEGIN${suffix} -->`, end = `<!-- LLM:END${suffix} -->`;
  const sections: string[] = [];
  let offset = 0;
  while (offset < md.length) {
    const start = md.indexOf(begin, offset), strayEnd = md.indexOf(end, offset);
    if (start < 0) { if (strayEnd >= 0) throw new Error('Unpaired LLM end marker'); break; }
    if (strayEnd >= 0 && strayEnd < start) throw new Error('Unpaired LLM end marker');
    const finish = md.indexOf(end, start + begin.length);
    const nested = md.indexOf('<!-- LLM:BEGIN', start + begin.length);
    if (finish < 0 || (nested >= 0 && nested < finish)) throw new Error('Unpaired LLM begin marker');
    sections.push(md.slice(start + begin.length, finish).trim());
    offset = finish + end.length;
  }
  if (!sections.length || sections.some(section => !section)) throw new Error(`Missing LLM section${suffix}`);
  return sections.join('\n\n');
}
export function loadLlmSection(path: string, tag?: string): string {
  const md = kbMarkdown[path];
  if (md === undefined) throw new Error(`Unknown KB file: ${path}`);
  return llmSection(md, tag);
}
