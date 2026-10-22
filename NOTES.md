# LiftLog Coach implementation notes

## Decisions

- 2026-10-22 — `02_ARCHITECTURE.md` §2: pin exact direct dependency versions
  and retain `package-lock.json`. Vite 5.4.21, React/React DOM 18.3.1,
  TypeScript 5.9.3, Tailwind 3.4.19, zustand 4.5.7, zod 3.25.76,
  Dexie 4.4.0 and dexie-react-hooks 4.4.0 follow the prescribed majors.
  npm registry metadata confirms dexie-react-hooks requires Dexie
  `>=4.2.0-alpha.1 <5.0.0` and React `>=16`.
- 2026-10-22 — `02_ARCHITECTURE.md` §2 (tests marked latest) and the user's
  compatibility requirement: use Vitest 3.2.7, whose Vite dependency range is
  `^5.0.0 || ^6.0.0 || ^7.0.0-0`. Newer Vitest majors require newer Vite.
  Official reference: https://vitest.dev/guide/migration.html.
  `@vitejs/plugin-react` 4.7.0 accepts Vite 5. Testing Library React 16.3.0
  accepts React 18 and requires Testing Library DOM 10. Add its DOM peer,
  jsdom 26.1.0, React/Node types, PostCSS/Autoprefixer, and ESLint tooling
  as development dependencies only. jsdom and fake-indexeddb 6.2.6 support
  Node >=18. No additional application runtime dependencies were added.
- 2026-10-22 — `02_ARCHITECTURE.md` §2: use PostCSS 8.5.31,
  typescript-eslint 8.72.0 and ESLint/@eslint/js 9.39.5. Their engines and
  peer ranges accept Node 20.20.2, TypeScript 5.9.3 and ESLint 9.
  `npm ls --depth=0` completes successfully with no invalid dependencies.
- 2026-10-22 — `02_ARCHITECTURE.md` §2: the machine's default Node is 24.15.0.
  Obtain Node 20.20.2 through the official npm registry for this checkpoint;
  run installation and verification under Node 20 with its directory prepended
  to the process PATH. Do not change the system Node installation.
- UI labels and formatters live in core/copy.ts. The header reads the persisted
  version and opens Settings → Rules; chat components implement their assigned
  message payloads without adding new product flows.
- 2026-10-22 — `AGENTS.md` §2.3: copy 15 KB files, freeze the source README
  with the prescribed date marker, and copy the seed plan. Compare file counts
  and SHA-256 hashes; README comparison excludes only the added freeze marker.
- The raw-import smoke test and production KB loader use Vite ?raw imports from
  prototype/intent-kb. No proxy or filesystem allowlist is required.
- 2026-10-22 — local browser verification: the sandboxed server could start
  but local socket access failed with an access-permission error. Restart
  the same Vite command outside the sandbox, still bound only to 127.0.0.1,
  and open a fresh in-app browser tab. The page then loads and passes the
  three-Tab, badge, layout and console checks. No proxy, firewall setting or
  project configuration change is used.

- 2026-10-22 — CP1, `AGENTS.md` §4.1 and `03_UI_SPEC.md` §1.5:
  `fmtDate(iso, now)` and `fmtRange(start, end, now)` require an injected clock
  for current-year display. Calendar parsing/formatting uses local date fields;
  calendar shifts use `setDate`, not fixed 24-hour millisecond subtraction.
  Invalid dates and inappropriate range-to-day requests return explicit failures.
- 2026-10-22 — CP1, `02_ARCHITECTURE.md` §6.4: slots schemas use passthrough
  objects and nullable/defaulted optional fields. Consumers use declared fields;
  extra metadata does not affect matching or resolution. `draft_action` and
  confidence have no defaults. Finite slot numbers remain available for the
  later shared record validator to check domain ranges and integers.
- 2026-10-22 — CP1, `output-schema.md` Code contract: JSON parsing returns
  discriminated `invalid_json` / `invalid_schema` failures. Repair handles
  trailing commas, single quotes and unclosed containers without changing
  string contents or inventing a truncated string. Network retry belongs to
  a later checkpoint and is not performed here.
- 2026-10-22 — CP1, `02_ARCHITECTURE.md` §7.1: the KB loader eagerly imports
  Markdown only from `prototype/intent-kb/` using Vite raw imports, exposes
  plain/tagged section extraction and throws for missing or malformed markers.
  It does not assemble prompts. Custom exercise names are supplied as arguments;
  target resolution does not read storage.

