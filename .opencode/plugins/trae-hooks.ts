import type { Plugin } from "@opencode-ai/plugin"
import path from "path"

const SCRIPTS_DIR = path.join(path.dirname(path.dirname(import.meta.dir)), "scripts")

function hookArgs(script: string, hookType: string): string[] {
  return ["node", path.join(SCRIPTS_DIR, script), hookType]
}

async function callHook(
  script: string,
  hookType: string,
  cwd: string,
  payload?: Record<string, unknown>,
) {
  try {
    const proc = Bun.spawn(hookArgs(script, hookType), {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      stdin: payload ? new Blob([JSON.stringify(payload) + "\n"]) : undefined,
    })
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    await proc.exited
    if (stdout) console.log(`[trae:${hookType}]`, stdout.trim())
    if (stderr) console.warn(`[trae:${hookType}]`, stderr.trim())
  } catch (e) {
    console.error(`[trae-hook:${hookType}]`, e)
  }
}

function callHookSync(
  script: string,
  hookType: string,
  cwd: string,
  payload?: Record<string, unknown>,
) {
  try {
    const result = Bun.spawnSync(hookArgs(script, hookType), {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      stdin: payload ? new TextEncoder().encode(JSON.stringify(payload) + "\n") : undefined,
    })
    const stdout = new TextDecoder().decode(result.stdout)
    const stderr = new TextDecoder().decode(result.stderr)
    if (stdout) console.log(`[trae:${hookType}]`, stdout.trim())
    if (stderr) console.warn(`[trae:${hookType}]`, stderr.trim())
  } catch (e) {
    console.error(`[trae-hook-sync:${hookType}]`, e)
  }
}

/**
 * Trae Plugin hooks for OpenCode
 *
 * Maps Claude Code hooks to OpenCode events:
 * - SessionStart  → session.created
 * - Stop gate     → tool.execute.after (check uncommitted changes)
 * - PostReview    → tool.execute.after (review tools only)
 * - SessionEnd    → server.instance.disposed / session.deleted
 */
export const TraeHooksPlugin: Plugin = async ({ directory }) => {
  let currentSessionID: string | null = null

  return {
    event: async ({ event }) => {
      try {
        switch (event.type) {
          case "session.created": {
            const session = (event as any).properties?.info
            if (session?.id) {
              currentSessionID = session.id
              await callHook("session-lifecycle-hook.mjs", "SessionStart", directory, {
                session_id: session.id,
              })
            }
            break
          }

          case "session.deleted": {
            const session = (event as any).properties?.info
            if (session?.id) {
              callHookSync("session-lifecycle-hook.mjs", "SessionEnd", directory, {
                session_id: session.id,
              })
              currentSessionID = null
            }
            break
          }

          case "server.instance.disposed": {
            if (currentSessionID) {
              callHookSync("session-lifecycle-hook.mjs", "SessionEnd", directory, {
                session_id: currentSessionID,
              })
              currentSessionID = null
            }
            break
          }
        }
      } catch {
        // Silently ignore — plugin failures must not crash OpenCode
      }
    },
  }
}
