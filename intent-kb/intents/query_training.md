# `query_training`

<!-- LLM:BEGIN -->
## When to use

The user asks for facts or numbers from **their own logged training**: how often they trained, volume or sets, what they did on a day, or the last session / best weight / trend of one exercise.

Do **not** use it when the user asks what they should do (→ `get_advice`), even if the answer would need their data.

## Slots

```json
{
  "query_type": "session_count | volume_sets | day_detail | exercise_last | exercise_best | exercise_trend | unsupported",
  "time": null,
  "exercise_raw_name": null
}
```

| `query_type` | Use when the user asks… | Example |
| --- | --- | --- |
| `session_count` | how many times / days they trained in a period | "How many times did I train this week?" |
| `volume_sets` | total volume, tonnage or total sets in a period | "What was my total volume last week?", "How many sets did I do yesterday?" |
| `day_detail` | what they did on one specific day | "What did I do last Wednesday?", "Show me today's workout" |
| `exercise_last` | when they last did an exercise and/or what they lifted | "When did I last deadlift?", "What did I bench last time?" |
| `exercise_best` | their heaviest / best weight for an exercise in a period | "What's my best squat this month?", "Squat PR?" |
| `exercise_trend` | whether an exercise is improving / progress / trend over time | "Is my bench improving?", "How's my squat progressing?" |
| `unsupported` | any other data question (total reps across sets, rankings across exercises, comparisons between two exercises, averages, body-part analysis, predictions) | "How many reps did I do last week?", "Which exercise improved the most?", "Am I stronger on bench or overhead press?" |

| Slot | Rule |
| --- | --- |
| `time` | Time object, or `null` if no period was mentioned. Do not invent a default. |
| `exercise_raw_name` | The exercise as the user wrote it, or `null`. Required for the three `exercise_*` types. |

If the user asks about an exercise but no exercise name can be identified ("is it improving?"), set `exercise_raw_name` to `null` and ask: "Which exercise do you want to check?"

## Examples

Input: `How many times did I train this week?`

```json
{
  "intent": "query_training",
  "confidence": 0.95,
  "reason": "User asks for a session count from their own data.",
  "slots": {
    "query_type": "session_count",
    "time": { "raw_text": "this week", "type": "this_week", "n": null, "weekday": null, "week": null, "month": null, "day": null },
    "exercise_raw_name": null
  },
  "clarification": { "question": null, "options": [] }
}
```

Input: `Is my bench press improving?`

```json
{
  "intent": "query_training",
  "confidence": 0.93,
  "reason": "User asks for the trend of one exercise in their data.",
  "slots": { "query_type": "exercise_trend", "time": null, "exercise_raw_name": "bench press" },
  "clarification": { "question": null, "options": [] }
}
```

Input: `Which lift has gone up the most?`

```json
{
  "intent": "query_training",
  "confidence": 0.86,
  "reason": "Data question that ranks across exercises, which is not a supported query type.",
  "slots": { "query_type": "unsupported", "time": null, "exercise_raw_name": null },
  "clarification": { "question": null, "options": [] }
}
```
<!-- LLM:END -->

## Code contract (not sent to the model)

All calculations are deterministic and run locally. Only `exercise_trend` with ≥ 3 sessions calls the model (trend interpretation prompt, `../../05_PROMPTS.md`).

### Defaults and validation

| `query_type` | `time == null` | `exercise_raw_name == null` |
| --- | --- | --- |
| `session_count`, `volume_sets` | ask "Which period do you mean — this week, last week, or this month?" (options: "This week", "Last week") | n/a |
| `day_detail` | ask "Which day do you want to see?" (options: "Today", "Yesterday") | n/a |
| `exercise_last` | all history; no range label appended (the reply already states the date) | ask "Which exercise do you want to check?" |
| `exercise_best`, `exercise_trend` | last 8 weeks, append "(last 8 weeks)" | ask "Which exercise do you want to check?" |
| `unsupported` | — | reply with the PRD F2.1 capability text |

Other validation:

- `day_detail` with a range-type time (`this_week`, `last_n_days`, …) → ask "Which day do you want to see?" (same options as above).
- `exercise_*` matching a custom exercise: compare custom names case-insensitively after trimming (same key as the merge rule).
- For a pending time question, the complete replies Today, Yesterday, This week, Last week, This month and Last month resume the existing query deterministically. Other text starts a new request. Exact rules: `../references/time-semantics.md` Code contract.

