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

## CP9 — accepted v2 refinements (2026-10-23)

- A1/A2: retained private baseline evidence shows MED-01 false positives (3/3 each/version). MED-01 is now v1 only; v2 replaces it in place with MED-01b (§1.2). Other regex rules, order, flags and newline behavior are unchanged.
- A5: retained private baseline evidence shows successful P2 medical false positives in all three v2 runs. P2 now explicitly permits knowledge-only DOMS questions, while preserving diagnosis, treatment, medication, training decisions and mixed-request blocks. This is based on observed v2 over-blocking, not a claim of v1 unsafe answers being fixed.
- B4: retained private v1 run2 evidence contains two schema-invalid `clarification: null` responses despite a medical intent. Only v2 P1 adds `CLASSIFY_END_V2`, requiring both clarification keys for every intent and the empty object for refusals, regardless of confidence. Shared KB intent text, v1 P1, schemas and retry behavior are unchanged.
- A4: retained private baseline evidence shows two P2 timeout/fail-closed outcomes. The user's publication decision is to keep the current policy; no change to shared softPain, riskCheck failure handling, thresholds or error mappings.
- Validation here is local deterministic regression with fake HTTP responses, not a new model experiment. Original private testing evidence and statistics are preserved. See [CP9 release notes](../delivery/CP9_RELEASE_NOTES.md) for scope, version-specific prompt contracts and limitations. Local acceptance and publication authorization do not establish post-change real-model results.

## CP9 round 2 — local v2 prompt refinement (2026-10-23)

- The retained 17-run private precheck found that A5 passed P2 in all three runs but all three P4 answers added symptom-based training or recovery instructions. A2 run1 prescribed a one-to-two-week pause; run3 added a symptom-based exercise substitution period. v2 now uses ADVICE_SYSTEM_V2: knowledge-only DOMS stays explanatory, and discomfort-related technique cues do not become symptom-based rest/recovery schedules. Existing card headings and the application's exact doctor/physio sentence are unchanged.
- A1 precheck run1/run3 omitted explicitly written kg. Only v2 P1 now emphasizes retaining each group's explicit kg/lb, mixed units, and explicit units in pending drafts. Missing units remain null for code defaults; original raw exercise wording and the shared matcher are unchanged.
- promptSets.v2.advice selects the versioned builder used by the existing adviceReply dispatch, including resume/retry. Local fake-HTTP regression checks the actual outgoing P4 system messages, not only the promptSets configuration.
- Earlier CP9 MED-01b/P2 DOMS/clarification changes remain. v1 P1/P3/P4/P6 wire-request fingerprints, shared safety/failure handling, schemas, dependencies and all retained experimental evidence are preserved. The user accepted the 793-test local checkpoint and authorized publication. No post-round2 real-model result is claimed; remote validation and deployment are recorded by Actions.
