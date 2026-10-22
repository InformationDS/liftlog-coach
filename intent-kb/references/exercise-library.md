# Exercise library — matching contract

Code only. Nothing in this file is sent to the model. Data: `exercise-library.json` (35 standard exercises, 18 ambiguous aliases).

## Data rules

- Every alias in `exercises[].aliases` maps to exactly one exercise. An alias must not appear in two exercises, and must not also appear as a key in `ambiguous_aliases`. A unit test enforces this.
- `ambiguous_aliases` lists generic words that could mean several exercises. Their candidate lists are ordered by likelihood and capped at 3.
- `is_bodyweight: true` → weight may be `null` (pure bodyweight) or a number (added weight, e.g. weighted pull-ups).
- Cardio is not in the library. Cardio detection uses the model's `cardio_items` slot, not this file.

## Normalisation

Apply to both the user's raw name and every alias before comparison:

1. Lower-case; trim.
2. Replace `-`, `_`, `/` with a space; remove other punctuation.
3. Collapse repeated spaces.
4. Expand abbreviations as whole words: `db` → `dumbbell`, `bb` → `barbell`, `kb` → `kettlebell`. (Apply the same expansion to aliases so `db row` and `dumbbell row` both normalise to `dumbbell row`.)
5. Remove filler words as whole words: `the`, `some`, `a`, `of`, `my`.

Do **not** strip plural "s" globally (it would break "press"); plurals are listed explicitly as aliases.

## Matching algorithm

Input: one normalised raw name. Output: `{ status, standard_exercise_id | null, candidates: string[] }`.

```text
1. Exact alias match (exercise aliases or exercise name)   → status "matched", id
2. Exact key in ambiguous_aliases                          → status "ambiguous", candidates = that list
3. Fuzzy:
   a. For each exercise, score = best similarity between the raw name and any alias/name, where
      similarity = 1 − (Levenshtein distance / max(length)).
   b. Keep exercises with score ≥ 0.80.
   c. If exactly one kept and its score ≥ 0.90       → status "matched" (typo tolerance), id
   d. If one or more kept                             → status "unmatched_with_candidates", top 3 by score
4. Otherwise                                           → status "unmatched", candidates = []
```

Fuzzy step 3c exists for typos like "bench presss" or "latpulldown". A fuzzy auto-match is still shown with the user's raw name beside the standard name on the confirmation card, so the user can see what was mapped.

## How the confirmation card uses the result

| Status | Card behaviour (see `../../03_UI_SPEC.md`) | Can save? |
| --- | --- | --- |
| `matched` | Standard name, raw name in small text | Yes |
| `ambiguous` | Up to 3 candidate buttons | Only after a choice |
| `unmatched_with_candidates` | Candidate buttons + "Keep as custom: <raw name>" | Only after a choice |
| `unmatched` | "Not in library" badge + "Keep as custom" + dropdown of all 35 exercises | Only after a choice |

A custom exercise is stored with `standard_exercise_id = null` and `custom_name = <raw name as typed>`. Custom exercises are included in queries by custom name match (case-insensitive, trimmed — the same key as the merge rule), contribute no body part, and are labelled "custom" in History.

The identity helper exported from `core/kb/exerciseMatcher.ts` is `customKey(name) = name.trim().toLowerCase()`. Use it for both sides of every custom comparison: new-record folding, same-day append, stored-custom lookup, query filtering, advice filtering and typed exercise resumes. Display names and raw names are not identity keys and may retain their original spelling/spacing. When selecting a display name from several stored names with the same key, return the first supplied stored display name; the target still matches all records with that key.

## Using the library for queries and advice

`query_training` and `get_advice` slots contain `exercise_raw_name`. `resolveExerciseTarget(rawName, storedCustomNames)` in `core/kb/exerciseMatcher.ts` resolves read targets in this order (the recording/card matching algorithm above is unchanged):

1. Exact normalised standard name/alias → `{kind:'standard', id}`.
2. Exact stored custom name by `customKey(rawName) === customKey(storedName)` → `{kind:'custom', name:<stored display name>}`. Do this before ambiguous standard aliases, fuzzy candidates or fuzzy auto-matches. Do not apply standard-name abbreviation/filler/punctuation normalisation to custom-name keys. Identical custom keys across dates are one exercise target, not an ambiguity.
3. Apply the standard ambiguous-alias and fuzzy branches above: a unique `matched` result → standard target; `ambiguous` / `unmatched_with_candidates` → ask "Which exercise do you mean?" with the standard candidate buttons (max 3), each containing a structured exercise ResumeValue.
4. No target or candidate → "I couldn't find '<raw name>' in your log or the exercise library."

If a stored custom key equals an exact standard name/alias, the exact standard target takes precedence. A custom match queries only `standardExerciseId=null` entries with that custom key; it never joins standard-exercise records or replaces its target with a fuzzy standard match. For example, a saved custom `Lat pulldown V2` resolves to that custom target despite the standard library returning fuzzy candidates for the same input.

- `exercise_raw_name == null` (query `exercise_*`, or advice type `exercise`) → ask "Which exercise do you want to check?" / "Which lift do you want advice on?" with no buttons; the pending resume has `missing = "exercise"`.
- **Typed reply while a resume with `missing = "exercise"` is pending**: use the same read-target order on the entire typed text. If it yields one standard/custom target → resume with `{kind:'exercise',target}`, no classification call. Otherwise → clear the pending resume and handle the text as a new message. Follow the clarificationId checks in `../../02_ARCHITECTURE.md` §5.4.
