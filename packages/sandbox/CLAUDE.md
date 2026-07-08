# packages/sandbox (@open-agents/sandbox)

The sandbox abstraction. Defines what an execution environment can do (`interface.ts`) and provides a concrete implementation on top of Vercel Sandbox (`vercel/`).

## Key architectural principle

**The agent is not the sandbox.** `packages/agent` only calls the `Sandbox` interface — it never imports `vercel/` directly. This keeps the agent's lifecycle, model choice, and the sandbox implementation free to evolve independently, and lets the sandbox hibernate/resume without the agent knowing.

## Key files

- `interface.ts` — the abstract `Sandbox` contract: `exec`, `readFile`/`writeFile`, `gitClone`/`gitBranch`, `snapshot`/`resume`, `setGitHubAuthToken`, `extendTimeout`
- `vercel/` — the Vercel Sandbox implementation (`sandbox.ts`, `config.ts`, `snapshot-refresh.ts`)
- `git.ts` — clone/branch operations used by both the interface consumers and the Vercel implementation
- `factory.ts` — constructs a `Sandbox` instance

## Commands

```bash
turbo typecheck --filter=@open-agents/sandbox
bun test packages/sandbox
```

## Where this is going

Per [docs/agents/consolidation-plan.md](../../docs/agents/consolidation-plan.md), this becomes a multi-provider system: `interface.ts` stays the extension point, and `daytona/` and `modal/` get added alongside `vercel/` as new implementations of the same contract. If you're adding a new sandbox provider, implement the existing interface — don't change its shape without checking every existing consumer in `packages/agent`.
