export const SOFT_PAIN_PATTERN = /\b(pain\w*|hurt\w*|sore\w*|ach(e|es|ing|y)|injur\w*|tweak\w*|strain\w*|sprain\w*|niggle\w*|twinge\w*|off)\b/i;
export const mentionsSoftPain = (text: string): boolean => SOFT_PAIN_PATTERN.test(text.replace(/\s+/g, ' '));
