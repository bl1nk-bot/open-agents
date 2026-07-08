# Consolidation Backlog

Structured task breakdown for `docs/agents/consolidation-plan.md`, ready to
convert 1:1 into GitHub Issues once Issues is enabled on this repo
(**Settings → General → Features → Issues** — repo owner action, not
available through the API used here). Each entry below is a future issue:
title, milestone, labels, description, and verification steps.

**Milestones** (one per phase): `Phase 0 — Stabilize`, `Phase 1 — eve + Connect + Sandbox`,
`Phase 2 — Board`, `Phase 3 — Story vertical`, `Phase 4 — Skills addon`, `Phase 5 — Deferred`.

**Label scheme:**
- `phase:0` … `phase:5` — which milestone
- `priority:p0` (blocking, do first) / `p1` (core) / `p2` (addon/deferred)
- `area:sandbox` / `area:auth` / `area:eve` / `area:web` / `area:story` / `area:skills`
- `type:fix` / `type:build` / `type:spike` / `type:rebuild` / `type:port`

---

## Phase 0 — Stabilize the base

### 0A — Turn on exfiltration defense
**Milestone:** Phase 0 · **Labels:** `phase:0` `priority:p0` `area:sandbox` `type:fix`
Currently disabled at `api/sandbox/route.ts:247` pending a "solid" strategy. Every new persona in Phase 1+ shares this sandbox, so this has to close first.
**Verification:**
- [ ] `pnpm run ci` green
- [ ] Manual: attempt the previously-known exfiltration path against a test sandbox session and confirm it's blocked
- [ ] No regression in existing sandbox exec/file tests (`bun test`)

### 0B — Fix git-clone-into-nonempty-dir edge case
**Milestone:** Phase 0 · **Labels:** `phase:0` `priority:p0` `area:sandbox` `type:fix`
`packages/sandbox/vercel/sandbox.ts:578`. Session creation will get more frequent once Board (Phase 2) and story workspace (Phase 3) exist.
**Verification:**
- [ ] Add a regression test that clones into a pre-populated directory and asserts a clean error or merge instead of a crash
- [ ] `bun test packages/sandbox` passes

### 0C — Fix ~130ms skills-load bottleneck
**Milestone:** Phase 0 · **Labels:** `phase:0` `priority:p0` `area:web` `type:fix`
`api/chat/_lib/runtime.ts:24`. Gets worse once eve loads tool-packs for multiple personas at once.
**Verification:**
- [ ] Add a timing assertion/benchmark in the test suite showing load time under an agreed threshold with 5+ skills loaded
- [ ] `pnpm run ci` green

---

## Phase 1 — eve Agent Runtime + Vercel Connect + Sandbox providers (main work)

### 1.0 — Provision Vercel Connect connectors + new sandbox providers
**Milestone:** Phase 1 · **Labels:** `phase:1` `priority:p0` `area:auth` `area:sandbox` `type:build`
Run `vercel connect create github|craft.do|mcp.<server>|daytona|modal.com`. Add `packages/sandbox/daytona/` and `packages/sandbox/modal/` implementing the existing `Sandbox` interface.
**Verification:**
- [ ] `vercel connect create <service>` succeeds for all 5 connectors and each shows up in `vercel connect ls` (or dashboard)
- [ ] `getToken()` returns a valid token for each connector in a throwaway test script
- [ ] Daytona/Modal implementations pass the same interface contract test suite the Vercel Sandbox implementation uses

### 1A — Scaffold apps/agent-runtime
**Milestone:** Phase 1 · **Labels:** `phase:1` `priority:p0` `area:eve` `type:build`
`pnpm dlx eve@latest init` (pnpm's npx equivalent, per this repo's pnpm-only convention), wired into `pnpm-workspace.yaml`/`turbo.json`, with its own CI job.
**Verification:**
- [ ] `turbo build --filter=agent-runtime` succeeds
- [ ] New CI job runs and is green on a trivial commit
- [ ] `pnpm run ci` at the repo root still passes unaffected