Exercise resolution: `exercise-library.md` §"Using the library for queries and advice".

### Calculations

| `query_type` | Calculation | Reply template |
| --- | --- | --- |
| `session_count` | count sessions with date in range | "You trained on {n} day(s) {period_label} ({start} – {end})." · n = 0 → "No sessions logged {period_label}." |
| `volume_sets` | per unit: Σ(weight × reps × sets) over non-null weights; Σ sets; bodyweight sets counted in sets but not volume | "{period_label}: {sets} sets, volume {v_kg} kg[ + {v_lb} lb]." · only lb data → "volume {v_lb} lb" (no "0 kg") · only bodyweight sets → "{sets} sets, no weighted volume" · 0 sessions → "No sessions logged {period_label}." · if bodyweight sets exist append " (bodyweight sets not included in volume)" |
| `day_detail` | session on that date | Day detail card; none → "No session logged on {date}." |
| `exercise_last` | latest session containing the exercise | "Last {exercise}: {date} — {set groups summary}." |
| `exercise_best` | max non-null weight across set groups in range (compare in kg; display in original unit) | "Best {exercise} {period_label}: {weight} {unit} × {reps} on {date}." |
| `exercise_trend` | per session with a non-null weight: date, top-set weight (kg-converted for the chart), weighted session volume | < 3 weighted sessions → PRD F2.3 not-enough-data text + data points; ≥ 3 → chart card + model interpretation |

Definitions used by every calculation (and by `06_SEED_DATA.md` expected values):

- **Volume** includes all set types (warm-up, working, drop); set groups with `weight = null` (bodyweight) count towards sets but not volume. Displayed volume is rounded with `Math.round` to a whole number (2087.5 → 2088); sums are computed before rounding.
- **Top set** of a session for an exercise = the set group with the highest non-null weight (compared in kg); ties → more reps. If all groups are pure bodyweight, top set is null.
- **Best** across sessions = highest top-set weight; ties → more reps; still tied → the **earliest** date (when it was first achieved). The same definition is used for `best_top_set` / `best_date` in the trend and advice prompts.
- **Sessions since last increase** (trend prompt) = number of sessions after the last session whose top-set weight (kg) was strictly higher than every earlier session; reps are ignored here.
- **Days since a body part was last trained** counts only exercises whose `primary_body_part` is that body part.
- **Trend change**: change_kg = last minus first top-set kg, rounded to 1 decimal. If the first weight is > 0, change_percent = percentage change rounded to 1 decimal; if it is 0, change_percent = null, including an all-zero series. The first retained session establishes the initial high for sessions_since_last_increase. All-zero data is valid numeric-load data, not pure bodyweight; do not infer body mass or turn null into zero.

`period_label` examples: "this week", "last week", "this month", "in the last 10 days", "on Wed 15 Oct".

Unit conversion for comparison/chart only: 1 lb = 0.45359237 kg, round to 1 decimal. Stored data is never converted.

### Bodyweight and empty results

- `weight=null` means pure bodyweight, not 0 kg. A numeric weight on a bodyweight exercise is the added load only; the user's body mass is never inferred.
- `exercise_best` / `exercise_trend`: first check whether the exercise has any sessions in the requested range. No sessions → `copy.query.exerciseBestNone` for best, or the existing zero-point not-enough-data card for trend. Sessions exist but all weights are null → `copy.query.noWeightedData`; no best value, chart or interpretation call.
- Mixed pure-bodyweight and added-load groups: best and trend use only non-null groups. A day with no non-null groups has no trend point. Count only weighted days towards the three-point threshold, summaries and AI session labels. Include only retained days in trend summaries, so sessions_since_last_increase uses the same series.
- When any null groups are excluded, append `copy.query.weightedOnlyNote` to the best reply or display it under the trend card, including the fewer-than-three-points state. The trend payload has `excludesBodyweight=true`. Weighted volume includes only non-null groups.
- `exercise_last`, `day_detail` and set totals retain all groups. Format pure bodyweight as `Bodyweight × …`; added load as `BW + …`.
- Advice uses all exercise sessions for data sufficiency and frequency. Each session's `top_set` is its weighted top set, or null when purely bodyweight; preserve the formatted bodyweight groups in `set_groups`. Weight-based summary fields may be null as specified in `../../05_PROMPTS.md` P4.4.