### CP2 engineering decisions — 2026-10-22

- User follow-up: only Xiaomi MiMo `mimo-v2.6-flash` will be used. Their browser
  screenshot shows `https://api.xiaomimo.com/v1` and Connected in 2947 ms on the
  current preview. Set new/corrupt-settings defaults to that endpoint/model only
  after this evidence; retain the three original presets and all saved settings.
  This explicitly revises provider acceptance scope to MiMo P6. Other providers
  stay untested and are no longer prerequisites for this user's CP2 scope.
  Business JSON/text calls and final-origin testing remain untested for later
  checkpoints. No inference of JSON compatibility from the P6 success.

- `AGENTS.md` §2.2 / implementation KB `references/output-schema.md` Code
  contract §4 vs `05_PROMPTS.md` P5: the two documents give different fixed
  correction sentences with the same meaning. Use the higher-priority KB text
  in templates.ts; P6 remains verbatim from the prompt specification. P1–P4
  builders use the implementation KB and prompt specification.
- `02_ARCHITECTURE.md` §6.1 / §4.4: preserve the call API with typed text/JSON
  overloads; add a returned logs array and optional onLog sink for every actual
  request. log is null when a missing key or invalid address prevents a request.
  No synthetic network log is emitted. The Trace builder retains each actual
  returned log, including failures and retries.
- §6.2 specifies common HTTP mappings but not remaining non-success statuses:
  map other HTTP failures to server (the existing fixed network-facing copy),
  retain numeric status, never retry them automatically. Provider codes are
  retained only from a fixed safe allowlist, otherwise null. Error bodies and
  thrown exception messages never leave the client. Redirects fail locally
  rather than forwarding credentials to a redirected destination.
- §4.2 / UI §6: strip surrounding address whitespace and trailing slashes in
  storage and requests; retain an input draft while typing so https:// and path
  separators can be entered normally. Field types/enums are validated on both
  read and write; corrupt/incomplete settings fall back to documented defaults.
  Invalid URL/protocol, credentials, query or fragment return the existing fixed
  network error without a request. No new validation copy or business control.
- UI §6: non-key settings save on change; the key saves on blur. Test connection
  also commits the current key to support keyboard/programmatic activation.
  Presets preserve it. Storage write errors return false without logging settings;
  storage failure notification has no specified copy and is not added here.
- Keep all 211 baseline test cases. App.test.tsx retains both original tests and
  the tab-selection/badge checks; its panel-content assertion now checks the h2
  because Settings has its assigned real content. No CP1 assertions were changed.
- Browser testing required the loopback preview to run outside the sandbox,
  as in CP0. The server still binds only 127.0.0.1:4173; no proxy or network
  configuration was added. No dependencies, lockfile or KB sources were changed.

### CP3 engineering decisions — 2026-10-22

- Architecture §4.1/§4.5: define Session and the final-edit Draft types in
  db/schema.ts for the write boundary. Draft metadata is explicitly stripped.
- Architecture §5.7: expose createSessionsRepo(database) for isolated tests and a
  shared UI instance; SessionsReadRepo exposes reads only. Validate before the
  transaction, snapshot edits before awaiting, re-query the unique date inside
  the transaction, then merge/put. Only UI confirmation handlers invoke saveDraft.
- Record validation returns phase-ordered issues. Parse uses a unique match for
  bodyweight and permits unresolved choices; confirm/save derive from chosen.
  UI §4.2 maps unknown IDs to value and empty custom names to missing.
- Query calculations expose typed data/status results, not chat replies. Optional
  ranges use inclusive local date strings; exercise_last without a range reads
  all supplied history. Unit bucket presence distinguishes no kg data from zero
  kg. Comparison/chart lb conversion is rounded to one decimal; converted volume
  sums unrounded products before Math.round. Stored groups retain original units.
- Seed generation uses the unchanged implementation seed-plan, local Monday and
  19:00 local timestamps. UUID generation follows seed §2.2. loadSeed clears and
  bulk-adds in one transaction; a failed insertion rolls the clear back.
