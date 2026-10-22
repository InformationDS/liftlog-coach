# `record_workout`

<!-- LLM:BEGIN -->
## When to use

The user reports strength training they **have already done** (today or in the past). Also use it when the user reports only cardio — the app will tell them cardio is not supported.

Use it even when details are missing ("did some cable flyes"); the app will ask for them.

Do **not** use it for plans ("I'll squat tomorrow" → `unknown`), questions about past data (→ `query_training`), or edits to a saved session (→ `destructive_operation`).

## Slots

```json
{
  "draft_action": "new",
  "time": null,
  "feeling": null,
  "feeling_text": null,
  "notes": null,
  "exercises": [
    {
      "raw_name": "string",
      "set_groups": [
        { "weight": null, "unit": null, "sets": null, "reps": null, "set_type": null }
      ]
    }
  ],
  "cardio_items": []
}
```

| Slot | Rule |
| --- | --- |
| `draft_action` | Required: `"new"` or `"continue"`. Use `"continue"` only when a PENDING_DRAFT is present and the message supplements or corrects that draft. Use `"new"` when no pending draft exists or the user starts a different workout. |
| `time` | Time object from the time rules, or `null` if no day was mentioned. |
| `feeling` | `"good"`, `"normal"`, `"bad"`, or `null`. Only fill it if the user described how the session felt. |
| `feeling_text` | The user's exact words about the feeling (e.g. "smashed it"), or `null`. |
| `notes` | Other remarks worth keeping, in the user's words (e.g. "knee a bit sore"), or `null`. Do not repeat exercise data here. |
| `exercises` | One entry per distinct exercise, in the order mentioned. |
| `exercises[].raw_name` | The exercise name as the user wrote it. |
| `set_groups` | One entry per distinct weight/reps combination for that exercise. |
| `weight` | Number, or `null` if not stated or bodyweight. |
| `unit` | `"kg"` or `"lb"` only if written or clearly said ("kilos", "pounds", "lbs"). Otherwise `null`. Never assume. |
| `sets` | Number of sets, or `null` if not stated. |
| `reps` | Reps per set, or `null` if not stated. |
| `set_type` | `"warmup"`, `"working"` or `"drop"` only if the user said so; otherwise `null`. |
| `cardio_items` | Cardio activities mentioned, as short text (e.g. `"running 5km"`). Do not put cardio in `exercises`. |

## Reading sets and reps

| User writes | weight | sets | reps |
| --- | --- | --- | --- |
| "60kg 4x8", "60 kg 4 x 8", "60kg 4 sets of 8" | 60 | 4 | 8 |
| "4 sets of 8 at 60kg", "8 reps x 4 sets at 60" | 60 | 4 | 8 |
| "60x8" (two numbers, the first is clearly a load) | 60 | 1 | 8 |
| "60kg for 8" | 60 | 1 | 8 |
| "3x10" with no weight | null | 3 | 10 |
| "did some cable flyes" | null | null | null |
| "pull-ups 3x8" (bodyweight) | null | 3 | 8 |
| "pull-ups +10kg 3x5" | 10 | 3 | 5 |

"NxM" means **N sets × M reps** unless the user explicitly labels the numbers otherwise.

Different loads for the same exercise become separate set groups:
"Squat 60kg x5, 80kg x5, 100kg 3x5" →
`[{"weight":60,"unit":"kg","sets":1,"reps":5}, {"weight":80,"unit":"kg","sets":1,"reps":5}, {"weight":100,"unit":"kg","sets":3,"reps":5}]` (set_type `null` each).

A unit written once applies to the following numbers for the same exercise in the same phrase ("squat 60, 80, 100kg x5" → all kg). It does **not** carry over to other exercises.

## Feeling

| User says | `feeling` |
| --- | --- |
| great, good, strong, felt amazing, smashed it, solid, easy | `good` |
| ok, fine, normal, average, alright | `normal` |
| bad, tired, weak, rough, terrible, struggled, exhausted | `bad` |
| nothing about the feeling | `null` |

If the user mentions only a body sensation ("knee a bit sore") put it in `notes`, not `feeling`.

