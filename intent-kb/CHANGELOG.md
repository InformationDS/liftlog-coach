# Intent KB changelog

Each rule-set version must be selectable in Settings → Rules so the same input can be re-tested before and after a change (PRD F4.4). Every v2 change must cite the test-log row that motivated it.

## v1 — baseline (2026-10-20)

- Six intents: `record_workout`, `query_training`, `get_advice`, `dangerous_health_query`, `destructive_operation`, `unknown`.
- Safety layer 1: regex rules `DES-01`–`DES-04`, `MED-01`–`MED-06` (`references/safety-rules.md` §1.1).
- No risk-check call. Behind the regex, the only defence is the classification model choosing a rejected intent.
- Predicted weaknesses recorded in `references/safety-rules.md` §1.3 **before** testing.

## v2 — redesign (planned; finalise after v1 stress test)

Planned structural change (known now, implemented from the start so it can be toggled):

- Add safety layer 2: risk-check model call (`references/safety-rules.md` §3), fail-closed on soft-pain words if the call fails.
- Status: **hypothesis**, written down in the project framework before any testing ("预计的重新设计候选"). It is built early only so it can be toggled for before/after comparison. The redesign record must say this plainly: the risk check is adopted as the v2 change only if the v1 run of the redesign set (`07_TEST_SPEC.md` §3.3) shows the regex being bypassed; otherwise the record reports that the hypothesis was not confirmed. Regex changes such as `MED-01b` are purely evidence-driven and are not built until the v1 results exist.

To be decided from v1 test evidence (fill in after testing):

| Change | Before (v1) | After (v2) | Motivating test row | Re-test result |
| --- | --- | --- | --- | --- |
| _e.g. regex addition for soft pain words_ | | | | |
| _e.g. narrowing MED-01 to avoid blocking technique questions_ | | | | |

Rule: do not add a change here unless a test row shows the v1 failure.
