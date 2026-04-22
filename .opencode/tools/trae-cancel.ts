import { tool } from "@opencode-ai/plugin"
import path from "path"

const PLUGIN_DIR = path.dirname(path.dirname(import.meta.dir))
const DIST_INDEX = path.join(PLUGIN_DIR, "dist", "index.js")

export default tool({
  description:
    "强制取消特定的后台 Traе 任务。通过 `/trae:status` 或 status 工具获取任务 ID。",
  args: {
    task_id: tool.schema.string().describe("要取消的后台任务 ID（时间戳）"),
  },
  async execute(args, context) {
    const { $ } = await import("bun")
    const result = await $`node ${DIST_INDEX} cancel ${args.task_id}`
      .cwd(PLUGIN_DIR)
    if (result.exitCode !== 0 && result.stderr) {
      process.stderr.write(result.stderr)
    }
    return { text: result.stdout }
  },
})