## When to ask (fill `clarification.question`)

Only ask when **no exercise at all** can be identified, e.g. "had a good session today" → question: "What exercises did you do? For example: 'Bench press 60kg 4x8'." Leave other gaps (missing sets, reps, weight, unit) as `null`; the app will ask about them.

## If a pending draft is provided

Sometimes the request includes `PENDING_DRAFT` — the slots from the user's previous message that were incomplete. For a supplement or correction ("4 sets", "it was 20kg"), set `draft_action="continue"` and return the **complete merged** slots, changing only what the new message provides. For a different workout or an explicit restart ("Forget that. Yesterday I did deadlifts"), set `draft_action="new"` and extract only the new message; do not copy the previous exercises, date, notes or feeling. With no PENDING_DRAFT, always return `draft_action="new"`. This field describes the relationship between the two messages, not a database operation.

## Examples

Input: `Bench press 60kg 4x8, incline dumbbell fly 15kg 3x12, felt great`

```json
{
  "intent": "record_workout",
  "confidence": 0.96,
  "reason": "User reports completed strength exercises with loads, sets and reps.",
  "slots": {
    "draft_action": "new",
    "time": null,
    "feeling": "good",
    "feeling_text": "felt great",
    "notes": null,
    "exercises": [
      { "raw_name": "Bench press", "set_groups": [ { "weight": 60, "unit": "kg", "sets": 4, "reps": 8, "set_type": null } ] },
      { "raw_name": "incline dumbbell fly", "set_groups": [ { "weight": 15, "unit": "kg", "sets": 3, "reps": 12, "set_type": null } ] }
    ],
    "cardio_items": []
  },
  "clarification": { "question": null, "options": [] }
}
```

Input: `Yesterday did squats, 100 for 5 sets of 5, then some leg curls`

```json
{
  "intent": "record_workout",
  "confidence": 0.93,
  "reason": "User reports yesterday's completed exercises; some details are missing.",
  "slots": {
    "draft_action": "new",
    "time": { "raw_text": "Yesterday", "type": "yesterday", "n": null, "weekday": null, "week": null, "month": null, "day": null },
    "feeling": null,
    "feeling_text": null,
    "notes": null,
    "exercises": [
      { "raw_name": "squats", "set_groups": [ { "weight": 100, "unit": null, "sets": 5, "reps": 5, "set_type": null } ] },
      { "raw_name": "leg curls", "set_groups": [ { "weight": null, "unit": null, "sets": null, "reps": null, "set_type": null } ] }
    ],
    "cardio_items": []
  },
  "clarification": { "question": null, "options": [] }
}
```

Input: `Ran 5km this morning`

```json
{
  "intent": "record_workout",
  "confidence": 0.9,
  "reason": "User reports completed training, but it is cardio only.",
  "slots": {
    "draft_action": "new",
    "time": { "raw_text": "this morning", "type": "today", "n": null, "weekday": null, "week": null, "month": null, "day": null },
    "feeling": null, "feeling_text": null, "notes": null,
    "exercises": [],
    "cardio_items": ["running 5km"]
  },
  "clarification": { "question": null, "options": [] }
}
```
<!-- LLM:END -->

## Code contract (not sent to the model)

### Processing order

After the safety and confidence gates, determine the draft scope before validation: `draft_action="new"` starts with no previous slots/rawTexts and counter 0; `"continue"` with an existing pending draft uses the returned merged slots and preserves that draft's rawTexts/counter/createdAt. If there is no pending draft, process as new regardless of the model's action. The slots schema requires the action enum; missing or invalid values follow the JSON validation/retry path. Apply this scope even when the new message has no exercises or is cardio-only.

