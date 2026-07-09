# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev     # Next.js dev server on :3000
npm run ws      # WebSocket ASR proxy on :3001 — REQUIRED for the practice page
npm run build
npm run lint
```

`dev` and `ws` are two separate processes. The practice page connects to a hardcoded `ws://localhost:3001`; without `npm run ws` running, recording fails with "语音识别连接失败".

There is no test framework in this repo — `lint` is the only automated check.

### Environment

`.env.local` (gitignored, not present in a fresh clone):

- `DASHSCOPE_API_KEY` — Aliyun DashScope, for speech recognition. `ws-proxy.mjs` exits immediately if unset.
- `DEEPSEEK_API_KEY` — for report generation. If unset, `/api/report/generate` silently returns a fallback report instead of failing, so the app runs end-to-end without it.
- `WS_PROXY_PORT` — defaults to 3001.

`ws-proxy.mjs` parses `.env.local` by hand (it's a plain Node process, not Next), so variables must live in that exact file.

## Architecture

A Next.js 16 app. One user flow: pick a mode + upload a script (`/`) → record while 6 coach avatars watch (`/practice`) → get a scored report (`/report/[id]`) → browse history (`/records`).

### Speech pipeline

Browsers can't set an `Authorization` header on a WebSocket, which is why `ws-proxy.mjs` exists as a standalone process rather than a Next route.

`getUserMedia` → `public/pcm-processor.js` (AudioWorklet: downsamples to 16 kHz, converts Float32 → Int16, posts a transferable ArrayBuffer) → binary WS frames → `ws-proxy.mjs` → Aliyun Paraformer `realtime-v2` over duplex streaming.

The proxy translates between two protocols: browser sends binary PCM plus a `{type:"finish"}` text message; proxy speaks DashScope's `run-task`/`finish-task` envelopes and emits `ready` / `result` / `finished` / `error` back. Audio only starts flowing after `ready` (the worklet is connected in the `ready` handler, not at record time). On `finish`, the practice page awaits a final `finished` event with a 15s timeout before writing the transcript.

Pausing does not tear down the socket — `isPausedRef` just stops forwarding audio frames.

### Scoring (7-agent architecture)

One DeepSeek call (`deepseek-chat`, `response_format: json_object`) drives all 7 personas — 1 overall reviewer + 6 dimension coaches — via a single large system prompt in `src/app/api/report/generate/route.ts`.

**`COACH_WEIGHTS` in that route is the single source of truth for scoring.** Coaches return a raw 0–100 integer per dimension; the server converts each to a weighted score (`raw/100 × weight`) in `normalizeCoaches()` and sums them into `totalScore`. The model is explicitly told *not* to return `totalScore`, `percentile`, or `maxScore` — earlier versions trusted the model's own arithmetic and no longer do. To rebalance dimensions, edit `COACH_WEIGHTS` and the weight percentages quoted in the system prompt.

Two rubrics swap based on `practiceCount` (prior completed practices, sent from the client): the first 3 practices get `RUBRIC_GENTLE` to protect a user's confidence, then `RUBRIC_STRICT` with hard anchors. Both rubrics carve out an exception: device tests, chit-chat, and empty content always score below 20.

`percentile` is computed client-side in `mock-api.ts` against the user's own local history ("你超过了自己 X% 的历史练习"), and is `null` on the first practice — the report page hides the row rather than rendering a fake number.

The route never fails. Missing API key, non-200 from DeepSeek, and empty completions all fall through to `generateFallbackReport()` with a `_fallback: true` marker on the response.

### Persistence

There is no database. Everything lives in `localStorage`, written through `src/lib/mock-api.ts`: `speakcoach_user`, `speakcoach_records`, `speakcoach_reports`, and `speakcoach_file_<practiceId>` (script contents, stored separately because they're not part of the `PracticeRecord` type). `@supabase/supabase-js` is in `package.json` but nothing imports it yet.

Auth is a mock. `/api/auth/send-otp` stores `base64(phone:code:expiry)` in an httpOnly cookie and returns the code as `devCode` outside production; `verify-otp` compares against it and sets a `speakcoach_auth` cookie.

`src/proxy.ts` is Next 16's replacement for middleware. It currently computes the protected-route match and then **passes everything through** — the redirect is commented out pending Supabase. The real gate is the client-side `useRequireAuth()` hook.

### State

`src/stores/app-store.ts` (Zustand, not persisted) holds ephemeral practice state. `practiceId` is set on `/` before navigating to `/practice`, and reaches `/report` as a route param. Reports are cached: revisiting a report loads from `localStorage` rather than regenerating, so an old practice keeps its original evaluation.

## Gotchas

- `src/lib/reviewers.ts` still carries **stale V1 values** — the old max scores (25/20/20/15/10/10) and the old `optimizer` role name "优化潜力" (now "整体成稿度"). Only `avatarChar`/`name`/`role` are actually rendered, from the `REVIEWERS` alias used to draw the coach panel on `/` and `/practice`. `COACH_MAX_SCORES` and `calcTotalScore` are dead. Never read scoring weights from this file.
- `normalizeCoaches()` emits coaches in a fixed order regardless of what the model returns, backfilling any the model omits.
- The report page reads `maxScore` off the *report data* (server-computed weights), not off `reviewers.ts`.
