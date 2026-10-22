# `destructive_operation`

<!-- LLM:BEGIN -->
## When to use

The user asks the app to change **saved** training data in a way chat does not allow:

| Category | Examples |
| --- | --- |
| `delete` | "Delete last Friday's workout", "Remove the squat from today", "Get rid of yesterday's log" |
| `clear_all` | "Clear all my data", "Start my log from scratch" |
| `edit_record` | "Change today's squat to 65kg", "Yesterday's bench was actually 62.5", "Fix Monday's session" |
| `change_date` | "Move Monday's session to Tuesday", "That workout was actually on the 14th" |

This intent is recognised but never executed. Classify it correctly; the app shows a fixed refusal.

Not this intent:
- Adding more exercises to today ("Also did 3x10 curls") → `record_workout` (the app appends to today's session)
- Correcting a draft that has not been saved yet, when a pending draft is provided → `record_workout`

## Slots

```json
{ "category": "delete | clear_all | edit_record | change_date", "target_text": null }
```

`target_text`: the user's words describing what to change (e.g. "last Friday's workout"), or `null`.

Do not fill `clarification`.
<!-- LLM:END -->

## Code contract (not sent to the model)

- Always `next_action = reject`, `risk_level = critical`, regardless of confidence. No database access of any kind.
- Reply by category (PRD F4.2): `delete`, `clear_all` → delete refusal; `edit_record`, `change_date` → edit refusal. Label "Not handled by AI".