```text
1. If exercises == [] and cardio_items != []           → reply cardio-unsupported (PRD F1.6). next_action = reject
2. If exercises == [] and cardio_items == []           → ask model's clarification.question (or default "What exercises did you do?…")
3. Resolve time (time-semantics.md). null → today, inferred = true.
   Range type → problem "Which day did you train?". Future date → problem "That date is in the future. Which day did you train?".
   Run exerciseMatcher for every raw_name before checking weight. Only a unique match with is_bodyweight=true permits weight=null; unresolved and custom exercises require a weight. Keep unresolved choices for the confirmation card; do not select a candidate automatically.
4. For each set group:
   - unit == null and weight != null → unit = settings.defaultUnit, inferred = true
   - weight == null on a bodyweight exercise → unit = "kg", unitInferred = false (internal placeholder; do not display a unit)
   - set_type == null                → "working" (not highlighted)
5. Missing-field check per exercise (exercise is bodyweight per library? weight may be null):
   weight (non-bodyweight), sets, reps → problems.
   Empty set_groups → ask for weight (if required), sets and reps; do not create an empty exercise.
6. Range check: a non-null weight must be finite and 0 ≤ weight ≤ 500 (kg) / 1100 (lb); sets must be an integer in 1–20; reps must be an integer in 1–100. A null weight is not converted to zero.
   If steps 3, 5 and 6 produced any problems → ONE clarification message listing all of them
   (date problem first, then missing fields, then unusual values; PRD F1.2).
   Store slots as the pending draft; increment clarification counter (max 2, PRD F1.2).
7. Keep the matching results from step 3 for each raw_name; unresolved choices are made on the confirmation card.
8. feeling inferred flag (feelingInferred): true if feeling != null, unless feeling_text is a literal match:
   - lower-case feeling_text, strip punctuation, remove the filler words
     "felt", "feel", "feeling", "pretty", "really", "very", "quite", "so", "a", "bit", "overall", "today"
   - the remainder must be exactly one literal word, and that word must map to the same feeling as the model output:
     good, great → good · ok, fine, normal → normal · bad → bad
   - examples: "felt great" → not inferred · "Good" → not inferred · "not great" → inferred (remainder "not great")
     · "smashed it" → inferred
   Keep feeling_text as Draft.feelingText (shown as "≈ \"{text}\" → {feeling}" when inferred).
9. Look up existing session on the resolved date → append mode if found (PRD F1.5).
10. Render confirmation card. next_action = confirm_record.
11. On Save → validate and write only this card's edited draft (append or create), then mark this card saved. Save/Discard must not change pendingDraft, pendingResume, clarificationCount or activeClarificationId belonging to another message. The context for this card was cleared when its confirmation card was generated (step 10; architecture §4.3).
```

### Edited draft and save validation

The same validation rules apply after every card edit and at the storage write boundary (`../../02_ARCHITECTURE.md` §5.7). Determine bodyweight status from the final chosen standard exercise, not from the original match. Custom exercises require a weight. At least one exercise and one set group per exercise are required. Reject invalid dates, enum values, empty custom names, unknown exercise IDs, missing choices, non-finite weights, out-of-range numbers and fractional sets/reps; write nothing on failure.

The parse phase validates extracted values without requiring a chosen candidate; ambiguous exercises with complete parameters proceed to the confirmation card. The confirm/save phases also validate choices and use the chosen exercise's bodyweight flag. Phase rules and issue codes are defined in `../../02_ARCHITECTURE.md` §5.7.

For a pure bodyweight group, store weight=null and unit="kg" and hide the unit control. If the user adds a weight, restore the previously explicit unit if there is one; otherwise use settings.defaultUnit and highlight it as inferred. Editing the unit confirms it. Changing the chosen exercise to a non-bodyweight exercise makes a missing weight invalid immediately.

### Clarification counter

- Incremented each time step 2 or the combined step 3/5/6 message asks a question for the same pending draft.
- A new draft's first incomplete attempt sets the counter to 1 and rawTexts to only the current message. Continuations append the current message once and increment the preserved counter. A completed or rejected new draft never retains the abandoned draft's text.
- On the 3rd consecutive incomplete attempt: discard draft, reply with `copy.record.giveUp`, reset counter.
- All other resets follow the state transition table in `../../02_ARCHITECTURE.md` §4.3 (single source).

### Mixed strength + cardio

If both `exercises` and `cardio_items` are non-empty, process the strength part normally and add the note "Skipped (cardio not supported): <items joined by ', '>" under the card.
