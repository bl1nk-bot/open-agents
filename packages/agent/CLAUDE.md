# packages/agent (@open-agents/agent)

The agent runtime. Builds the `openAgent` `ToolLoopAgent` (from the `ai` SDK) that drives coding sessions, routes model calls through Vercel AI Gateway, and loads skills/subagents on demand.

## Key files

- `open-agent.ts` — the `ToolLoopAgent` definition and tool set (bash, read, write, edit, grep, glob, task, todo, skill, fetch, ask-user-question)
- `models.ts` — AI Gateway model routing (`GatewayModelId`), provider-specific option handling (adaptive thinking for Claude 4.6/4.7, encrypted reasoning for GPT-5)
- `system-prompt.ts` — the agent's system prompt
- `subagents/` — `explorer` (read-only research), `executor` (full access), `design` — invoked via the `task` tool
- `skills/` — skill discovery and loading (`discovery.ts`, `loader.ts`) for `.agents/skills/*/SKILL.md`
- `docs/approval-system.md` — the current bash safety model: safe read-only commands run without approval, dangerous/unknown commands and anything escaping the sandbox working directory require approval

## Depends on

`@open-agents/sandbox` for all execution — this package never talks to a specific sandbox provider directly, only the abstract `Sandbox` interface. See `packages/sandbox/CLAUDE.md`.

## Commands

```bash
turbo typecheck --filter=@open-agents/agent
```

## Where this is going

Per [docs/agents/consolidation-plan.md](../../docs/agents/consolidation-plan.md), this package's tool set and persona definition are migrating into `apps/agent-runtime` on Vercel's `eve`, wrapped as `defineTool`/`defineAgent`. Don't add new tools here without checking whether Phase 1 of that plan is already in progress — new tools may belong in the eve project instead.