### 1B — Wrap existing tools as defineTool
**Milestone:** Phase 1 · **Labels:** `phase:1` `priority:p0` `area:eve` `type:port`
bash/read/write/edit/grep/glob call `packages/sandbox` directly; Craft.do/MCP/GitHub-OAuth-touching tools call `@vercel/connect`'s `getToken()`.
**Verification:**
- [ ] Each ported tool has a test exercising the underlying sandbox/connect call
- [ ] No tool file imports a third-party SDK directly except through `packages/sandbox` or `@vercel/connect`
- [ ] `bun test packages/agent` (or its eve equivalent) green

### 1C — Define coding-agent persona
**Milestone:** Phase 1 · **Labels:** `phase:1` `priority:p0` `area:eve` `type:port`
Port model routing from `packages/agent/models.ts` (AI Gateway) and `system-prompt.ts` into a `defineAgent` config.
**Verification:**
- [ ] Manual: start a session against `coding-agent` and confirm it selects the expected default model (`anthropic/claude-opus-4.6`) via AI Gateway
- [ ] Existing model-selection tests pass against the new persona config

### 1D — Spike subagent pattern on eve
**Milestone:** Phase 1 · **Labels:** `phase:1` `priority:p0` `area:eve` `type:spike`
eve's docs don't describe subagents directly. Determine whether nested sessions or separate `defineAgent`s calling each other via the session API is the right shape for explorer/executor/design.
**Verification:**
- [ ] Written spike note (in this backlog or a linked doc) stating the chosen approach and why
- [ ] A working proof-of-concept: `coding-agent` successfully delegates one task to a subagent and gets a result back

### 1E — Wire chat UI to eve's session API
**Milestone:** Phase 1 · **Labels:** `phase:1` `priority:p0` `area:web` `area:eve` `type:rebuild`
Replace the Workflow SDK call in `apps/web/app/workflows/chat.ts` with `POST /eve/v1/session` + `GET /eve/v1/session/<id>/stream`.
**Verification:**
- [ ] Manual: send a chat message end-to-end in the web UI and see a streamed response sourced from eve
- [ ] Existing chat streaming tests pass (or are updated to target the new endpoint)

### 1F — Demote workflowRuns/workflowRunSteps to an index
**Milestone:** Phase 1 · **Labels:** `phase:1` `priority:p0` `area:web` `type:rebuild`
No longer the source of truth for execution state — eve Agent Runs is.
**Verification:**
- [ ] `db:check` shows no drift after the schema/usage change
- [ ] A session's status shown in the UI matches what `list_agent_runs`/`get_agent_run` reports for the same run

### 1G — Move sandbox lifecycle hooks to eve tool functions
**Milestone:** Phase 1 · **Labels:** `phase:1` `priority:p0` `area:eve` `area:sandbox` `type:rebuild`
`sandbox-lifecycle.ts`, `sandbox-provisioning.ts` called from eve tool functions instead of Workflow SDK steps.
**Verification:**
- [ ] Manual: a session's sandbox correctly provisions, hibernates on inactivity, and resumes from snapshot under the new call path
- [ ] Existing lifecycle tests pass or are updated

### 1H — Adapt existing test suite to eve session API
**Milestone:** Phase 1 · **Labels:** `phase:1` `priority:p0` `area:eve` `type:rebuild`
The ~104 existing tests that target Workflow SDK internals need to target the eve session API instead.
**Verification:**
- [ ] `pnpm test:verbose` green with the same or greater test count as before Phase 1
- [ ] CI fully green end-to-end (lint, typecheck, test, `db:check`)

---

## Phase 2 — Board view (agent-kanban UX)

### 2A — Data source: eve list_agent_runs + GitHub PR data
**Milestone:** Phase 2 · **Labels:** `phase:2` `priority:p1` `area:web` `type:build`
No new data model — join eve Agent Runs with existing `githubInstallations`/PR data.
**Verification:**
- [ ] A test query returns a joined view of at least one run + its associated PR (if any) with correct status

