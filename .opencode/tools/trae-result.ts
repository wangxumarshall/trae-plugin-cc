import { tool } from "@opencode-ai/plugin"
import path from "path"

const PLUGIN_DIR = path.dirname(path.dirname(import.meta.dir))
const DIST_INDEX = path.join(PLUGIN_DIR, "dist", "index.js")

export default tool({
  description:
    "获取特定后台 Trae 任务的输出日志。通过 `/trae:status` 或 status 工具获取任务 ID。",
  args: {
    task_id: tool.schema.string().describe("后台任务 ID（时间戳）"),
  },
  async execute(args, context) {
    const { $ } = await import("bun")
    const result = await $`node ${DIST_INDEX} result ${args.task_id}`
      .cwd(PLUGIN_DIR)
    if (result.exitCode !== 0 && result.stderr) {
      process.stderr.write(result.stderr)
    }
    return { text: result.stdout }
  },
})
