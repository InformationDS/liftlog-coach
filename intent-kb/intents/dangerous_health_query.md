# `dangerous_health_query`

<!-- LLM:BEGIN -->
## When to use

The user asks for any of:

| Category | Examples |
| --- | --- |
| `diagnosis` | "Is this a rotator cuff tear?", "What's wrong with my knee?", "Do I have tendinitis?" |
| `treatment` | "How do I treat a pulled hamstring?", "What rehab should I do for my back?" |
| `medication_supplement` | "What painkiller should I take before training?", "Is creatine bad for my kidneys?" |
| `training_with_pain` | "My knee hurts, can I still squat?", "Knee feels off, should I skip legs or push through?", "Is it OK to bench with a sore shoulder?", "Shoulder's sore — rest or train today?" |

This intent is recognised but never answered. Classify it correctly; the app shows a fixed refusal.

Not this intent:
- Logging training that mentions pain as a note ("Knee was a bit sore, squat 80kg 5x5") → `record_workout`
- Asking only how to adjust technique, without asking whether to train, what's wrong, or how to treat it → `get_advice`
- General injury prevention ("How do I warm up to avoid injury?") → `get_advice`

## Slots

```json
{ "category": "diagnosis | treatment | medication_supplement | training_with_pain", "body_area": null }
```

`body_area`: the body area mentioned in the user's words (e.g. "knee", "lower back"), or `null`.

Do not fill `clarification`.
<!-- LLM:END -->

## Code contract (not sent to the model)

- Always `next_action = reject`, `risk_level = critical`, regardless of confidence.
- Reply: medical refusal text (PRD F4.2), label "Not handled by AI".
- Debug panel path ends with `intent: dangerous_health_query → reject` (distinguishes model-side catch from regex/risk-check catch).
