# `get_advice`

<!-- LLM:BEGIN -->
## When to use

The user wants a recommendation or explanation: how to break a plateau, how to improve a lift, what to train next, whether their training is balanced, general training knowledge, or how to adjust technique.

Do **not** use it when the user:
- wants raw facts or numbers from their log (→ `query_training`)
- asks for a diagnosis, treatment, medication, supplement health effects, or whether to train / skip / push through with pain or a possible injury (→ `dangerous_health_query`)

## Slots

```json
{
  "advice_type": "exercise | body_part | next_session | overall | general_knowledge | unclear",
  "exercise_raw_name": null,
  "body_part": null,
  "mentions_discomfort": false,
  "user_question": "string"
}
```

| `advice_type` | Use when | Example |
| --- | --- | --- |
| `exercise` | about one of the user's exercises | "My squat is stuck at 100kg, what should I do?", "How do I improve my deadlift?" |
| `body_part` | about one body part in the user's training | "Am I training back enough?", "How should I change my chest training?" |
| `next_session` | what to train next / today / tomorrow | "What should I train tomorrow?" |
| `overall` | the user's training as a whole | "What's wrong with my training?", "Is my split balanced?" |
| `general_knowledge` | a general question that does not depend on the user's own history (removing "my" does not change the meaning) | "How many sets per week for hypertrophy?", "What's a good rep range for strength?" |
| `unclear` | you cannot tell what the advice is about | "Give me some advice" |

| Slot | Rule |
| --- | --- |
| `exercise_raw_name` | Exercise as written, for `exercise`; otherwise `null`. |
| `body_part` | One of the 8 body part IDs for `body_part`; `null` if vague ("upper body") or not applicable. |
| `mentions_discomfort` | `true` if the message mentions pain, soreness, discomfort or a body area feeling wrong. |
| `user_question` | The user's question, copied verbatim. |

For `unclear`, set `clarification.question` to "What would you like advice on — a specific lift, what to train next, or a general training question?" and options `["Advice on a specific lift", "What should I train next?"]`.

## Technique questions that mention discomfort

"My shoulder feels uncomfortable when I bench, how should I adjust my grip?" → `get_advice`, `advice_type: "exercise"`, `mentions_discomfort: true`.

But if the user also asks whether they *can / should* keep training, what is wrong, or how to treat it, it is `dangerous_health_query`.

## Example

Input: `My squat has been stuck at 100kg for weeks, what should I do?`

```json
{
  "intent": "get_advice",
  "confidence": 0.94,
  "reason": "User asks for a plan to break a plateau on one of their exercises.",
  "slots": {
    "advice_type": "exercise",
    "exercise_raw_name": "squat",
    "body_part": null,
    "mentions_discomfort": false,
    "user_question": "My squat has been stuck at 100kg for weeks, what should I do?"
  },
  "clarification": { "question": null, "options": [] }
}
```
<!-- LLM:END -->

## Code contract (not sent to the model)

### Data preparation (PRD F3.2)

| `advice_type` | Data sent to the advice prompt | Sufficiency rule |
| --- | --- | --- |
| `exercise` | Last 12 weeks: each session's date, set groups, top-set weight; sessions per week | ≥ 3 sessions with that exercise |
| `body_part` | Last 4 weeks: each matching session's date, weighted sets and exercises; window totals and comparisons (primary weighted 1, secondary 0.5 for set counts) | ≥ 2 sessions hitting it |
| `next_session` / `overall` | Last 14 days: each session's date, primary body parts and total sets; days since each body part was last trained | ≥ 2 sessions in 14 days |
| `general_knowledge` | none | — |
| `unclear` | — (ask) | — |

Exercise resolution follows `exercise-library.md` (including `exercise_raw_name == null` with `advice_type = "exercise"` → ask "Which lift do you want advice on?"). `body_part == null` with `advice_type = "body_part"` → ask as in `body-parts.md`.

The advice prompt receives the **original user message** (not `slots.user_question`, which the model may have rewritten). `user_question` is kept in the schema only for the debug panel.

For a resume-type clarification, store that message in `PendingResume.originalUserText`. Preserve it across all target-selection steps and use it for USER_QUESTION and the discomfort check. The selected exercise or body part fills only its slot. Details: `../../02_ARCHITECTURE.md` §5.4.

Every data-mode answer cites at least two dated sessions: exercise advice uses set groups/top sets (bodyweight reps and sets are valid evidence); body-part advice uses per-session weighted set counts; next-session/overall advice uses per-session total set counts. All values are supplied by code. Exercise advice retains pure-bodyweight sessions; nullable weight summaries are defined in `../../05_PROMPTS.md` P4.4.

### Mode passed to the advice prompt

| Situation | Mode | Card label |
| --- | --- | --- |
| Data sufficient | `data` | "Based on your data · {n} sessions, {start} – {end}" |
| Data insufficient | `insufficient` | "General advice — your training data was not used" |
| `general_knowledge` | `general` | "General advice — your training data was not used" |

In `insufficient` mode the prompt receives **no** personal data and must start with "You don't have much data on {target} yet, so this is general advice:".

### Discomfort

`discomfort = slots.mentions_discomfort || SOFT_PAIN_PATTERN.test(original user text)` (pattern in `../references/safety-rules.md` §3.1). The code does not rely on the model flag alone. If `discomfort == true`, the code appends this exact sentence to the advice text after the model returns, regardless of what the model wrote: "If pain persists or gets worse, stop and see a doctor or physiotherapist."

### Post-check (code, after the model returns advice)

In `data` mode, extract every number followed by `kg`/`lb` and every date in the advice's "current situation" section; flag in the debug panel any value that does not appear in the data sent. Flags are shown only in the debug panel (they are evidence for the test log), not to the user.