### 2B — List/Board toggle on /sessions
**Milestone:** Phase 2 · **Labels:** `phase:2` `priority:p1` `area:web` `type:build`
Grouped by status/repo/date, with filters (with-artifacts / PR / recently-active), built on existing components.
**Verification:**
- [ ] Manual: toggle between List and Board views on `/sessions`, confirm grouping and each filter changes the visible set correctly
- [ ] Component tests for the new Board view pass

### 2C — Artifact preview via existing endpoints
**Milestone:** Phase 2 · **Labels:** `phase:2` `priority:p1` `area:web` `type:build`
Reuses `api/sessions/[sessionId]/{diff,files}` directly — no proxy-fetch layer like agent-kanban's.
**Verification:**
- [ ] Manual: open an artifact preview from the Board view and confirm it renders the same diff/file content as the existing session detail page

---

## Phase 3 — Story vertical (studio-mcp/core)

### 3A — Move StoryGraph schemas to packages/story
**Milestone:** Phase 3 · **Labels:** `phase:3` `priority:p1` `area:story` `type:port`
**Verification:**
- [ ] `turbo typecheck --filter=story` passes
- [ ] Existing Zod schema tests from studio-mcp/core pass unchanged against the new package location

### 3B — Wrap 11 granular tools as defineTool for story-agent
**Milestone:** Phase 3 · **Labels:** `phase:3` `priority:p1` `area:story` `area:eve` `type:port`
**Verification:**
- [ ] Each of the 11 tools has a passing test with representative input/output
- [ ] Manual: run `analyze_story` end-to-end against a sample text through the `story-agent` persona

### 3C — Move exporters to packages/exporters
**Milestone:** Phase 3 · **Labels:** `phase:3` `priority:p1` `area:story` `type:port`
**Verification:**
- [ ] Each exporter (mermaid/canvas/dashboard/markdown/csv) has a snapshot test
- [ ] Both the story-agent tool and a web download endpoint successfully produce output from the same shared package

### 3D — New /workspace page in apps/web
**Milestone:** Phase 3 · **Labels:** `phase:3` `priority:p1` `area:web` `area:story` `type:build`
References the view concepts from desktop/ide but built fresh on Next.js — not the unwired Tauri skeleton.
**Verification:**
- [ ] Manual: open `/workspace` for a story-agent session, confirm at least the Editor and one visualization view render real data
- [ ] No dependency on `@bl1nk/desktop` or `@bl1nk/ide` packages

---

## Phase 4 (addon) — Skills/Curator via skills.sh

### 4.1 — System Skills vs. User Skills tiers + ask-user-question gated install
**Milestone:** Phase 4 · **Labels:** `phase:4` `priority:p2` `area:skills` `type:build`
See `docs/agents/consolidation-plan.md` Phase 4 section for the full design (two tiers, three ingestion sources, single install gate).
**Verification:**
- [ ] Manual: trigger a skill suggestion from skills.sh, confirm `ask-user-question` fires with audit info attached, and confirm/deny both work as expected
- [ ] A skill installed via User Skills is available in the next session without re-installing

---

## Phase 5 (deferred) — Craft.do workspace + GitHub→Notion sync

### 5.1 — Craft.do workspace integration
**Milestone:** Phase 5 · **Labels:** `phase:5` `priority:p2` `area:auth` `type:build`
Only build if there's real demand. Requires the `craft.do` Vercel Connect connector from 1.0.

### 5.2 — Real GitHub→Notion sync
**Milestone:** Phase 5 · **Labels:** `phase:5` `priority:p2` `type:build`
`studio-mcp/sync` is 100% stub today (`fetchFileContent()` returns empty, Notion calls are `console.log` TODOs, HMAC check is fail-open). Needs a real implementation, not a port, if ever revived.
**Verification:**
- [ ] A test push to a connected repo results in an actual Notion database row being created/updated
- [ ] HMAC verification rejects requests when the webhook secret is unset (fail-closed, fixing the current bug)
