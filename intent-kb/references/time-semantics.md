# Time semantics

<!-- LLM:BEGIN -->
## Rule

Do **not** output calendar dates you calculated yourself. Describe what the user said using a `time` object; the app converts it to real dates.

```json
{
  "raw_text": "the exact words the user used, e.g. 'last Wednesday'",
  "type": "today | yesterday | days_ago | weekday | date | this_week | last_week | this_month | last_month | last_n_days | last_n_weeks",
  "n": null,
  "weekday": null,
  "week": null,
  "month": null,
  "day": null
}
```

| User says | Output |
| --- | --- |
| "today", "this morning", "tonight" | `{"type":"today"}` |
| "yesterday" | `{"type":"yesterday"}` |
| "3 days ago" | `{"type":"days_ago","n":3}` |
| "on Wednesday", "Wednesday" | `{"type":"weekday","weekday":3,"week":null}` |
| "last Wednesday" | `{"type":"weekday","weekday":3,"week":"last"}` |
| "this Monday" | `{"type":"weekday","weekday":1,"week":"this"}` |
| "Oct 18", "18/10", "18 October" | `{"type":"date","month":10,"day":18}` |
| "this week" | `{"type":"this_week"}` |
| "last week" | `{"type":"last_week"}` |
| "this month" | `{"type":"this_month"}` |
| "last month" | `{"type":"last_month"}` |
| "last 10 days", "past 10 days" | `{"type":"last_n_days","n":10}` |
| "last 6 weeks", "recently" → only if a number is given | `{"type":"last_n_weeks","n":6}` |
| no time mentioned | the whole `time` slot is `null` |

Weekdays: Monday = 1 … Sunday = 7. Always fill `raw_text`; fill other keys only when they apply, otherwise `null`. Dates are day/month as in Australia ("5/10" = 5 October).

"Recently", "lately" without a number → `null` (the app applies its default).
<!-- LLM:END -->

## Code contract (not sent to the model)

All resolution uses the browser's local time zone. Week starts on **Monday**. `now` = current local date-time.

| `type` | Single date (for `record_workout`, day queries) | Range (for aggregate queries) |
| --- | --- | --- |
| `today` | today | today 00:00 – now |
| `yesterday` | today − 1 | that day |
| `days_ago` | today − n | that day |
| `weekday`, `week = null` | most recent past occurrence **including today** | that day |
| `weekday`, `week = "this"` | that weekday in the current Monday-start week (may be future → validation error for records) | that day |
| `weekday`, `week = "last"` | that weekday in the previous Monday-start week | that day |
| `date` | that month/day in the current year; if that is in the future, use the previous year **and flag the date as inferred** (highlighted on the record card; the card shows the year whenever it is not the current year) | that day |
| `this_week` | — | this Monday 00:00 – now |
| `last_week` | — | previous Monday – previous Sunday 23:59 |
| `this_month` | — | 1st of this month – now |
| `last_month` | — | full previous calendar month |
| `last_n_days` | — | today − (n − 1) – now |
| `last_n_weeks` | — | today − (7n − 1) – now |

Defaults when the `time` slot is `null`:

| Intent / query type | Default | Shown to the user as |
| --- | --- | --- |
| `record_workout` | today, flagged **inferred** (highlighted on the card) | highlighted date |
| `query_training` `exercise_last` | all history | nothing appended (the answer states the date) |
| `query_training` `exercise_best` / `exercise_trend` | last 8 weeks | "(last 8 weeks)" appended to the answer |
| `query_training` without an exercise | none → ask "Which period do you mean — this week, last week, or this month?" | — |
| `get_advice` (exercise) | last 12 weeks | in the data label |
| `get_advice` (body part) | last 4 weeks | in the data label |
| `get_advice` (next session / overall) | last 14 days | in the data label |

A single-date type used with an aggregate query (e.g. "How many sets did I do yesterday?") resolves to that one day as the range. A range type used with `record_workout` is a validation error → ask "Which day did you train?".

### Typed time replies to a pending query

`matchTimeReply(text)` is a code-only helper in `core/time/resolve.ts`. Trim, lower-case and collapse whitespace, then require the **entire** input to equal one of: `today`, `yesterday`, `this week`, `last week`, `this month`, `last month`. Map it to the corresponding time type, set raw_text to the user's original reply and all unused fields to null. Other inputs return no match; do not search for a time phrase inside a longer question or use an LLM for this helper.

With an active `pendingResume.missing='time'`, a match fills the existing query via a time ResumeValue without reclassification; originalUserText and the query type are retained. The normal query validation still applies (e.g. a range supplied to day_detail creates a fresh day clarification). Buttons use the same structured time values. If no full match, discard the old resume and classify the entire message as a new request; `How many sets did I do this month?` is a new question, not an answer to a previous session-count query. Follow `../../02_ARCHITECTURE.md` §5.4 for clarificationId validation and safety order.
