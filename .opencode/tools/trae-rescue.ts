import { tool } from "@opencode-ai/plugin"
import path from "path"

const PLUGIN_DIR = path.dirname(path.dirname(import.meta.dir))
const DIST_INDEX = path.join(PLUGIN_DIR, "dist", "index.js")

export default tool({
  description:
    "当任务执行失败时，使用 Traе Agent 进行故障诊断。收集最近的错误日志、Git 状态等信息，并让 Traе 分析问题原因和恢复建议。",
  args: {
    context: tool.schema
      .string()
      .optional()
      .describe("提供额外的上下文信息帮助诊断"),
  },
  async execute(args, context) {
    const { $ } = await import("bun")
    const cliArgs: string[] = ["node", DIST_INDEX, "rescue"]
    if (args.context) cliArgs.push("--context", args.context)
    const result = await $`${cliArgs}`.cwd(PLUGIN_DIR)
    if (result.exitCode !== 0 && result.stderr) {
      process.stderr.write(result.stderr)
    }
    return { text: result.stdout }
  },
})