- Data UI uses a dedicated SettingsData component and shared dialog/toast. Busy
  refs prevent rapid duplicate submissions; dialogs trap focus, support Escape
  and backdrop cancellation and restore focus. Toasts expire after three seconds.
  Storage failures use the existing card.saveFailed copy, without error details.
- Preserved all 279 CP0–CP2 tests. The existing CP2 controls-presence test now
  expects Data and Rules controls. No
  baseline case was removed; added 68 CP3 cases in five new test files.
- Browser checks use a new origin (127.0.0.1:4175), synthetic sessions and an empty
  Key, leaving the user's earlier origin/settings untouched. As in CP0/CP2, a
  loopback-only preview outside the sandbox was needed for browser access.

### CP4 engineering decisions — 2026-10-22

- Architecture §4.3/§5: immutable state patches implement record and intent-gate
  transitions. Raw texts/counts change only after successful classification and
  the confidence gate. The raw model slots remain distinct from normalized Draft.
- Architecture §5.4: typed ResumeValue, source IDs and stored RetryAction govern
  continuation. Current-instance/value validation precedes handler invocation;
  replay takes only the source error ID. Generic continuation/dispatch hooks are
  internal extensions. Query and advice handlers use the same instance protocol. Component fixtures also verify structured retry and scope preservation.
- Rules use the persisted setting for pipeline, new Trace and header. Version
  changes preserve messages and all pending context; historical Trace is immutable.
- UI §4.2 / architecture §5.7: ConfirmCard keeps edits in its own message payload
  across Tab remounts. Save performs shared final validation and calls saveDraft;
  synchronous local/per-card locks prevent duplicate writes. Card actions never
  patch clarification context. Date-dependent append content is read reactively.
- UI copy remains centralized; unit/set-type accessibility labels use copy.ts.
  UserMessage/TextMessage render through their small components. CP5 supplies
  DayDetailCard, TrendCard, AdviceCard and DebugDetails render their typed payloads.
- Node 20.20.2 uses the existing npm cache binary, without installing or upgrading
  dependencies. Browser checks use bundled Playwright and installed Chrome in a
  fresh context, a synthetic key and intercepted provider responses. The preview
  is loopback-only. No real settings or key are read by verification tooling.

### CP5 engineering decisions — 2026-10-22

- Implementation KB query Code contract / architecture §5.5: replies.ts owns
  query validation, structured clarifications and display templates, reusing CP3
  calculations, resolveTime and resolveExerciseTarget without changing them.
  Resume passes standard/custom target directly; custom identity is never rematched.
  Pending originalUserText/createdAt survive repeated slot questions.
- UI §4.5 / architecture TrendPayload: retain periodLabel separately from the title
  rangeLabel so insufficiency copy can use “in the last 8 weeks”. Display-period
  literals and the SVG accessible label live in copy.ts. ChartMode is UI-local.
  Empty/invalid numeric series render no SVG; one date centers its point. Valid
  series use date-proportional x, finite padded y bounds and native focusable titles.
- P3 follows 05_PROMPTS.md verbatim, with cleanQuotes applied recursively to its
  data. Only calculated series/summary are sent; no chat, notes or raw record text.
  Plain-text cleanup preserves decimals, removes Markdown markers and caps at four
  sentences. Failures retain deterministic payloads and the unavailable copy.
  No P3 post_check or factual-validation claim is generated.
- Architecture §5.4 / Trace: the continuation wrapper returns each handler's
  completed Trace, scrubbed without replacing its fields. Typed resumes retain
  the entry safety-regex step. Every actual response.logs entry is retained,
  including failed P3, JSON retry and JSON-mode fallback requests.
- Preserved the 450 CP0–CP4 tests. The CP4 query-placeholder test now verifies
  the implemented time question, while retaining old-draft clearing, zero count
  and no-write checks. New CP5 tests cover the query rows of §2.12 and §2.18.
- No persisted settings, Key, implementation/frozen KB, seed-plan, dependency or
  lockfile changes. Query tooling uses synthetic keys,
  fake fetch and isolated Chrome, never the user's browser profile.

### CP6 engineering decisions — 2026-10-22

- Advice data preparation reuses CP3 exercise sessions, best/top-set comparison,
  set totals, the calendar resolver, display formatters and customKey identity.
  Sufficiency includes pure bodyweight days; weighted summaries retain nulls.
  Body-part recency uses calendar-day differences to avoid DST elapsed-hour drift.
