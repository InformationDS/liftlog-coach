# Output schema

<!-- LLM:BEGIN -->
## Format

Return **one JSON object and nothing else** — no Markdown, no code fences, no commentary.

```json
{
  "intent": "record_workout | query_training | get_advice | dangerous_health_query | destructive_operation | unknown",
  "confidence": 0.0,
  "reason": "one short sentence explaining the choice",
  "slots": {},
  "clarification": {
    "question": null,
    "options": []
  }
}
```

| Field | Rule |
| --- | --- |
| `intent` | Exactly one value from the list. |
| `confidence` | Number from 0 to 1. |
| `reason` | Max 25 words, English. |
| `slots` | The object defined in the chosen intent's document. Include every key of that intent's slot object; use `null` (or `[]` for lists) when a value was not stated. Do not add keys. |
| `clarification.question` | A question to the user, or `null`. Required when `confidence < 0.65`, or when the intent document tells you to ask. |
| `clarification.options` | `[]`, or exactly two short replies the user could send. Required (two items) when `confidence < 0.65`. |

## General slot rules

- Only extract what the user actually said. Missing → `null`. Never guess numbers, units, dates or feelings.
- Keep exercise names exactly as the user wrote them (fix obvious typos only, e.g. "bensh" → "bench"). Do not convert them to standard names.
- Numbers are JSON numbers, not strings.
- `record_workout.slots.draft_action` is always `"new"` or `"continue"` as defined by that intent. It is a required message-relation flag, not an extracted workout value, and is never null.
<!-- LLM:END -->

## Code contract (not sent to the model)

### Validation (in order)

1. Strip anything before the first `{` and after the last `}`; strip Markdown fences.
2. `JSON.parse`. On failure → repair (remove trailing commas, convert single quotes to double quotes, close unbalanced brackets) → parse again.
3. Validate against the TypeScript types in `../../02_ARCHITECTURE.md` (generated from this file and the intent docs). Unknown intent, missing `slots`, or wrong types → failure.
4. On failure after repair: retry the model call **once** with an extra user message: `"Your previous reply was not valid JSON for the schema. Return only the JSON object."` Second failure → user-facing error (PRD §7).

### Derived fields (code only; never requested from the model)

| Field | Derived from |
| --- | --- |
| `next_action` | intent + validation results (see each intent's code contract) |
| `risk_level` | `dangerous_health_query`/`destructive_operation` → `critical`; `record_workout` → `medium`; others → `low` |
| `standard_exercise_id`, `match_status`, `candidates` | `exercise-library.md` matching |
| Calendar dates | `time-semantics.md` resolution |
| `inferred` flags | Which fields the code filled (date default, unit default) or the model normalised (feeling from non-standard wording) |
