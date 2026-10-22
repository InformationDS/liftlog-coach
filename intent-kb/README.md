# Intent KB — LiftLog Coach

Version: **v1.0** (rule set v1 and v2 both defined here) · 2026-10-20

This folder is the single source of truth for how LiftLog Coach classifies user input, what the AI must output, and which requests are blocked. It is used in two ways:

1. **At runtime** — the prompt builder reads these files and sends the parts between `<!-- LLM:BEGIN -->` and `<!-- LLM:END -->` to the model. Everything outside those markers is a contract for the application code and must **not** be sent to the model.
2. **At build time** — the coding agent implements the safety rules, exercise matching and time resolution exactly as specified here.

> Product requirements live in `../01_PRD.md`. If this KB and another document disagree, follow `../AGENTS.md` §2.2 (stop and ask for anything user-visible; otherwise the Code contract here wins and the conflict is logged).

## Files

```text
intent-kb/
├── README.md                      # this file
├── CHANGELOG.md                   # rule-set versions (v1 → v2) and the evidence behind each change
├── references/
│   ├── routing-rules.md           # how to pick one of the 6 intents          [LLM]
│   ├── output-schema.md           # the JSON the model must return             [LLM + code]
│   ├── time-semantics.md          # how to express dates; code resolves them   [LLM + code]
│   ├── body-parts.md              # the 8 fixed body parts                     [LLM + code]
│   ├── safety-rules.md            # regex rules (v1) and risk check (v2)       [code; risk-check part is LLM]
│   ├── exercise-library.md        # matching algorithm and ambiguity rules     [code]
│   └── exercise-library.json      # 35 standard exercises + ambiguous aliases  [code]
└── intents/
    ├── record_workout.md
    ├── query_training.md
    ├── get_advice.md
    ├── dangerous_health_query.md
    ├── destructive_operation.md
    └── unknown.md
```

## The six intents

| Intent | Group | Handled by | Calls the model? |
| --- | --- | --- | --- |
| `record_workout` | supported, write (requires user confirmation) | Draft → confirmation card | Yes |
| `query_training` | supported, read-only | Deterministic query; trend interpretation only | Classification yes; interpretation only for trends with ≥ 3 weighted training days |
| `get_advice` | supported, read-only | Data retrieval → advice card | Yes |
| `dangerous_health_query` | recognised, always rejected | Fixed refusal | Blocked before the model when a safety rule matches |
| `destructive_operation` | recognised, always rejected | Fixed refusal | Blocked before the model when a safety rule matches |
| `unknown` | fallback | Capability message or clarification | Yes |

## Processing order (both rule versions)

```text
user input
  → [code]  safety regex (references/safety-rules.md)        hit → reject, 0 model calls
  → [v2]    risk check model call (safety-rules.md §3)       high risk → reject
  → [model] classification + slot extraction (one call)      → intent, confidence, slots
  → [code]  validation, confidence gate, exercise matching, time resolution
  → [code]  intent handler
```

## What the model decides vs. what the code decides

| The model decides | The code decides |
| --- | --- |
| Which intent | Whether a safety rule blocks the input |
| Whether a record supplements the pending draft (draft_action) | Starting a new draft resets its slots, original-text list and clarification count |
| Raw exercise names exactly as the user wrote them | Standard exercise ID (via `exercise-library.json`) |
| Numbers the user actually said (weight, sets, reps) | Default unit when the user gave none, and highlighting it as inferred |
| Time **semantics** (`{"type":"last_week"}`) | Actual calendar dates |
| Feeling category from the user's words | Whether to ask for clarification (confidence < 0.65, missing fields) |
| Interpretation and advice text, from data the code supplies | Every count, sum, maximum and trend series |
| — | Every database write (only after the user taps Save) |

## Prompt assembly (summary; full prompts in `../05_PROMPTS.md`)

The classification call always includes, in this order:

1. `references/routing-rules.md`
2. `references/output-schema.md`
3. `references/time-semantics.md`
4. `references/body-parts.md`
5. All six `intents/*.md` (LLM sections only)

The set is small enough (~4k tokens) to send in full, so there is no two-stage dynamic loading in this prototype.
