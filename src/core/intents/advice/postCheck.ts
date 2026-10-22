// Limited P4.6 containment check; does not validate relationships or safety.
export function postCheck(markdown: string, data: Record<string, unknown>): string[] {
  const section = markdown.split('**Where you are**')[1]?.split(/\*\*[^*]+\*\*/)[0] ?? '';
  const values = section.match(/\b\d+(?:\.\d+)?\s*(?:kg|lb)\b|\b(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+)?\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g) ?? [];
  const json = JSON.stringify(data);
  return values.filter(v => !json.includes(v)).map(v => `not in data: "${v}"`);
}