- P4 templates follow 05_PROMPTS.md P4.1–P4.4 verbatim, with one shared builder
  and recursive quote cleaning. Non-data requests omit the entire training block.
  General knowledge returns before any repository access.
- Advice handlers preserve originalUserText and createdAt through target questions;
  model user_question is debug metadata only. Existing resume validation/retry owns
  allowed targets, including typed custom values absent from the original options.
- Trace belongs to each operation: the initial message retains classification and
  P5/fallback logs; each continuation/retry retains its resume path and all P4 logs,
  including failure. No wrapper replaces these with an outer empty Trace.
- P4.6 flags check only specified substrings in Where you are. They remain Trace
  metadata and never rewrite or annotate the card. Required-heading mismatch is
  also Trace-only. This is not comprehensive fact checking or safety enforcement.
- AdvicePayload includes a discomfort boolean so the card separates only the exact
  program-appended sentence as amber; any model warning remains ordinary body text.
  Rendering supports only prescribed headings, lists and paragraphs, using React
  text escaping. All existing UI copy and the shared soft-pain helper are reused.
- Completed operations mark older error message IDs consumed through the existing
  usedRetries state. This enforces the same expiry for direct text errors as for
  structured continuation errors. Busy and source-message checks remain unchanged.
- Rules v1, settings, Key, dependencies, lockfile, safety rules, seed plan and both
  KB copies remain untouched. No real provider call was made by the agent.

### CP7 engineering decisions — 2026-10-22

- User resolved the missing version-switch event in architecture §4.3 / UI §6:
  preserve every message and pending draft/resume/counter/instance. Settings only
  persists its selected field and emits a payload-free local event for the badge;
  each operation snapshots settings and historical traces retain their version.
- P2 uses the implementation KB's tagged risk-check section and shared schema,
  client, repair, one JSON retry and JSON-mode downgrade. v1/v2 reuse P1/P3/P4;
  v2 differs only by P2. No regex, softPain, KB or seed-plan edits were made.
- Risk rejection (including fail-closed) clears all four context fields. Configuration
  errors retain the current processing scope; a non-slot new request cannot restore
  its already discarded resume after error. Valid resumes bypass P2/P1.
- The debug panel uses each message's completed Trace. Logs represent actual HTTP
  attempts, including failures, downgrade and retry. Continuations/retries own fresh
  call arrays; initial messages keep their classification/P2 logs without recounting.
- Trace exports and debug rendering recursively scrub strings; client logs and returned
  model content are scrubbed. Current-key replacement also handles its JSON-escaped
  form in data blocks. Error bodies are discarded; only allowlisted metadata remains.
- Debug copy captures sanitized request messages, raw output, test rows or full Trace;
  confirmations last 1500ms. Test-row summary caps before Markdown pipe escaping.
  showDebug=false omits the component entirely. Isolated browser clipboard writes
  are captured by a page shim, leaving the system clipboard untouched.
- Preserve all 620 baseline tests. Update only stage-fixed badge/Rules assertions,
  keep explicit v1 business tests and narrow one existing paragraph selector so
  debug path text does not duplicate its match. CP7 minimum requirements and new
  tests, Node 20 checks, browser evidence and user P2 steps: verification/CP7.md.
- The user reported all five real P2 functional checks passed on 2026-10-22.
  Full §3 assignment repetitions remain outstanding. Prior P6,
  recording/query and five P4 user passes are separate evidence. No CP8/CP9 work,
  real-provider calls, credentials access, commit, push or deployment.

### CP8A delivery preparation — 2026-10-22

- User authorizes CP8A preparation only: no Git initialization, commit, push, remote
  creation, deployment or CP9. CP8 deployment/final-origin acceptance remains open.
- Choose a single-app repository: selected prototype/ contents become repository root.
  Workflow stays at .github/workflows/deploy.yml in that final root; npm ci and all
  gates run there against package-lock.json; Pages uploads ./dist. No assignment-root
  materials or frozen KB are included. Exact scope: delivery/release-files.txt and
  release-manifest.json; default scope excludes all verification/ and actual testing/.
- Node 20.20.2, npm ci, test, typecheck, lint, build are sequential gates; deploy
  needs build, main only, least job permissions, github-pages environment, pages
  concurrency with cancel-in-progress=false. User Keys never become build variables
  or GitHub Secrets. Vite base='./' and no-proxy configuration remain unchanged.
