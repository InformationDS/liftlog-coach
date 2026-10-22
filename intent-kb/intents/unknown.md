# `unknown`

<!-- LLM:BEGIN -->
## When to use

Nothing else fits, or you cannot tell what the user wants. `unknown` is not for medical or destructive requests — those have their own intents even though they are refused.

## Slots

```json
{ "category": "out_of_scope | unsupported_feature | vague | chitchat" }
```

| Category | Use when | Examples |
| --- | --- | --- |
| `out_of_scope` | not about strength training | "What's the weather?", "Write me a poem", "Help me with my code" |
| `unsupported_feature` | training-related but the app can't do it | "Make me a 12-week program", "Remind me to train tomorrow", "Log my body weight", "Summarise my month", "Switch to dark mode", "I'll squat tomorrow" (planning) |
| `vague` | might be about training but the request is unclear | "Do the thing from before", "Check that", "Feeling tired lately" |
| `chitchat` | greetings, thanks, small talk | "Hi", "Thanks!", "Who are you?" |

For `vague`: set `clarification.question` to a question offering your two best guesses, and `clarification.options` to those two guesses as short messages. Example: question "Did you want to log a workout or check your past training?", options `["Log a workout", "Check my training"]`.

For the other categories leave `clarification` empty.
<!-- LLM:END -->

## Code contract (not sent to the model)

| Category | Reply (PRD F4.2) | `next_action` |
| --- | --- | --- |
| `out_of_scope` | out-of-scope text | `reject` |
| `unsupported_feature` | unsupported-feature text | `reject` |
| `vague` | model's clarification question + 2 option buttons (fallback pair if missing) | `ask_clarification` |
| `chitchat` | "Hi! I can log your strength training and answer questions about it. Try: 'Squat 100kg 5x5'." | `reject` |

High-confidence `vague` clarifications and low-confidence intent clarifications share the same two-question intent-clarification chain when there is no pending record draft. Do not reset the counter before dispatching `unknown/vague`: increment it; on the third unresolved attempt, reply with `copy.unknown.giveUp` and clear the chain. If a pending record draft existed, discard that draft and start a new intent-clarification chain at 1 instead of inheriting its count or raw text. Other unknown categories produce a completed reply and reset to 0. The state transition table in `../../02_ARCHITECTURE.md` §4.3 is authoritative.
