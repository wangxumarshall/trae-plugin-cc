---
description: Delegate a natural language task to Trae Agent (trae-cli).
argument-hint: '["task description"] [--background]'
disable-model-invocation: true
allowed-tools: Bash(node:*), AskUserQuestion
---

Run a task using Trae Agent.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- Your job is to hand over the task to Trae Agent and return its output verbatim to the user.

Execution mode rules:
- If the raw arguments include `--background`, do not ask. Run the task in a Claude background task.
- Otherwise, estimate if the task is long-running before asking. Recommend background for larger tasks.
- When asking, use `AskUserQuestion` exactly once with two options, putting the recommended option first and suffixing its label with `(Recommended)`:
  - `Wait for results`
  - `Run in background`

Argument handling:
- Preserve the user's arguments exactly.
- Do not strip `--background` yourself. The CLI will handle it.

Foreground flow:
- Run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" run $ARGUMENTS
```
- Return the command stdout verbatim, exactly as-is.

Background flow:
- Launch the task with `Bash` in the background:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" run $ARGUMENTS`,
  description: "Trae task delegation",
  run_in_background: true
})
```
- Do not call `BashOutput` or wait for completion in this turn.
- Tell the user: "Trae task started in the background. Check `/trae:status` for progress."
