# CP9 v2 release — 2026-10-23

The user accepted the local CP9 implementation and authorized publication of these three v2 refinements:

1. Replace v2 MED-01 in place with MED-01b: remove the standalone `still` trigger and exclude modal phrases immediately followed by technique-adjustment verbs. A1 (completed workout with a pain note) and A2 (grip technique question) can proceed to P2. v1 retains MED-01 unchanged; v2 still blocks T09 and pain-permission requests.
2. Make the P2 allowance for general delayed-onset muscle soreness knowledge explicit, including A5. Personal diagnosis, treatment, medication, reassurance that symptoms are harmless, train/skip/rest decisions and mixed unsafe requests remain blocked. No application-side input whitelist was added.
3. Require complete `clarification` objects in v2 P1 for every intent. Medical/destructive refusals use `{"question":null,"options":[]}`, regardless of confidence. This resolves the ambiguous "Do not fill clarification" wording for v2 without changing the shared schema or JSON retry behavior.

v1 prompts and behavior, P3/P4, shared softPain, the P2 threshold and failure policy remain unchanged. The A4 decision is to **keep the current policy**: a failed P2 check with injury/soft-pain words still fails closed. No other safety change is included.

## Prompt contract

Only v2 selects `CLASSIFY_END_V2`, appended after the unchanged shared KB sections:

```text
For every intent, always return the complete "clarification" object with both "question" and "options" keys. Never return "clarification": null or omit the object or either key.
For dangerous_health_query and destructive_operation, return "clarification": {"question": null, "options": []}, regardless of confidence. In those intent documents, "Do not fill clarification" means use this empty object, not null.
For other intents, when no clarification is needed use the same empty object. When clarification is required, fill question and options according to the output format and the chosen intent's rules.
```

The P2 text is loaded from the tagged section in `intent-kb/references/safety-rules.md`; its DOMS allowance is knowledge-only, with explicit unsafe/mixed-request limits. All request parameters and schemas are unchanged.

## Validation and evidence boundaries

Local acceptance: Node 20.20.2, 772 tests (34 added), typecheck, lint and build passed. Tests use synthetic HTTP responses and verify application paths conditional on those responses. The v1 P1 message fingerprints and original v1 regex expectations are preserved.

The observed motivations were A1/A2 regex false positives, A5 successful-P2 false positives and B4 null-clarification schema failures. Original experiment traces, replies, screenshots, statistics and local verification artifacts are private and excluded from the release. No post-change real-model accuracy or false-positive rate is claimed.

Remote validation and deployment are recorded by [GitHub Actions](https://github.com/InformationDS/liftlog-coach/actions). The workflow runs tests, typecheck, lint and build before deploying [GitHub Pages](https://informationds.github.io/liftlog-coach/).

For a future authorized real-model run, use a fresh results directory and batch, fixed settings and seed data, and the original [test kit](ASSIGNMENT_TEST_KIT.md). Its baseline behavior tables remain historical: CP9 v2 T09 expects MED-01b, and v2 A1/A2 now reach P2. A4 failure handling is unchanged. Do not overwrite earlier evidence or count local fixtures as real-model results. P1 complete-object compliance is observable only when classification actually runs; a P2 refusal does not establish P1 compliance.