- Architecture §10's free Gemini Key instructions/three-provider requirement are
  superseded by the user's MiMo-only scope. README documents actual editable MiMo
  fields and source-specific evidence; other presets stay untested and optional.
  No current free-access or availability claims, and no local-to-online inference.
- Replace implementation-history README with examiner instructions. Keep historical
  decisions here and detailed local evidence in verification/. Prepare screenshot
  steps, 26 main + 96 repeated unrun case slots, environment and statistics templates.
  Existing P2 feedback is separate from complete §3 experiments.
- Browser QA uses a fresh context, synthetic settings, fixed Sydney clock, local
  4181 origin and intercepted model replies. Screenshots visibly say synthetic/not
  assignment evidence. Six screenshot categories plus History/Settings are reachable.
  Restore synthetic samples after the append demo before trend/advice checks.
- New checks validate workflow structure, allowlist, artifact, blank template counts
  and protected-file hashes outside Vitest; no product text tests added. Original
  33 test files/738 cases retained. Local script selectors were corrected to existing
  Cable Fly / Saved ✓ copy; no product code or policy was changed.
- Report: verification/CP8A.md. Genuine final-origin checks and publication require
  target repository, scope and explicit submission/push/deploy authorization.

## Known issues

- 2026-10-22 — CP8A preparation only. Final Pages origin, GitHub Actions execution,
  source-specific MiMo CORS/P6/P1/P2/P3/P4 checks, actual screenshots and full §3
  repetitions remain untested. Development-dependency findings below are retained
  historical audit results, not a new CP8A audit. No safety-policy fix or CP9 work.


- 2026-10-22 — MiMo P6 passed per user screenshot. The user subsequently reported
  all three CP4 checks successful at http://127.0.0.1:4173/: complete record,
  incomplete record followed by 3x8 continuation, and fly candidate selection.
  Record these as user-reported real business-flow evidence, independently of
  automated and fake-browser evidence. Real timeout/P5 recovery, JSON fallback,
  truncation, other providers and final origin remain untested. CP5 P3 additionally
  has user-reported real MiMo functional success, as recorded below.
- 2026-10-22 — CP5 user screenshots at the same page origin show the time question,
  a single weighted bench date (22 Oct, 60 kg × 8), and press candidate selection
  completing into the one-point insufficient-data card with old options disabled.
  These confirm visible clarification/insufficiency behavior, without showing the
  This month completion, network call counts or P3 in those initial screenshots.
- 2026-10-22 — After receiving three dated bench test inputs and follow-up steps,
  the user reported other checks normal, then confirmed typed This month with
  “没有问题”. Record CP5 trend/chart switch/P3, exercise-candidate and typed-time
  continuation as user-reported passed at http://127.0.0.1:4173/, using the existing
  MiMo configuration. No network logs or independent per-value P3 audit collected.
  CP5 accepted. These user feedback records did not change runtime/settings/data.
- CP7 automated and isolated-browser checks cover full-pipeline traces, copy exports,
  Key redaction and v2 execution. The user reported five real P2 functional passes. Full assignment
  testing and repeated v1/v2 measurements are separate and have not been performed.
- 2026-10-22 dependency audit: 12 affected development dependency packages
  (4 moderate, 6 high, 2 critical); `npm audit --omit=dev` reports 0.
  Affected tool chains include Vite/esbuild, Tailwind's glob/parser dependencies,
  and Vitest's mocker/tinypool dependencies. npm proposes major upgrades for
  Vite, Tailwind and Vitest; those conflict with the prescribed Vite 5 and
  Tailwind 3 stack. Keep the mandated majors and document the risk; do not
  run `npm audit fix --force` or force incompatible transitive overrides.
  The local server is bound to loopback and tests use single-run mode.
  Major toolchain changes require a separately approved architecture update.
  Advisory examples:
  https://github.com/advisories/GHSA-fx2h-pf6j-xcff,
  https://github.com/advisories/GHSA-5gmw-xhrv-c9v3,
  https://github.com/advisories/GHSA-82fw-gwwq-j7x9.
- npm marks ESLint 9.39.5 as no longer supported. It remains compatible with
  this scaffold; the lint command itself completes with 0 errors and warnings.

