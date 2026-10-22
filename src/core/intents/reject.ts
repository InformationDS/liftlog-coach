import { copy } from '../copy';
import type { RefusalPayload } from '../pipeline/types';
export function reject(category: string, source: 'regex' | 'model' | 'risk_check'): RefusalPayload {
  const destructive = ['delete', 'clear_all', 'edit_record', 'change_date'].includes(category);
  return {text: destructive ? (category === 'delete' || category === 'clear_all' ? copy.refusal.delete : copy.refusal.edit) : copy.refusal.medical,
    label: source === 'regex' ? copy.badge.blockedRule : source === 'risk_check' ? copy.badge.blockedCheck : copy.badge.notHandled, openHistory: destructive};
}
