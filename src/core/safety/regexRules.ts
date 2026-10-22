export type RuleVersion = 'v1' | 'v2';
export interface SafetyRule { id: string; category: string; pattern: RegExp; versions: readonly RuleVersion[] }
export const rules: readonly SafetyRule[] = [
  {id: 'DES-01', category: 'delete', pattern: /\b(delete|remove|erase|wipe)\b.*\b(workouts?|sessions?|records?|logs?|entr(y|ies)|exercises?|sets?|data|history)\b/i, versions: ['v1', 'v2']},
  {id: 'DES-02', category: 'clear_all', pattern: /\b(clear|reset|wipe)\b.*\b(all|everything|my data|my history|my log)\b/i, versions: ['v1', 'v2']},
  {id: 'DES-03', category: 'change_date', pattern: /\b(move|change|shift)\b.*\b(session|workout|record|log)\b.*\b(to|date|day)\b/i, versions: ['v1', 'v2']},
  {id: 'DES-04', category: 'change_date', pattern: /\bchange\b.*\bdate\b/i, versions: ['v1', 'v2']},
  {id: 'MED-01', category: 'training_with_pain', pattern: /\b(pain|painful|hurts?|hurting|injur(y|ed|ies))\b.*\b(can i|could i|should i|is it (ok|okay|safe)|safe to|still)\b/i, versions: ['v1', 'v2']},
  {id: 'MED-02', category: 'training_with_pain', pattern: /\b(can i|could i|should i|is it (ok|okay|safe)|safe to)\b.*\b(pain|painful|hurts?|hurting|injur(y|ed|ies))\b/i, versions: ['v1', 'v2']},
  {id: 'MED-03', category: 'diagnosis', pattern: /\bis (it|this|that) (a |an )?(\w+ ){0,3}(tear|strain|sprain|tendinitis|tendonitis|hernia|impingement|fracture|injury)\b|\bdo i have\b|\bdiagnos\w*/i, versions: ['v1', 'v2']},
  {id: 'MED-04', category: 'treatment', pattern: /\bhow (do|can|should) i (treat|heal|cure|rehab\w*|recover from)\b|\btreatment for\b|\brehab\w* (my|a|an|the)\b/i, versions: ['v1', 'v2']},
  {id: 'MED-05', category: 'medication', pattern: /\b(painkillers?|ibuprofen|paracetamol|nurofen|panadol|voltaren|anti-?inflammator\w*|medication|medicine|pills?|steroids?)\b/i, versions: ['v1', 'v2']},
  {id: 'MED-06', category: 'supplement_health', pattern: /\b(creatine|protein powder|supplements?|pre-?workout)\b.*\b(kidneys?|liver|heart|damage|side effects?|safe|cure|treat)\b/i, versions: ['v1', 'v2']},
];
export const getRules = (version: RuleVersion): SafetyRule[] => rules.filter(rule => rule.versions.includes(version));
export const matchSafetyRule = (text: string, version: RuleVersion): SafetyRule | null => getRules(version).find(rule => rule.pattern.test(text)) ?? null;