- 2026-10-22 — CP1: the documented v1 regex weaknesses remain intentional in
  both versions. The shared soft-pain helper is not a blocking rule. No new
  safety-policy weakness or document conflict was identified.
- 2026-10-22 — CP1: no dependencies or lockfile were changed. The dependency
  findings above are the CP0 audit baseline; CP1 did not rerun the network audit
  and does not claim that the older counts are a fresh audit result.

- 2026-10-22 — After the five real MiMo P4 prompts and acceptance criteria, the
  user reported all checks passed, including the requested fact-pairing and
  medical-boundary checks. This is user-reported evidence at the existing 4173
  origin; no new screenshots, audit details or network Trace were supplied.
  Real error recovery remains separately unverified. See verification/CP6.md.
  CP6 is accepted; no user storage or credentials were read by the agent.

- 2026-10-22 — After the five P2 prompts and acceptance criteria, the user replied
  “全部通过”. Register ordinary record allowance, sore training-permission blocking,
  destructive synonym blocking, soreness-note record allowance and technique advice
  allowance as user-reported passed at the existing 4173 origin. No new screenshots,
  per-case risk/confidence values or real Trace were supplied. No independent claim
  of HTTP counts, real fallback/retry or complete safety assessment. CP7 accepted;
  no CP8/CP9 work. This update touches documentation only and does not rerun checks.

## Deviations

CP8A: user explicitly splits preparation from CP8 actual publication; only preparation
can be called complete. README replaces free Gemini onboarding and mandatory other-provider
acceptance with the approved MiMo-only scope. No product-behavior deviation. CI workflow is
prepared and structurally checked but has not run on GitHub. Real credentials/data were not
read or changed; no dependency/lock/spec/KB edits. See verification/CP8A.md.


CP7: no product behavior deviation. Version-switch context preservation is the
user's explicit resolution of an unspecified state-table event. Prompt sets use
existing typed request builders (including schema/options), rather than a new
messages-only wrapper; runtime prompts and request parameters follow the spec.
Implementation, automatic checks and isolated browser evidence are complete;
real P2 functional acceptance is user-reported passed; full assignment repetitions
and final-origin evidence remain outstanding. CP7 accepted; stop at CP7.


CP6: no behavior deviation. AdvicePayload adds display metadata as described above.
CP6 automated, isolated-browser and user-reported real P4 acceptance are complete.



CP5: no query-behavior deviation. Real MiMo P3 functional checks passed according
to the user's feedback. Verification/CP5.md distinguishes automatic, fake-browser and real evidence.

CP4: no recording-behavior deviation. Saved settings are preserved. The user reported the three listed real MiMo CP4 classification/continuation/candidate checks successful; this evidence is distinct from fake-browser verification. Untested provider/error branches remain unverified.


CP3: no behavioral deviation. Engineering API choices and baseline test assertion
adaptation are documented above. No KB, seed plan, dependencies or lockfile changes.


CP2: the user's follow-up revises provider scope to MiMo only and authorizes its
verified endpoint/model as default. Other providers remain untested. Engineering
details and prompt-wording precedence are recorded in Decisions above.

CP1: none. Current-year formatters receive `now` explicitly to comply with
`AGENTS.md` §4.1. No new UI or business flow was introduced.

CP0: test versions are selected for compatibility with the prescribed Vite/Node
majors, as explicitly required by the CP0 task.





- 2026-10-22: Release tests are self-contained. copy.test.ts keeps a fixed snapshot of the specified UI copy; the public repository does not depend on assignment-only prototype-docs files. All existing assertions remain.


- 2026-10-22: Published approved files to https://github.com/InformationDS/liftlog-coach and GitHub Pages at https://informationds.github.io/liftlog-coach/. Remote CI passed 738 tests and all gates. Final-origin MiMo acceptance, formal screenshots and the complete assignment experiment remain pending; isolated browser fixtures do not establish provider compatibility.

- 2026-10-22: User reported all seven final-origin acceptance steps passed at https://informationds.github.io/liftlog-coach/, covering MiMo P6/P1/P2/P3/P4, explicit record save/query and v1 regex refusal. Registered as user functional feedback; no per-case screenshots/traces received. Formal screenshots and the 122-case assignment experiment remain pending; no CP9 changes.
