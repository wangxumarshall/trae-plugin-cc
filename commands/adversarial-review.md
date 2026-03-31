---
description: Conduct an adversarial code review, where Trae Agent specifically looks for flaws, challenges assumptions, and seeks out deep logic errors.
argument-hint: '[--base <branch>] [--background]'
disable-model-invocation: true
allowed-tools: Bash(node:*), AskUserQuestion
---

Run an adversarial code review through Trae Agent.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- This command is review-only. Do not fix issues or apply patches yourself.
- Your job is to run the adversarial review and return Trae's output verbatim to the user.

Execution mode rules:
- If the raw arguments include `--background`, do not ask. Run the review in a Claude background task.
- Otherwise, estimate the review size before asking. Recommend background for larger reviews.
- When asking, use `AskUserQuestion` exactly once with two options, putting the recommended option first and suffixing its label with `(Recommended)`:
  - `Wait for results`
  - `Run in background`

Argument handling:
- Preserve the user's arguments exactly.
- Do not strip `--background` yourself. The CLI will handle it.

Foreground flow:
- Run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" adversarial-review $ARGUMENTS
```
- Return the command stdout verbatim, exactly as-is.

Background flow:
- Launch the review with `Bash` in the background:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" adversarial-review $ARGUMENTS`,
  description: "Trae adversarial review",
  run_in_background: true
})
```
- Do not call `BashOutput` or wait for completion in this turn.
- Tell the user: "Trae adversarial review started in the background. Check `/trae:status` for progress."
