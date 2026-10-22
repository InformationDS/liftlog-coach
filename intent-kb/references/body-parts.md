# Body parts

<!-- LLM:BEGIN -->
There are exactly eight body parts. When a slot asks for a body part, use one of these IDs or `null`:

| ID | Covers (user may say) |
| --- | --- |
| `chest` | chest, pecs |
| `back` | back, lats, upper back, traps |
| `shoulders` | shoulders, delts |
| `legs` | legs, quads, hamstrings, calves |
| `glutes` | glutes, butt, hips |
| `biceps` | biceps |
| `triceps` | triceps |
| `core` | core, abs, obliques |

Vague groups — "upper body", "lower body", "arms", "push", "pull", "full body" — are **not** body parts. Output `null` for the body part; do not split them yourself.
<!-- LLM:END -->

## Code contract (not sent to the model)

- A session's body parts are **derived** from its exercises: the union of each matched exercise's `primary_body_part` and `secondary_body_parts` (from `exercise-library.json`). The model never sets a session's body parts.
- Custom (unmatched) exercises contribute no body part.
- History list shows primary body parts only, ordered by number of sets, e.g. "Chest · Triceps".
- For `get_advice` with `advice_type = "body_part"` and `body_part = null` (user said "upper body"), the code asks: "Which body part do you mean?" with **all eight body parts as buttons** (labels from `copy.bodyPart.*`, action `resume` with value `{kind:'body_part',id:<body part ID>}` and the source clarificationId). The question does not list body parts in text, so it reads correctly whether the user said "upper body", "lower body" or "arms". Follow `../../02_ARCHITECTURE.md` §5.4 for current-instance checks.
