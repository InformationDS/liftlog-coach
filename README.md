# LiftLog Coach

A browser-based strength-training log for the UNSW INFS5706 prototype assignment.
AI prepares drafts and advice; you review and explicitly save records. Training
statistics are calculated by code from your local records.

**Online app: pending publication — not deployed.** No submission URL is available yet.

## Run locally

1. Use **Node 20.20.2** (see `.nvmrc`) and open a terminal in the app directory
   (`prototype/` in the assignment workspace; repository root in the proposed release).
2. Run `npm ci`.
3. Run `npm run dev` and open [the local app](http://localhost:5173).

On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`. Validate with
`npm run test`, `npm run typecheck`, `npm run lint`, then `npm run build`, in order.
After building, run `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort`
and open [the build preview](http://127.0.0.1:4173/).

## Connect Xiaomi MiMo

MiMo is the selected acceptance provider. Obtain your own API access through the
provider; this project does not supply a Key or promise free access.

1. Open **Settings → AI model**. Set API address to `https://api.xiaomimo.com/v1`
   and model to `mimo-v2.6-flash`. These are defaults for new settings.
   Existing settings are preserved. MiMo uses the editable fields; the other
   provider preset buttons are not a MiMo selector.
2. Enter your own Key in **API key**, then leave the field to save it. Other
   settings save when changed. **Test connection** also saves the current Key.
3. Press **Test connection** and check the visible result. Success tests a short
   text request only; it does not establish JSON classification, risk checking,
   trend or advice compatibility. The browser calls `/chat/completions` directly;
   there is no proxy or backend.

## Try the app

Use a separate browser profile for synthetic samples if you have personal records.
**Load sample data replaces existing training records after confirmation.**

1. In **Settings → Data**, choose **Load sample data**. The fictional plan covers
   recent weeks and ends before today. Inspect dates and exercises in **History**.
2. In **Chat**, enter `Bench press 60kg 4x8, incline dumbbell fly 15kg 3x12`.
   Enter sends; Shift+Enter adds a newline. Answer any missing-field question.
   Review the date, exercises, units, sets, reps and notes on the confirmation card.
   Amber fields marked ≈ were inferred; edit them to confirm. Choose an exercise
   candidate if needed. Only **Save** or **Add to session** writes the record.
   **Discard** leaves training data unchanged. If that date already exists,
   inspect the append notice and **Show** before adding.
3. Ask `How many times did I train this week?` and `Is my bench press improving?`.
   Answer a time or exercise question if asked. Trends need three weighted dates;
   with sufficient data, switch **Top set / Volume**. Figures come from code;
   the separate model interpretation can be wrong or unavailable.
4. Ask `My squat has been stuck at 100kg, what should I do?` for data-based advice,
   or `What rep range is good for strength?` for general knowledge. Check **Based
   on your data** versus **General advice — your training data was not used**.
   Insufficient history produces general advice. Check personal claims against History.
5. Open **Settings → Rules** to select **v1** or **v2**. The header badge updates
   immediately. v2 adds AI risk screening to the shared regex rules. Switching
   preserves messages and pending work; refresh starts a new chat and keeps records
   and settings. Existing false positives and missed phrases remain experiment subjects.
6. Enable **Settings → Developer → Show debug panel**, then expand a reply's
   **Details**. Inspect version, path, actual calls, requests, raw outputs,
   latency and flags. Use **Copy as test log row** or **Copy full trace JSON**.
   Copy separate traces for multi-turn interactions. Review copied training content
   before sharing; a short test row is not a complete answer or evidence record.

History expands each date and supports deleting an entire date after confirmation.
Settings can export Sessions as JSON or clear training data after confirmation.
These operations retain AI settings and the Key. Export excludes settings, Key and chat.

## Without a Key

You can load and inspect samples, view/delete existing History, export/clear data,
change settings/rules, and try deterministic regex refusals such as `My knee hurts,
can I still squat today?` (zero model calls). Ordinary natural-language recording,
query classification, trend interpretation, advice and v2 AI risk checks require
a Key. There is no manual record-entry or offline model mode.

## Provider compatibility and evidence

Results are separated by page origin. Dates below are 2026-10-22. User feedback is
functional evidence, not an independent audit of complete responses or request counts.

| Provider / model | Page origin | Test connection (P6) | Classification / recording / query | v2 risk (P2) | Trend text (P3) | Advice text (P4) | JSON-mode fallback / truncation; safe error |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MiMo / mimo-v2.6-flash | `http://127.0.0.1:4173` | Passed, user screenshot, 2947 ms | Passed, user feedback | Five functional cases passed, user feedback; no per-case Trace | Passed, user feedback | Five functional checks passed, user feedback | Untested / untested; no failure reported |
| MiMo / mimo-v2.6-flash | Final submitted origin: pending | Untested | Untested | Untested | Untested | Untested | Untested / untested; none collected |
| OpenAI / gpt-4o-mini | None tested | Untested | Untested | Untested | Untested | Untested | Untested / untested; none collected |
| Google Gemini / gemini-2.5-flash | None tested | Untested | Untested | Untested | Untested | Untested | Untested / untested; none collected |
| DeepSeek / deepseek-chat | None tested | Untested | Untested | Untested | Untested | Untested | Untested / untested; none collected |

Other presets are optional and untested; they are not required acceptance items.
No availability or price claim is made for them. Local MiMo passes do not verify
CORS at a future Pages origin. Automated tests and intercepted model fixtures do
not establish real-provider compatibility. Real fallback, truncation, recovery and
the full repeated assignment experiment remain unverified. Use
[the experiment kit](delivery/ASSIGNMENT_TEST_KIT.md) to collect real evidence.

## Storage, privacy and limitations

The Key is stored in browser **localStorage** under `liftlog.settings.v1`, not
encrypted. It is sent in the Authorization header only to the configured API
address. Never paste it into chat, screenshots, exports, source files, build
variables or GitHub Secrets. To remove it, empty **Settings → API key** and leave
the field; clearing training data does not remove the Key. Consider a temporary Key.

localStorage is isolated by **origin, not URL path**. Pages projects under one
`<user>.github.io` share an origin and may access the same storage. Localhost,
127.0.0.1 and different ports are separate origins. Training records live in
IndexedDB (`liftlog`); chat and debug traces are held in memory and clear on refresh.
Use JSON export for your own backup before clearing browser site data. A new
origin has separate data/settings; publication does not migrate them automatically.

There is no telemetry. Model requests send the current input and the task's needed
draft or computed training data directly to your provider; inspect **Details** for
the actual request. Provider error bodies do not enter traces or exported logs.
Debug copies redact Key patterns but still contain user text and training content.

This is a university prototype, not a medical service. AI can misinterpret training
or give incorrect advice. Check every draft and factual claim. Safety screening is
limited; seek qualified medical advice for pain or health concerns.

For publication scope, pending deployment checks and retained development-tool
risks, see [release preparation](delivery/RELEASE_PLAN.md) and [NOTES](NOTES.md).
