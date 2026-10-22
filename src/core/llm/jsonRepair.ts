import type { z } from 'zod';
export type JsonResult<T> = {ok: true; data: T; repaired: boolean} | {ok: false; error: 'invalid_json' | 'invalid_schema'};
export function extractJson(text: string): string {
  const start = text.indexOf('{');
  if (start < 0) return '';
  const last = text.lastIndexOf('}');
  // Slicing the object already excludes surrounding Markdown fences.
  return text.slice(start, last >= start ? last + 1 : undefined).trim();
}
// Scan strings separately: punctuation in string values must never be rewritten.
export function repairJson(source: string): string {
  let output = '', quote: '"' | "'" | null = null;
  const stack: string[] = [];
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (c === '\\') {
        const next = source[++i];
        if (next === undefined) return source;
        output += quote === "'" && next === "'" ? "'" : `\\${next}`;
      } else if (c === quote) { output += '"'; quote = null; }
      else output += quote === "'" && c === '"' ? '\\"' : c;
    } else if (c === '"' || c === "'") { quote = c; output += '"'; }
    else if (c === '{' || c === '[') { stack.push(c === '{' ? '}' : ']'); output += c; }
    else if (c === '}' || c === ']') {
      if (stack.pop() !== c) return source;
      output = output.replace(/,\s*$/, '') + c;
    } else output += c;
  }
  if (quote) return source; // Never invent the remainder of a truncated string.
  output = output.replace(/,\s*$/, '');
  return output + stack.reverse().join('');
}
export function parseJson(text: string): JsonResult<unknown> {
  const extracted = extractJson(text);
  try { const data: unknown = JSON.parse(extracted); return {ok: true, data, repaired: false}; }
  catch {
    try { const data: unknown = JSON.parse(repairJson(extracted)); return {ok: true, data, repaired: true}; }
    catch { return {ok: false, error: 'invalid_json'}; }
  }
}
export function parseJsonWithSchema<S extends z.ZodTypeAny>(text: string, schema: S): JsonResult<z.infer<S>> {
  const parsed = parseJson(text);
  if (!parsed.ok) return parsed;
  const result = schema.safeParse(parsed.data);
  return result.success ? {ok: true, data: result.data as z.infer<S>, repaired: parsed.repaired} : {ok: false, error: 'invalid_schema'};
}

