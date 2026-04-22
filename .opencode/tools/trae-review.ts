import { tool } from "@opencode-ai/plugin"
import path from "path"

const PLUGIN_DIR = path.dirname(path.dirname(import.meta.dir))
const DIST_INDEX = path.join(PLUGIN_DIR, "dist", "index.js")

export default tool({
  description:
    "使用 Trae Agent 对代码变更进行专业审查。自动获取 git diff 并提交审查。支持对抗性审查模式、基准分支自动检测、后台执行、结构化输出。",
  args: {
    base_branch: tool.schema
      .string()
      .optional()
      .describe("基准分支，默认自动检测"),
    adversarial: tool.schema
      .boolean()
      .optional()
      .describe("对抗性审查模式，极度严苛地检查代码"),
    background: tool.schema.boolean().optional().describe("后台执行"),
    yolo: tool.schema.boolean().optional().describe("YOLO 模式"),
    json_output: tool.schema.boolean().optional().describe("返回结构化 JSON 输出"),
    session_id: tool.schema.string().optional().describe("指定会话 ID"),
  },
  async execute(args, context) {
    const command = args.adversarial ? "adversarial-review" : "review"
    const cliArgs: string[] = ["node", DIST_INDEX, command]

    if (args.base_branch) cliArgs.push("--base", args.base_branch)
    if (args.background) cliArgs.push("--background")
    if (args.yolo) cliArgs.push("--yolo")
    if (args.json_output) cliArgs.push("--json")
    if (args.session_id) cliArgs.push("--session-id", args.session_id)

    const { $ } = await import("bun")
    const result = await $`${cliArgs}`.cwd(PLUGIN_DIR)
    if (result.exitCode !== 0 && result.stderr) {
      process.stderr.write(result.stderr)
    }
    return {
      text: result.stdout,
    }
  },
})
